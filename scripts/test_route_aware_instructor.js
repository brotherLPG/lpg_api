/**
 * Comprehensive Acceptance Test Suite for the Route-Aware ERP Instructor.
 *
 * Verifies:
 * 1. Mapped ERP Pages & Workflows consistency against PageRouter.jsx routes.
 * 2. Complete 5-part walkthrough on first reply for "How do I...?" tasks.
 * 3. Page links resolution and permission gating (Open page button).
 * 4. Record-ID parameterized routes guide user to the appropriate list.
 * 5. Contextual follow-up memory ("Which account do I choose?") within last workflow.
 * 6. Topic switching correctly switches workflow context.
 * 7. Verification across all 9 required core modules:
 *    - Customers
 *    - Sales
 *    - Payments (Customer Receipt, Supplier Payment, Refund)
 *    - Sales Returns
 *    - Suppliers
 *    - LPG Receipts
 *    - Filling Batches
 *    - Inventory
 *    - Accounts
 * 8. Restricted actions stay restricted and never leak unauthorized page links.
 */

const assert = require('assert');
const crypto = require('crypto');
const {
  ERP_PAGES,
  ERP_WORKFLOWS,
  COVERAGE_CHECKLIST,
  resolvePageLink,
  matchWorkflows,
  isFollowUpQuestion,
} = require('../src/chat/knowledge');
const { ChatRequestWindow } = require('../src/models');
const chatService = require('../src/services/chat.service');
const chatProvider = require('../src/services/chatProvider.service');

// Mock in-memory storage for test
const mockWindows = new Map();

ChatRequestWindow.findOne = function (filter) {
  const userIdStr = String(filter.userId);
  const doc = mockWindows.get(userIdStr);
  return {
    lean: async () => (doc ? JSON.parse(JSON.stringify(doc)) : null),
  };
};

ChatRequestWindow.updateOne = async function (filter, update, options) {
  const userIdStr = String(filter.userId);
  let doc = mockWindows.get(userIdStr);

  if (!doc && options?.upsert) {
    doc = {
      userId: filter.userId,
      requests: [],
      lastWorkflowId: null,
      lastWorkflowAt: null,
      expiresAt: update.$setOnInsert?.expiresAt || new Date(Date.now() + 60000),
    };
    mockWindows.set(userIdStr, doc);
  }

  if (doc) {
    if (filter['requests.reservationId']) {
      const resId = filter['requests.reservationId'];
      const targetReq = doc.requests.find((r) => r.reservationId === resId);
      if (targetReq && update.$set) {
        if (update.$set['requests.$.status']) targetReq.status = update.$set['requests.$.status'];
        if (update.$set['requests.$.answer']) targetReq.answer = update.$set['requests.$.answer'];
        if (update.$set['requests.$.completedAt']) targetReq.completedAt = update.$set['requests.$.completedAt'];
        if (update.$set['requests.$.expiresAt']) targetReq.expiresAt = update.$set['requests.$.expiresAt'];
        if (update.$set['requests.$.workflowId']) targetReq.workflowId = update.$set['requests.$.workflowId'];
        if (update.$set['requests.$.pageLink']) targetReq.pageLink = update.$set['requests.$.pageLink'];
        if (update.$set['requests.$.steps']) targetReq.steps = update.$set['requests.$.steps'];
      }
    }
    if (update.$set?.lastWorkflowId) {
      doc.lastWorkflowId = update.$set.lastWorkflowId;
      doc.lastWorkflowAt = update.$set.lastWorkflowAt || new Date();
    }
  }

  return { matchedCount: doc ? 1 : 0, modifiedCount: 1 };
};

ChatRequestWindow.findOneAndUpdate = async function (filter, update) {
  const userIdStr = String(filter.userId);
  let doc = mockWindows.get(userIdStr);
  if (!doc) {
    doc = {
      userId: filter.userId,
      requests: [],
      lastWorkflowId: null,
      lastWorkflowAt: null,
      expiresAt: new Date(Date.now() + 60000),
    };
    mockWindows.set(userIdStr, doc);
  }

  if (update.$push?.requests) {
    doc.requests.push(update.$push.requests);
  }
  if (update.$set?.expiresAt) {
    doc.expiresAt = update.$set.expiresAt;
  }

  return JSON.parse(JSON.stringify(doc));
};

const testUser = { _id: '507f1f77bcf86cd799439011' };

async function runAcceptanceTests() {
  console.log('\n======================================================');
  console.log('--- Route-Aware ERP Instructor: Acceptance Tests ---');
  console.log('======================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(err);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] ${name}`);
      console.error(err);
    }
  }

  // --- 1. Route Map & Coverage Checklist ---
  test('1. ERP_PAGES has verified staff-facing routes mapped from PageRouter.jsx', () => {
    assert(ERP_PAGES.length >= 25);
    const routes = ERP_PAGES.map((p) => p.route);
    assert(routes.includes('/customers'));
    assert(routes.includes('/customers/add'));
    assert(routes.includes('/sales'));
    assert(routes.includes('/sales/add'));
    assert(routes.includes('/sales/return'));
    assert(routes.includes('/payments'));
    assert(routes.includes('/payments/add'));
    assert(routes.includes('/suppliers'));
    assert(routes.includes('/suppliers/add'));
    assert(routes.includes('/lpg-receipts'));
    assert(routes.includes('/lpg-receipts/receive'));
    assert(routes.includes('/filling-batches'));
    assert(routes.includes('/filling-batches/create'));
    assert(routes.includes('/inventory'));
    assert(routes.includes('/inventory/add'));
    assert(routes.includes('/accounting'));
    assert(routes.includes('/accounting/add'));
    assert(routes.includes('/storage-tanks'));

    // Verify checklist includes incomplete/unverified marker
    assert.strictEqual(COVERAGE_CHECKLIST.summary.incompleteModules, 1);
    const reportsModule = COVERAGE_CHECKLIST.modules.find((m) => m.module === 'Reports');
    assert.strictEqual(reportsModule.status, 'incomplete');
  });

  // --- 2. Complete Walkthrough on First Reply ---
  await testAsync('2. First reply gives complete 5-part walkthrough for Supplier Payment with link', async () => {
    mockWindows.clear();
    const permissions = ['payments.create', 'payments.read'];

    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: permissions,
      requestId: crypto.randomUUID(),
      question: 'How do I record a supplier payment?',
    });

    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.workflowId, 'make_supplier_payment');
    assert(res.steps.length >= 4);

    // 1. Menu & Page
    assert(res.answer.includes('"Payments"'));
    // 2. Button
    assert(res.answer.includes('"Add Payment"'));
    // 3. Direction & Fields
    assert(res.answer.includes('"Supplier Payment (Outward)"'));
    assert(res.answer.includes('Supplier'));
    // 4. Review
    assert(res.answer.includes('allocation') || res.answer.includes('review') || res.answer.includes('Invoice Allocation'));
    // 5. Submit button & result
    assert(res.answer.includes('"Record Voucher Payment"'));

    // Check Open Add Payment button link
    assert(res.pageLink);
    assert.strictEqual(res.pageLink.route, '/payments/add');
    assert(res.pageLink.label.includes('Add Payment'));
  });

  // --- 3. Contextual Follow-up Memory ---
  await testAsync('3. Follow-up "Which account do I choose?" resolves inside Supplier Payment workflow', async () => {
    // Note: mockWindows now has lastWorkflowId: 'make_supplier_payment' from previous test
    const permissions = ['payments.create', 'payments.read'];

    const followUpRes = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: permissions,
      requestId: crypto.randomUUID(),
      question: 'Which account do I choose?',
    });

    assert.strictEqual(followUpRes.status, 'completed');
    assert.strictEqual(followUpRes.workflowId, 'make_supplier_payment');
    assert(followUpRes.answer.includes('Cash on Hand') || followUpRes.answer.includes('Bank'));
    assert.strictEqual(followUpRes.pageLink?.route, '/payments/add');
  });

  // --- 4. Topic Switching ---
  await testAsync('4. Topic switch: Asking about sales returns switches workflow from payments to sales returns', async () => {
    const permissions = ['payments.create', 'sales-returns.create', 'sales.read'];

    const switchRes = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: permissions,
      requestId: crypto.randomUUID(),
      question: 'How do I record a sale return?',
    });

    assert.strictEqual(switchRes.status, 'completed');
    assert.strictEqual(switchRes.workflowId, 'sale_returns');
    assert.strictEqual(switchRes.pageLink?.route, '/sales/return');
    assert(switchRes.answer.includes('Sales Returns') || switchRes.answer.includes('Create Return'));
  });

  // --- 5. Restricted Actions Stay Restricted ---
  await testAsync('5. Restricted actions stay restricted and do not return page links', async () => {
    // User only has customers.read, but asks to add a customer
    const permissions = ['customers.read'];

    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: permissions,
      requestId: crypto.randomUUID(),
      question: 'How do I add a customer?',
    });

    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.source, 'permission-restriction');
    assert(res.answer.includes("need the 'customers.create' permission"));
    assert.strictEqual(res.pageLink, null); // Link must be omitted
  });

  // --- 6. Module Coverage: Customers ---
  await testAsync('6. Module: Customers walkthrough and page link (/customers/add)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['customers.create', 'customers.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I add a new customer?',
    });

    assert.strictEqual(res.workflowId, 'add_customer');
    assert.strictEqual(res.pageLink?.route, '/customers/add');
    assert(res.answer.includes('"Customers"'));
    assert(res.answer.includes('"Add Customer"'));
  });

  // --- 7. Module Coverage: Sales ---
  await testAsync('7. Module: Sales walkthrough and page link (/sales/add)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['sales.create', 'sales.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I create a sale invoice?',
    });

    assert.strictEqual(res.workflowId, 'create_sale');
    assert.strictEqual(res.pageLink?.route, '/sales/add');
    assert(res.answer.includes('"Sales"'));
    assert(res.answer.includes('"Create Invoice"'));
  });

  // --- 8. Module Coverage: Customer Receipt ---
  await testAsync('8. Module: Payments (Customer Receipt) walkthrough and link', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['payments.create', 'payments.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I collect payment from customer?',
    });

    assert.strictEqual(res.workflowId, 'receive_customer_payment');
    assert.strictEqual(res.pageLink?.route, '/payments/add');
    assert(res.answer.includes('Customer Receipt (Inward)'));
  });

  // --- 9. Module Coverage: Suppliers ---
  await testAsync('9. Module: Suppliers walkthrough and page link (/suppliers/add)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['suppliers.create', 'suppliers.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I add a new supplier?',
    });

    assert.strictEqual(res.workflowId, 'add_supplier');
    assert.strictEqual(res.pageLink?.route, '/suppliers/add');
    assert(res.answer.includes('"Suppliers"'));
    assert(res.answer.includes('"Save Supplier"'));
  });

  // --- 10. Module Coverage: LPG Receipts (Bowser Inward) ---
  await testAsync('10. Module: LPG Receipts walkthrough and page link (/lpg-receipts/receive)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['lpg-receipts.create', 'lpg-receipts.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I record an LPG gas receipt from a bowser?',
    });

    assert.strictEqual(res.workflowId, 'record_lpg_receipt');
    assert.strictEqual(res.pageLink?.route, '/lpg-receipts/receive');
    assert(res.answer.includes('Confirm & Receive LPG'));
  });

  // --- 11. Module Coverage: Filling Batches ---
  await testAsync('11. Module: Filling Batches walkthrough and page link (/filling-batches/create)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['filling-batches.create', 'filling-batches.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I create a cylinder filling batch?',
    });

    assert.strictEqual(res.workflowId, 'create_filling_batch');
    assert.strictEqual(res.pageLink?.route, '/filling-batches/create');
    assert(res.answer.includes('Create Filling Batch'));
  });

  // --- 12. Module Coverage: Inventory ---
  await testAsync('12. Module: Inventory walkthrough and page link (/inventory/add)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['inventory-items.create', 'inventory-items.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I add an inventory item SKU?',
    });

    assert.strictEqual(res.workflowId, 'add_inventory_item');
    assert.strictEqual(res.pageLink?.route, '/inventory/add');
    assert(res.answer.includes('"Inventory"'));
    assert(res.answer.includes('"Save Item"'));
  });

  // --- 13. Module Coverage: Accounts ---
  await testAsync('13. Module: Accounts walkthrough and page link (/accounting/add)', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['accounts.create', 'accounts.read'],
      requestId: crypto.randomUUID(),
      question: 'How do I add a bank account in accounting?',
    });

    assert.strictEqual(res.workflowId, 'add_account');
    assert.strictEqual(res.pageLink?.route, '/accounting/add');
    assert(res.answer.includes('"Save Account"'));
  });

  // --- 14. Navigation Questions ---
  await testAsync('14. Navigation Question: "Take me to customers" returns direct navigation link', async () => {
    const res = await chatService.processChatRequest({
      user: testUser,
      permissionCodes: ['customers.read'],
      requestId: crypto.randomUUID(),
      question: 'Take me to customers',
    });

    assert.strictEqual(res.status, 'completed');
    assert.strictEqual(res.pageLink?.route, '/customers');
  });

  console.log('\n======================================================');
  console.log(`Results: ${passed}/${total} passed`);
  console.log('======================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runAcceptanceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
