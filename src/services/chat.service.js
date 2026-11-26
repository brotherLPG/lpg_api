const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const { ChatRequestWindow } = require('../models');
const { matchWorkflows, resolvePageLink, ERP_WORKFLOWS } = require('../chat/knowledge');
const {
  isOutOfScope,
  renderVerifiedWorkflowSteps,
  validateAndSanitizeAnswer,
} = require('../chat/answer.validation');
const chatProvider = require('./chatProvider.service');

/**
 * Normalize question: trim, collapse repeated whitespace, lowercase.
 */
function normalizeQuestion(question = '') {
  return question
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * SHA-256 fingerprint of normalized question text.
 */
function hashQuestion(normalizedText) {
  return crypto.createHash('sha256').update(normalizedText).digest('hex');
}

/**
 * Checks if a cached reply generated under `effectivePermissions` is still eligible
 * under the user's `currentPermissions`.
 *
 * Rule: A reply created under broader permissions is ineligible after access changes.
 * Every permission granted when the answer was created must still be present in the user's current permissions.
 */
function isAnswerEligible(answerPermissions = [], currentPermissions = []) {
  if (!answerPermissions || answerPermissions.length === 0) return true;
  const currentSet = new Set(currentPermissions);
  return answerPermissions.every((perm) => currentSet.has(perm));
}

/**
 * Processes a chat question from an authenticated user.
 *
 * Coordinates:
 * 1. User identification & permissions from auth middleware.
 * 2. UUID & fingerprint checks (rejection of UUID reuse with different text, deduplication).
 * 3. Scope enforcement (unrelated topics get an ERP-only prompt).
 * 4. Grounding & permission restriction checks.
 * 5. Atomic generation slot reservation via MongoDB.
 * 6. Provider call with allowed workflows.
 * 7. Resilient fallback: Always returns verified steps from knowledge base if AI provider fails.
 */
async function processChatRequest({ user, permissionCodes = [], requestId, question }) {
  const userId = user._id;
  const normalizedText = normalizeQuestion(question);
  const questionFingerprint = hashQuestion(normalizedText);

  const quotaLimit = env.chat?.quotaLimit || 10;
  const quotaWindowMs = (env.chat?.quotaWindowSeconds || 60) * 1000;
  const providerTimeoutMs = env.chat?.timeoutMs || 15000;
  const cacheTtlMs = (env.cacheTtlSeconds || 60) * 1000;

  const now = new Date();
  const windowStart = new Date(now.getTime() - quotaWindowMs);

  // 1. Inspect existing state for this user (if any)
  const existingWindow = await ChatRequestWindow.findOne({ userId }).lean();

  if (existingWindow && Array.isArray(existingWindow.requests)) {
    // 2a. Match UUID retries first. Reject a UUID reused for different text.
    const uuidMatch = existingWindow.requests.find((r) => r.requestId === requestId);
    if (uuidMatch) {
      if (uuidMatch.questionFingerprint !== questionFingerprint) {
        throw new ApiError(400, 'The requestId has already been used for a different question.');
      }

      // If pending and not expired: return 202
      if (uuidMatch.status === 'pending' && new Date(uuidMatch.expiresAt) > now) {
        return {
          status: 'pending',
          requestId,
          retryAfter: 2,
        };
      }

      // If completed: check permission eligibility
      if (uuidMatch.status === 'completed' && new Date(uuidMatch.expiresAt) > now) {
        if (isAnswerEligible(uuidMatch.effectivePermissions, permissionCodes)) {
          return {
            status: 'completed',
            requestId,
            answer: uuidMatch.answer,
            workflowId: uuidMatch.workflowId || null,
            pageLink: uuidMatch.pageLink || null,
            steps: uuidMatch.steps || [],
            source: 'cache',
          };
        }
      }
    }

    // 2b. Check fingerprint match (e.g. same question submitted with a new UUID from another tab)
    const fpMatch = existingWindow.requests.find(
      (r) => r.questionFingerprint === questionFingerprint && r.requestId !== requestId
    );
    if (fpMatch) {
      if (fpMatch.status === 'pending' && new Date(fpMatch.expiresAt) > now) {
        return {
          status: 'pending',
          requestId,
          retryAfter: 2,
        };
      }

      if (fpMatch.status === 'completed' && new Date(fpMatch.expiresAt) > now) {
        if (isAnswerEligible(fpMatch.effectivePermissions, permissionCodes)) {
          return {
            status: 'completed',
            requestId,
            answer: fpMatch.answer,
            workflowId: fpMatch.workflowId || null,
            pageLink: fpMatch.pageLink || null,
            steps: fpMatch.steps || [],
            source: 'cache',
          };
        }
      }
    }
  }

  // 3. Out-of-scope check: For unrelated requests (e.g. drafting an email, weather, general chat),
  // return a short ERP-only reply directly from the backend without consuming quota or provider calls.
  if (isOutOfScope(question)) {
    return {
      status: 'completed',
      requestId,
      answer: 'I can help with Brother LPG ERP workflows. Which ERP task are you working on?',
      source: 'scope-notice',
    };
  }

  // 4. Grounding & Permission check: Match the question against verified knowledge base entries.
  const {
    matchedWorkflows,
    isTopUnauthorized,
    unauthorizedMatch,
    bestMatch,
    isAmbiguous,
    ambiguousMatches,
    isFollowUp,
    pageLink,
  } = matchWorkflows(question, permissionCodes, existingWindow?.lastWorkflowId);

  // 4a. If the question matches an action that requires permissions the user lacks:
  // State that permission is required only when the backend confirms that the user lacks it.
  if (isTopUnauthorized && unauthorizedMatch) {
    return {
      status: 'completed',
      requestId,
      answer: `To ${unauthorizedMatch.title.toLowerCase()}, you need the '${unauthorizedMatch.requiredPermission}' permission. Please contact your administrator for access.`,
      workflowId: unauthorizedMatch.id,
      pageLink: null,
      steps: [],
      source: 'permission-restriction',
      coverageStatus: unauthorizedMatch.status,
    };
  }

  // 4b. If the question is ambiguous between multiple actions (e.g. "how to record payment"):
  // Ask one focused question to clarify the user's intent.
  if (isAmbiguous && ambiguousMatches.length >= 2) {
    const action1 = ambiguousMatches[0].title.toLowerCase();
    const action2 = ambiguousMatches[1].title.toLowerCase();
    return {
      status: 'completed',
      requestId,
      answer: `Are you looking to ${action1} or ${action2}? Please specify so I can provide the exact steps.`,
      workflowId: null,
      pageLink: null,
      steps: [],
      source: 'clarification',
    };
  }

  // 4c. If contextual follow-up within the last authorized workflow (e.g. "Which account do I choose?"):
  if (isFollowUp && bestMatch) {
    let followUpAnswer = null;
    const qLower = normalizedText;
    if (
      (qLower.includes('which account') ||
        qLower.includes('konsa account') ||
        qLower.includes('what account') ||
        qLower.includes('which bank') ||
        qLower.includes('konsa bank')) &&
      bestMatch.followUpAnswers?.account
    ) {
      followUpAnswer = `${bestMatch.followUpAnswers.account}\n\nYou can proceed on the "${bestMatch.screenLabel}" screen.`;
    } else if (
      (qLower.includes('what do i do next') ||
        qLower.includes('what next') ||
        qLower.includes('what is next') ||
        qLower.includes('ab kya')) &&
      bestMatch.followUpAnswers?.next_steps
    ) {
      followUpAnswer = `${bestMatch.followUpAnswers.next_steps}`;
    }

    if (followUpAnswer) {
      await ChatRequestWindow.updateOne(
        { userId },
        { $set: { lastWorkflowId: bestMatch.id, lastWorkflowAt: now } }
      );

      return {
        status: 'completed',
        requestId,
        answer: followUpAnswer,
        workflowId: bestMatch.id,
        pageLink: pageLink || resolvePageLink(bestMatch, permissionCodes),
        steps: bestMatch.steps || [],
        source: 'contextual-followup',
        coverageStatus: bestMatch.status || 'verified',
      };
    }
  }

  // 5. Reserve the generation slot atomically.
  const reservationId = crypto.randomUUID();
  const pendingExpiry = new Date(now.getTime() + providerTimeoutMs + 5000);
  const docExpiry = new Date(now.getTime() + Math.max(quotaWindowMs, cacheTtlMs) + 60000);

  await ChatRequestWindow.updateOne(
    { userId },
    {
      $setOnInsert: {
        userId,
        requests: [],
        lastWorkflowId: null,
        expiresAt: docExpiry,
      },
    },
    { upsert: true }
  );

  const newEntry = {
    requestId,
    reservationId,
    questionFingerprint,
    status: 'pending',
    answer: null,
    workflowId: bestMatch?.id || null,
    pageLink: pageLink || null,
    steps: bestMatch?.steps || [],
    effectivePermissions: permissionCodes,
    error: null,
    createdAt: now,
    expiresAt: pendingExpiry,
    completedAt: null,
  };

  const reservedWindow = await ChatRequestWindow.findOneAndUpdate(
    {
      userId,
      $nor: [
        {
          requests: {
            $elemMatch: {
              $or: [{ requestId }, { questionFingerprint }],
              status: 'pending',
              expiresAt: { $gt: now },
            },
          },
        },
      ],
      $expr: {
        $lt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ['$requests', []] },
                as: 'r',
                cond: {
                  $and: [
                    { $gte: ['$$r.createdAt', windowStart] },
                    { $in: ['$$r.status', ['pending', 'completed']] },
                  ],
                },
              },
            },
          },
          quotaLimit,
        ],
      },
    },
    {
      $push: { requests: newEntry },
      $set: { expiresAt: docExpiry },
    },
    { new: true }
  );

  if (!reservedWindow) {
    const currentWindow = await ChatRequestWindow.findOne({ userId }).lean();

    const concurrent = currentWindow?.requests?.find(
      (r) =>
        (r.requestId === requestId || r.questionFingerprint === questionFingerprint) &&
        r.status === 'pending' &&
        new Date(r.expiresAt) > now
    );

    if (concurrent) {
      return {
        status: 'pending',
        requestId,
        retryAfter: 2,
      };
    }

    const windowRequests = (currentWindow?.requests || [])
      .filter((r) => new Date(r.createdAt) >= windowStart && ['pending', 'completed'].includes(r.status))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let retryAfterSeconds = env.chat?.quotaWindowSeconds || 60;
    if (windowRequests.length > 0) {
      const oldestTime = new Date(windowRequests[0].createdAt).getTime();
      const resetTime = oldestTime + quotaWindowMs;
      retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now.getTime()) / 1000));
    }

    const rateLimitError = new ApiError(429, 'Chat quota exceeded. Please wait before asking another question.');
    rateLimitError.retryAfter = retryAfterSeconds;
    throw rateLimitError;
  }

  // 6. Generate answer via provider with graceful fallback resilience:
  // For a known and authorized workflow, display verified steps even if the AI provider times out or returns 503.
  let generatedAnswer;
  let source = 'generated';

  try {
    const rawAnswer = await chatProvider.generateAnswer({
      question,
      allowedWorkflows: matchedWorkflows.length > 0 ? matchedWorkflows : [],
    });

    generatedAnswer = validateAndSanitizeAnswer({
      answerText: rawAnswer,
      matchedWorkflow: bestMatch,
      allowedWorkflows: matchedWorkflows,
    });
  } catch (providerError) {
    // If the provider fails (e.g. 503 high demand, 504 timeout, or network failure),
    // and we have a verified workflow match: display verified steps directly from knowledge.js.
    if (bestMatch) {
      generatedAnswer = renderVerifiedWorkflowSteps(bestMatch);
      source = 'verified-fallback';
    } else {
      // If no specific workflow could be identified and provider failed, provide a helpful ERP navigation guide
      generatedAnswer =
        'A verified ERP workflow guide is currently unavailable for this request. Please specify which screen or task you need assistance with (e.g. Sales, Customers, LPG Receipts, or Payments).';
      source = 'help-fallback';
    }
  }

  // 7. Finish the request: Save completed entry with answer
  const completedAt = new Date();
  const completionCacheExpiry = new Date(completedAt.getTime() + cacheTtlMs);

  await ChatRequestWindow.updateOne(
    {
      userId,
      'requests.reservationId': reservationId,
    },
    {
      $set: {
        'requests.$.status': 'completed',
        'requests.$.answer': generatedAnswer,
        'requests.$.workflowId': bestMatch?.id || null,
        'requests.$.pageLink': pageLink || null,
        'requests.$.steps': bestMatch?.steps || [],
        'requests.$.effectivePermissions': permissionCodes,
        'requests.$.completedAt': completedAt,
        'requests.$.expiresAt': completionCacheExpiry,
        lastWorkflowId: bestMatch?.id || existingWindow?.lastWorkflowId || null,
        lastWorkflowAt: completedAt,
        expiresAt: new Date(completedAt.getTime() + Math.max(quotaWindowMs, cacheTtlMs) + 60000),
      },
    }
  );

  return {
    status: 'completed',
    requestId,
    answer: generatedAnswer,
    workflowId: bestMatch?.id || null,
    pageLink: pageLink || null,
    steps: bestMatch?.steps || [],
    source,
    coverageStatus: bestMatch?.status || 'verified',
  };
}

module.exports = {
  normalizeQuestion,
  hashQuestion,
  isAnswerEligible,
  processChatRequest,
};
