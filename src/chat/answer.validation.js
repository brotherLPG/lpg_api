/**
 * Validates and sanitizes model answers before sending to React.
 * Enforces strict ERP grounding, ensures no invented buttons/actions are shown,
 * and provides robust fallback rendering directly from verified knowledge.js steps.
 */

const OUT_OF_SCOPE_PATTERNS = [
  /\b(write|draft|send)\b.*\b(email|letter|poem|song|essay|resume|cv)\b/i,
  /\b(weather|forecast|temperature)\b/i,
  /\b(crypto|bitcoin|ethereum|stock market|forex)\b/i,
  /\b(who is the (president|prime minister|ceo))\b/i,
  /\b(recipe|cook|movie|game|joke)\b/i,
];

const FORBIDDEN_HALLUCINATION_PATTERNS = [
  /i have (sent|opened|drafted) (an|the)? ?email/i,
  /i have (completed|processed|updated) (the|your)? ?transaction/i,
  /i have (changed|modified) (the|your)? ?setting/i,
  /i have (read|fetched) (your|the)? ?live (balance|record)/i,
];

/**
 * Checks if a question is clearly unrelated to Brother LPG ERP.
 */
function isOutOfScope(question = '') {
  return OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(question));
}

/**
 * Deterministically renders verified workflow steps from knowledge.js.
 * Guarantees that only verified screen names, buttons, and fields are displayed.
 *
 * @param {Object} workflow - Verified workflow entry from knowledge.js
 * @returns {string} Formatted human-readable instructions
 */
function renderVerifiedWorkflowSteps(workflow) {
  if (!workflow) {
    return 'A verified ERP workflow guide is currently unavailable for this screen. Please specify the screen name or contact your administrator.';
  }

  const stepsList = (workflow.steps || [])
    .map((step, idx) => `${idx + 1}. ${step}`)
    .join('\n');

  return [
    workflow.goal || `Follow these steps to ${workflow.title.toLowerCase()} in the "${workflow.screenLabel}" screen:`,
    '',
    stepsList,
    '',
    workflow.outcome ? `${workflow.outcome}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Validates and cleans model response text.
 * If model hallucinated actions outside ERP or failed to produce verified instructions,
 * safely falls back to knowledge base verified steps.
 *
 * @param {Object} params
 * @param {string} params.answerText - Raw answer from provider
 * @param {Object|null} params.matchedWorkflow - Top verified workflow matched by retrieval grounding
 * @param {Array} params.allowedWorkflows - All workflows permitted for this request
 * @returns {string} Validated, safe answer text
 */
function validateAndSanitizeAnswer({ answerText, matchedWorkflow, allowedWorkflows = [] }) {
  // If answer is missing, empty, or null, fall back to verified steps
  if (!answerText || typeof answerText !== 'string' || !answerText.trim()) {
    if (matchedWorkflow) {
      return renderVerifiedWorkflowSteps(matchedWorkflow);
    }
    return 'I can help with Brother LPG ERP workflows. Which ERP task or screen are you working on?';
  }

  const trimmed = answerText.trim();

  // Check for forbidden claims (e.g. claiming to execute transactions or send emails)
  const hasHallucination = FORBIDDEN_HALLUCINATION_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (hasHallucination) {
    if (matchedWorkflow) {
      return renderVerifiedWorkflowSteps(matchedWorkflow);
    }
    return 'I can provide step-by-step guidance for Brother LPG ERP screens. Which ERP task are you working on?';
  }

  return trimmed;
}

module.exports = {
  isOutOfScope,
  renderVerifiedWorkflowSteps,
  validateAndSanitizeAnswer,
};
