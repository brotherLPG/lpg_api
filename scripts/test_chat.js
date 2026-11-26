/**
 * Comprehensive verification script for Chatbot API & Acceptance Requirements.
 */

process.env.NODE_ENV = 'test';
process.env.MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/test_brother_lpg';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_32_characters_long_min';

const assert = require('assert');
const crypto = require('crypto');
const { chatRequestSchema } = require('../src/validations/chat.validation');
const {
  ERP_WORKFLOW_ACTIONS,
  matchWorkflows,
  formatKnowledgeForPrompt,
} = require('../src/chat/knowledge');
const {
  isOutOfScope,
  renderVerifiedWorkflowSteps,
  validateAndSanitizeAnswer,
} = require('../src/chat/answer.validation');
const chatProvider = require('../src/services/chatProvider.service');
const chatService = require('../src/services/chat.service');
const env = require('../src/config/env');
const ApiError = require('../src/utils/ApiError');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${description}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runTests() {
  console.log('\n--- 1. Request Validation Tests (Zod) ---');

  it('Valid UUID and trimmed nonempty question passes validation', () => {
    const validUuid = crypto.randomUUID();
    const result = chatRequestSchema.safeParse({
      body: {
        requestId: validUuid,
        question: 'How do I create a new sales invoice?',
      },
    });
    assert.strictEqual(result.success, true);
  });

  it('Rejects non-UUID requestId', () => {
    const result = chatRequestSchema.safeParse({
      body: {
        requestId: 'invalid-id-1234',
        question: 'How do I record LPG receipt?',
      },
    });
    assert.strictEqual(result.success, false);
  });

  it('Rejects extra unknown fields in request body (strict mode)', () => {
    const validUuid = crypto.randomUUID();
    const result = chatRequestSchema.safeParse({
      body: {
        requestId: validUuid,
        question: 'Valid question',
        extraField: 'not allowed',
      },
    });
    assert.strictEqual(result.success, false);
  });

  console.log('\n--- 2. Discrete Action Knowledge & Multilingual Grounding ---');

  it('Knowledge base has discrete entries per action with permissions', () => {
    const viewCust = ERP_WORKFLOW_ACTIONS.find((w) => w.id === 'view_customers');
    const addCust = ERP_WORKFLOW_ACTIONS.find((w) => w.id === 'add_customer');

    assert(viewCust, 'View Customers action must exist');
    assert.strictEqual(viewCust.requiredPermission, 'customers.read');
    assert(addCust, 'Add Customer action must exist');
    assert.strictEqual(addCust.requiredPermission, 'customers.create');
  });

  it('Matches English and Roman Urdu questions accurately', () => {
    const perms = ['customers.create', 'customers.read'];

    // English
    const m1 = matchWorkflows('How do I add a customer?', perms);
    assert.strictEqual(m1.bestMatch?.id, 'add_customer');

    // Roman Urdu
    const m2 = matchWorkflows('customer kaise add karun', perms);
    assert.strictEqual(m2.bestMatch?.id, 'add_customer');

    const m3 = matchWorkflows('naya customer banana hai', perms);
    assert.strictEqual(m3.bestMatch?.id, 'add_customer');
  });

  it('Detects ambiguous questions and requests clarification', () => {
    const perms = ['payments.create', 'payments.read'];
    const res = matchWorkflows('How do I record payment?', perms);
    assert.strictEqual(res.isAmbiguous, true);
    assert(res.ambiguousMatches.length >= 2);
  });

  console.log('\n--- 3. Scope Enforcement & Answer Validation ---');

  it('Flags out-of-scope non-ERP questions', () => {
    assert.strictEqual(isOutOfScope('Please write an email to my friend'), true);
    assert.strictEqual(isOutOfScope('What is the weather today?'), true);
    assert.strictEqual(isOutOfScope('Tell me bitcoin price'), true);
    assert.strictEqual(isOutOfScope('How do I create a sales invoice?'), false);
  });

  it('Renders verified steps with exact screen labels and outcome', () => {
    const addCust = ERP_WORKFLOW_ACTIONS.find((w) => w.id === 'add_customer');
    const text = renderVerifiedWorkflowSteps(addCust);
    assert(text.includes('"Customers"'));
    assert(text.includes('"Add Customer"'));
    assert(text.includes('"Save Customer"'));
    assert(text.includes('1.'));
  });

  it('Sanitizes answers and strips forbidden transaction claims', () => {
    const addCust = ERP_WORKFLOW_ACTIONS.find((w) => w.id === 'add_customer');
    const fakeAnswer = 'I have completed the transaction and updated your balance.';
    const sanitized = validateAndSanitizeAnswer({
      answerText: fakeAnswer,
      matchedWorkflow: addCust,
    });
    // Should fall back to verified steps and NOT include fake claim
    assert(!sanitized.includes('I have completed the transaction'));
    assert(sanitized.includes('"Customers"'));
  });

  console.log('\n--- 4. Service Grounding, Permissions & Provider 503 Fallback ---');

  const mockStorage = new Map();
  const { ChatRequestWindow } = require('../src/models');
  const origFindOne = ChatRequestWindow.findOne;
  const origUpdateOne = ChatRequestWindow.updateOne;
  const origFindOneAndUpdate = ChatRequestWindow.findOneAndUpdate;

  ChatRequestWindow.findOne = function (query) {
    const userIdStr = String(query.userId);
    const doc = mockStorage.get(userIdStr) || null;
    return {
      lean: async () => (doc ? JSON.parse(JSON.stringify(doc)) : null),
    };
  };

  ChatRequestWindow.updateOne = async function (filter, update, options) {
    const userIdStr = String(filter.userId);
    let doc = mockStorage.get(userIdStr);
    if (!doc && options?.upsert) {
      doc = {
        userId: filter.userId,
        requests: [],
        expiresAt: update.$setOnInsert?.expiresAt || new Date(Date.now() + 3600000),
      };
      mockStorage.set(userIdStr, doc);
      return { matchedCount: 0, upsertedCount: 1 };
    }
    if (doc && filter['requests.reservationId']) {
      const resId = filter['requests.reservationId'];
      const targetReq = doc.requests.find((r) => r.reservationId === resId);
      if (targetReq && update.$set) {
        if (update.$set['requests.$.status']) targetReq.status = update.$set['requests.$.status'];
        if (update.$set['requests.$.answer']) targetReq.answer = update.$set['requests.$.answer'];
        if (update.$set['requests.$.completedAt']) targetReq.completedAt = update.$set['requests.$.completedAt'];
        if (update.$set['requests.$.expiresAt']) targetReq.expiresAt = update.$set['requests.$.expiresAt'];
      }
    }
    return { matchedCount: 1, modifiedCount: 1 };
  };

  ChatRequestWindow.findOneAndUpdate = async function (filter, update) {
    const userIdStr = String(filter.userId);
    const doc = mockStorage.get(userIdStr);
    if (!doc) return null;

    const now = new Date();
    const norActive = doc.requests.some(
      (r) =>
        (r.requestId === update.$push.requests.requestId ||
          r.questionFingerprint === update.$push.requests.questionFingerprint) &&
        r.status === 'pending' &&
        new Date(r.expiresAt) > now
    );
    if (norActive) return null;

    const windowStart = new Date(now.getTime() - (env.chat.quotaWindowSeconds || 60) * 1000);
    const activeInWindow = doc.requests.filter(
      (r) => new Date(r.createdAt) >= windowStart && ['pending', 'completed'].includes(r.status)
    );

    if (activeInWindow.length >= (env.chat.quotaLimit || 10)) return null;

    doc.requests.push(update.$push.requests);
    return JSON.parse(JSON.stringify(doc));
  };

  const testUserA = { _id: '507f1f77bcf86cd799439011' };

  await itAsync('Out of scope query returns immediate ERP-only reply without calling provider', async () => {
    let providerCalled = false;
    chatProvider.setMockProvider(async () => {
      providerCalled = true;
      return 'Some answer';
    });

    const res = await chatService.processChatRequest({
      user: testUserA,
      permissionCodes: ['customers.read'],
      requestId: crypto.randomUUID(),
      question: 'Please draft an email to a vendor about pricing',
    });

    assert.strictEqual(res.source, 'scope-notice');
    assert(res.answer.includes('I can help with Brother LPG ERP workflows'));
    assert.strictEqual(providerCalled, false);
  });

  await itAsync('Permission restriction: Informs user when they lack permission for requested action', async () => {
    // User has customers.read, but NOT customers.create
    const res = await chatService.processChatRequest({
      user: testUserA,
      permissionCodes: ['customers.read'], // Missing customers.create
      requestId: crypto.randomUUID(),
      question: 'How do I add a new customer?',
    });

    assert.strictEqual(res.source, 'permission-restriction');
    assert(res.answer.includes("need the 'customers.create' permission"));
  });

  await itAsync('Ambiguous question asks a focused clarifying question', async () => {
    const res = await chatService.processChatRequest({
      user: testUserA,
      permissionCodes: ['payments.create', 'payments.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I record payment?',
    });

    assert.strictEqual(res.source, 'clarification');
    assert(res.answer.includes('customer payment') || res.answer.includes('supplier payment'));
  });

  await itAsync('Provider 503 fallback: Displays verified steps even when AI provider fails', async () => {
    mockStorage.clear();
    // Simulate Gemini/OpenAI returning 503 high demand
    chatProvider.setMockProvider(async () => {
      throw new ApiError(503, 'This model is currently experiencing high demand.');
    });

    // User with permission asks "How do I add a customer?"
    const res = await chatService.processChatRequest({
      user: testUserA,
      permissionCodes: ['customers.create', 'customers.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I add a customer?',
    });

    // Must return 200 with verified fallback, NEVER a 502 error!
    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.source, 'verified-fallback');
    assert(res.answer.includes('"Customers"'));
    assert(res.answer.includes('"Add Customer"'));
    assert(res.answer.includes('"Save Customer"'));
  });

  await itAsync('Roman Urdu question returns verified steps', async () => {
    mockStorage.clear();
    chatProvider.setMockProvider(async () => {
      throw new ApiError(503, 'Provider busy');
    });

    const res = await chatService.processChatRequest({
      user: testUserA,
      permissionCodes: ['sales.create', 'sales.read'],
      requestId: crypto.randomUUID(),
      question: 'cylinder sale kaise banayein',
    });

    assert.strictEqual(res.status, 'completed');
    assert(res.answer.includes('"Sales"'));
    assert(res.answer.includes('"New Sale"'));
  });

  // Restore ChatRequestWindow methods
  ChatRequestWindow.findOne = origFindOne;
  ChatRequestWindow.updateOne = origUpdateOne;
  ChatRequestWindow.findOneAndUpdate = origFindOneAndUpdate;
  chatProvider.setMockProvider(null);

  console.log(`\n========================================`);
  console.log(`Acceptance Tests finished: ${passedTests}/${totalTests} passed`);
  console.log(`========================================\n`);

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
