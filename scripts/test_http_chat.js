/**
 * In-memory HTTP layer test for Express chat routing and middleware
 * Runs inside the standard sandbox without requiring external sockets.
 */

process.env.NODE_ENV = 'test';
process.env.MONGODB_URL = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/test_brother_lpg';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_32_characters_long_min';

const db = require('../src/config/db');
db.connectDB = async () => {};

const assert = require('assert');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const app = require('../src/app');

function createMockReq(options = {}) {
  const req = new EventEmitter();
  req.method = options.method || 'POST';
  req.url = options.url || '/api/chat';
  req.originalUrl = req.url;
  req.headers = Object.assign(
    {
      'content-type': 'application/json',
      host: 'localhost',
    },
    options.headers || {}
  );
  req.body = options.body || {};
  req.params = options.params || {};
  req.query = options.query || {};
  req.socket = { remoteAddress: '127.0.0.1' };
  req.connection = req.socket;
  return req;
}

function createMockRes() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res._headers = {};
  res.locals = {};

  res.setHeader = function (name, value) {
    this._headers[name.toLowerCase()] = value;
    return this;
  };

  res.removeHeader = function (name) {
    delete this._headers[name.toLowerCase()];
    return this;
  };

  res.getHeader = function (name) {
    return this._headers[name.toLowerCase()];
  };

  res.status = function (code) {
    this.statusCode = code;
    return this;
  };

  res.json = function (data) {
    this._data = data;
    this.emit('finish');
    return this;
  };

  res.end = function () {
    this.emit('finish');
    return this;
  };

  return res;
}

function handleRequest(req, res) {
  return new Promise((resolve) => {
    res.once('finish', () => resolve(res));
    app(req, res, () => resolve(res));
  });
}

async function run() {
  console.log('\n--- In-Memory Express Route & Middleware Tests ---');

  // 1. Unauthenticated request without Bearer token must return 401
  const reqUnauth = createMockReq({
    method: 'POST',
    url: '/api/chat',
    headers: {},
    body: {
      requestId: crypto.randomUUID(),
      question: 'How do I add a customer?',
    },
  });
  const resUnauth = createMockRes();
  await handleRequest(reqUnauth, resUnauth);

  assert.strictEqual(resUnauth.statusCode, 401);
  assert.strictEqual(resUnauth._data?.success, false);
  assert(resUnauth._data?.message.includes('token is required'));
  console.log('  [PASS] Unauthenticated request returns 401 with informative error message');

  // 2. Request with invalid Bearer token must return 401
  const reqInvalidToken = createMockReq({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: 'Bearer malformed.jwt.token' },
    body: {
      requestId: crypto.randomUUID(),
      question: 'How do I add a customer?',
    },
  });
  const resInvalidToken = createMockRes();
  await handleRequest(reqInvalidToken, resInvalidToken);

  assert.strictEqual(resInvalidToken.statusCode, 401);
  console.log('  [PASS] Malformed token returns 401');

  // 3. Test controller unit behavior for cache header and activity message
  const chatController = require('../src/controllers/chat.controller');
  const chatService = require('../src/services/chat.service');

  const origProcess = chatService.processChatRequest;

  // Case A: completed response sets Cache-Control: no-store and 200
  chatService.processChatRequest = async () => ({
    status: 'completed',
    requestId: 'test-req-id',
    answer: 'Here is the answer.',
    source: 'generated',
  });

  const mockCtrlReq = {
    body: { requestId: 'test-req-id', question: 'Valid question' },
    user: { _id: '507f1f77bcf86cd799439011' },
    permissionCodes: ['sales.read'],
  };
  const mockCtrlRes = createMockRes();
  await chatController.chat(mockCtrlReq, mockCtrlRes);

  assert.strictEqual(mockCtrlRes.statusCode, 200);
  assert.strictEqual(mockCtrlRes.getHeader('cache-control'), 'no-store');
  assert.strictEqual(mockCtrlRes.locals.activityMessage, 'chat: generated');
  console.log('  [PASS] Controller sets Cache-Control: no-store and activityMessage: chat: generated');

  // Case B: concurrent pending response sets Retry-After and 202
  chatService.processChatRequest = async () => ({
    status: 'pending',
    requestId: 'test-req-id',
    retryAfter: 2,
  });

  const mockCtrlResPending = createMockRes();
  await chatController.chat(mockCtrlReq, mockCtrlResPending);

  assert.strictEqual(mockCtrlResPending.statusCode, 202);
  assert.strictEqual(mockCtrlResPending.getHeader('retry-after'), 2);
  assert.strictEqual(mockCtrlResPending.getHeader('cache-control'), 'no-store');
  assert.strictEqual(mockCtrlResPending.locals.activityMessage, 'chat: concurrent (pending)');
  console.log('  [PASS] Controller sets 202, Retry-After: 2, and activityMessage: chat: concurrent (pending)');

  // Case C: route-aware walkthrough payload with pageLink and steps
  chatService.processChatRequest = async () => ({
    status: 'completed',
    requestId: 'test-req-id-2',
    answer: 'Here is your 5-part walkthrough...',
    source: 'generated',
    workflowId: 'supplier_payment_outward',
    pageLink: {
      label: 'Open Add Payment',
      route: '/payments/add',
      note: 'Opens Payment form directly.',
    },
    steps: ['1. Go to Payments', '2. Click Add Payment'],
  });

  const mockCtrlReqRoute = {
    body: { requestId: 'test-req-id-2', question: 'How do I record a supplier payment?' },
    user: { _id: '507f1f77bcf86cd799439011' },
    permissionCodes: ['payments.create', 'payments.read'],
  };
  const mockCtrlResRoute = createMockRes();
  await chatController.chat(mockCtrlReqRoute, mockCtrlResRoute);

  assert.strictEqual(mockCtrlResRoute.statusCode, 200);
  assert.strictEqual(mockCtrlResRoute._data?.data?.workflowId, 'supplier_payment_outward');
  assert.strictEqual(mockCtrlResRoute._data?.data?.pageLink?.route, '/payments/add');
  assert.strictEqual(mockCtrlResRoute._data?.data?.steps?.length, 2);
  console.log('  [PASS] Controller delivers route-aware payload with workflowId, pageLink, and steps');

  // Restore
  chatService.processChatRequest = origProcess;

  console.log('\n========================================');
  console.log('All In-Memory Route & Controller checks passed!');
  console.log('========================================\n');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
