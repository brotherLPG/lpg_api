const mongoose = require('mongoose');
const {
  Sale,
  SalesReturn,
  Payment,
  Expense,
  Customer,
  Supplier,
  InventoryItem,
  Account,
  ExpenseCategory,
} = require('../models');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { nextSequentialCode } = require('../utils/nextCode');
const { writeAudit } = require('./audit.service');

const SALE_POPULATE = [
  { path: 'customerId', select: 'customerCode customerName phoneNumber creditLimitAmount isActive' },
  { path: 'createdByUserId', select: 'fullName emailAddress' },
  { path: 'lineItems.inventoryItemId', select: 'itemCode itemName itemCategory unitOfMeasure currentQuantity' },
];

const RETURN_POPULATE = [
  { path: 'customerId', select: 'customerCode customerName' },
  { path: 'originalSaleId', select: 'invoiceNumber totalAmount paidAmount outstandingAmount saleStatus' },
  { path: 'processedByUserId', select: 'fullName emailAddress' },
  { path: 'returnItems.inventoryItemId', select: 'itemCode itemName itemCategory' },
];

const PAYMENT_POPULATE = [
  { path: 'customerId', select: 'customerCode customerName' },
  { path: 'supplierId', select: 'supplierCode supplierName contactPersonName phoneNumber isActive' },
  { path: 'accountId', select: 'accountCode accountName accountType currentBalanceAmount' },
  { path: 'saleId', select: 'invoiceNumber totalAmount paidAmount outstandingAmount paymentStatus' },
  { path: 'receivedOrPaidByUserId', select: 'fullName emailAddress' },
];

const EXPENSE_POPULATE = [
  { path: 'expenseCategoryId', select: 'categoryCode categoryName' },
  { path: 'paidFromAccountId', select: 'accountCode accountName accountType currentBalanceAmount' },
  { path: 'recordedByUserId', select: 'fullName emailAddress' },
  { path: 'approvedByUserId', select: 'fullName emailAddress' },
];

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function applyDateRange(filter, field, query) {
  if (!query.startDate && !query.endDate) return filter;
  filter[field] = {};
  if (query.startDate) filter[field].$gte = new Date(query.startDate);
  if (query.endDate) filter[field].$lte = new Date(query.endDate);
  return filter;
}

function populateQuery(query, paths) {
  paths.forEach((path) => {
    query = query.populate(path);
  });
  return query;
}

function invalidateFinance() {
  cache.delByPrefix('inventory-items:');
  cache.delByPrefix('accounts:');
  cache.delByPrefix('customers:');
  cache.delByPrefix('sales:');
  cache.delByPrefix('sales-returns:');
  cache.delByPrefix('payments:');
  cache.delByPrefix('expenses:');
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function assignNumber(Model, field, prefix, provided, session) {
  const current = String(provided || '').trim();
  if (current) return current;
  return nextSequentialCode(Model, field, prefix, 3, session);
}

function deriveBalances(totalAmount, paidAmount, returnedAmount) {
  const netAmount = roundMoney(totalAmount - returnedAmount);
  const outstandingAmount = roundMoney(netAmount - paidAmount);
  let paymentStatus = 'unpaid';
  if (outstandingAmount < 0) paymentStatus = 'refund-due';
  else if (outstandingAmount === 0 && (netAmount > 0 || paidAmount > 0)) paymentStatus = 'paid';
  else if (paidAmount > 0) paymentStatus = 'partial';
  return { netAmount, outstandingAmount, paymentStatus };
}

function deriveSaleStatus(returnedAmount, totalAmount, currentStatus) {
  if (currentStatus === 'cancelled') return 'cancelled';
  if (returnedAmount <= 0) return 'confirmed';
  if (returnedAmount >= totalAmount) return 'returned';
  return 'partially-returned';
}

async function assertCustomer(customerId, session) {
  const customer = await Customer.findById(customerId).session(session);
  if (!customer) throw new ApiError(400, 'Customer not found');
  if (!customer.isActive) throw new ApiError(400, 'Customer is inactive');
  return customer;
}

async function assertSupplier(supplierId, session) {
  const supplier = await Supplier.findById(supplierId).session(session);
  if (!supplier) throw new ApiError(400, 'Supplier not found');
  if (!supplier.isActive) throw new ApiError(400, 'Supplier is inactive');
  return supplier;
}

async function assertAccount(accountId, session) {
  const account = await Account.findById(accountId).session(session);
  if (!account) throw new ApiError(400, 'Account not found');
  if (!account.isActive) throw new ApiError(400, 'Account is inactive');
  return account;
}

async function assertCategory(categoryId, session) {
  const category = await ExpenseCategory.findById(categoryId).session(session);
  if (!category) throw new ApiError(400, 'ExpenseCategory not found');
  if (!category.isActive) throw new ApiError(400, 'ExpenseCategory is inactive');
  return category;
}

async function changeAccount(accountId, delta, session) {
  await assertAccount(accountId, session);
  if (delta < 0) {
    const updated = await Account.findOneAndUpdate(
      { _id: accountId, currentBalanceAmount: { $gte: -delta } },
      { $inc: { currentBalanceAmount: delta } },
      { new: true, session }
    );
    if (!updated) {
      throw new ApiError(400, 'Account does not have enough balance');
    }
    return updated;
  }
  return Account.findByIdAndUpdate(accountId, { $inc: { currentBalanceAmount: delta } }, { new: true, session });
}

async function changeStock(itemId, delta, session) {
  if (delta < 0) {
    const updated = await InventoryItem.findOneAndUpdate(
      { _id: itemId, isActive: true, currentQuantity: { $gte: -delta } },
      { $inc: { currentQuantity: delta } },
      { new: true, session }
    );
    if (!updated) {
      throw new ApiError(400, 'Not enough stock for one or more sale items');
    }
    return updated;
  }
  const updated = await InventoryItem.findOneAndUpdate(
    { _id: itemId, isActive: true },
    { $inc: { currentQuantity: delta } },
    { new: true, session }
  );
  if (!updated) {
    throw new ApiError(400, 'InventoryItem not found or inactive');
  }
  return updated;
}

async function buildSaleLines(rawLines, session) {
  const lines = [];
  for (const raw of rawLines) {
    const item = await InventoryItem.findById(raw.inventoryItemId)
      .populate('cylinderTypeId', 'sellingPricePerCylinder typeName')
      .session(session);
    if (!item) throw new ApiError(400, 'InventoryItem not found');
    if (!item.isActive) throw new ApiError(400, `Inventory item ${item.itemCode} is inactive`);

    const quantity = raw.quantity;
    const unitPriceAmount = raw.unitPriceAmount ?? item.cylinderTypeId?.sellingPricePerCylinder ?? 0;
    const discountAmount = raw.discountAmount || 0;
    const taxAmount = raw.taxAmount || 0;
    const lineTotalAmount = roundMoney(quantity * unitPriceAmount - discountAmount + taxAmount);
    if (lineTotalAmount < 0) {
      throw new ApiError(400, 'Line total cannot be negative');
    }

    lines.push({
      inventoryItemId: item._id,
      itemDescription: raw.itemDescription || item.itemName,
      quantity,
      unitPriceAmount,
      discountAmount,
      taxAmount,
      lineTotalAmount,
    });
  }
  return lines;
}

function totalsFromLines(lines) {
  const subtotalAmount = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPriceAmount, 0));
  const discountAmount = roundMoney(lines.reduce((sum, line) => sum + line.discountAmount, 0));
  const taxAmount = roundMoney(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const totalAmount = roundMoney(subtotalAmount - discountAmount + taxAmount);
  return { subtotalAmount, discountAmount, taxAmount, totalAmount };
}

async function assertCreditLimit(customer, extraAmount, session, excludeSaleId) {
  if (!customer.creditLimitAmount) return;
  const match = { customerId: customer._id, saleStatus: { $ne: 'cancelled' } };
  if (excludeSaleId) match._id = { $ne: excludeSaleId };
  const [row] = await Sale.aggregate([
    { $match: match },
    { $group: { _id: null, outstanding: { $sum: '$outstandingAmount' } } },
  ]).session(session);
  const current = row?.outstanding || 0;
  if (current + extraAmount > customer.creditLimitAmount) {
    throw new ApiError(400, 'Customer credit limit exceeded');
  }
}

async function applySalePayment(sale, paidDelta, session) {
  const paidAmount = roundMoney(sale.paidAmount + paidDelta);
  if (paidAmount < 0) {
    throw new ApiError(400, 'Paid amount cannot be negative');
  }
  const balances = deriveBalances(sale.totalAmount, paidAmount, sale.returnedAmount);
  sale.paidAmount = paidAmount;
  sale.outstandingAmount = balances.outstandingAmount;
  sale.paymentStatus = balances.paymentStatus;
  await sale.save({ session });
  return sale;
}

async function getSaleById(id) {
  const doc = await populateQuery(Sale.findById(id), SALE_POPULATE);
  if (!doc) throw new ApiError(404, 'Sale not found');
  return doc;
}

async function getReturnById(id) {
  const doc = await populateQuery(SalesReturn.findById(id), RETURN_POPULATE);
  if (!doc) throw new ApiError(404, 'SalesReturn not found');
  return doc;
}

async function getPaymentById(id) {
  const doc = await populateQuery(Payment.findById(id), PAYMENT_POPULATE);
  if (!doc) throw new ApiError(404, 'Payment not found');
  return doc;
}

async function getExpenseById(id) {
  const doc = await populateQuery(Expense.findById(id), EXPENSE_POPULATE);
  if (!doc) throw new ApiError(404, 'Expense not found');
  return doc;
}

async function listDocs(Model, filter, populate, sort) {
  return async function list(query) {
    const { page, limit, skip } = parsePagination(query);
    const built = filter(query);
    const findQuery = populateQuery(Model.find(built).sort(sort).skip(skip).limit(limit), populate);
    const [items, total] = await Promise.all([findQuery.lean(), Model.countDocuments(built)]);
    return paginated(items, total, page, limit);
  };
}

const listSales = listDocs(
  Sale,
  (query) => {
    const filter = applyDateRange({}, 'invoiceDate', query);
    if (query.customerId) filter.customerId = query.customerId;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.saleStatus) filter.saleStatus = query.saleStatus;
    if (query.search) {
      filter.$or = [{ invoiceNumber: { $regex: query.search, $options: 'i' } }, { remarks: { $regex: query.search, $options: 'i' } }];
    }
    return filter;
  },
  SALE_POPULATE,
  { invoiceDate: -1, createdAt: -1 }
);

const listReturns = listDocs(
  SalesReturn,
  (query) => {
    const filter = applyDateRange({}, 'returnDate', query);
    if (query.customerId) filter.customerId = query.customerId;
    if (query.originalSaleId) filter.originalSaleId = query.originalSaleId;
    if (query.search) {
      filter.$or = [{ returnNumber: { $regex: query.search, $options: 'i' } }, { returnReason: { $regex: query.search, $options: 'i' } }];
    }
    return filter;
  },
  RETURN_POPULATE,
  { returnDate: -1, createdAt: -1 }
);

const listPayments = listDocs(
  Payment,
  (query) => {
    const filter = applyDateRange({}, 'paymentDate', query);
    if (query.customerId) filter.customerId = query.customerId;
    if (query.supplierId) filter.supplierId = query.supplierId;
    if (query.saleId) filter.saleId = query.saleId;
    if (query.accountId) filter.accountId = query.accountId;
    if (query.paymentType) filter.paymentType = query.paymentType;
    if (query.search) {
      filter.$or = [
        { paymentNumber: { $regex: query.search, $options: 'i' } },
        { referenceNumber: { $regex: query.search, $options: 'i' } },
      ];
    }
    return filter;
  },
  PAYMENT_POPULATE,
  { paymentDate: -1, createdAt: -1 }
);

const listExpenses = listDocs(
  Expense,
  (query) => {
    const filter = applyDateRange({}, 'expenseDate', query);
    if (query.expenseCategoryId) filter.expenseCategoryId = query.expenseCategoryId;
    if (query.paidFromAccountId) filter.paidFromAccountId = query.paidFromAccountId;
    if (query.search) {
      filter.$or = [
        { expenseNumber: { $regex: query.search, $options: 'i' } },
        { expenseDescription: { $regex: query.search, $options: 'i' } },
      ];
    }
    return filter;
  },
  EXPENSE_POPULATE,
  { expenseDate: -1, createdAt: -1 }
);

async function createSale(body, req) {
  const result = await withTransaction(async (session) => {
    const customer = await assertCustomer(body.customerId, session);
    const lineItems = await buildSaleLines(body.lineItems, session);
    const totals = totalsFromLines(lineItems);
    await assertCreditLimit(customer, totals.totalAmount, session);

    for (const line of lineItems) {
      await changeStock(line.inventoryItemId, -line.quantity, session);
    }

    let paidAmount = 0;
    const balances = deriveBalances(totals.totalAmount, paidAmount, 0);
    const invoiceNumber = await assignNumber(Sale, 'invoiceNumber', 'INV', body.invoiceNumber, session);
    const [sale] = await Sale.create(
      [
        {
          invoiceNumber,
          customerId: customer._id,
          invoiceDate: body.invoiceDate || new Date(),
          lineItems,
          ...totals,
          paidAmount,
          returnedAmount: 0,
          outstandingAmount: balances.outstandingAmount,
          paymentStatus: balances.paymentStatus,
          saleStatus: 'confirmed',
          createdByUserId: req.user._id,
          remarks: body.remarks || '',
        },
      ],
      { session }
    );

    if (body.payment) {
      if (body.payment.paymentAmount > sale.totalAmount) {
        throw new ApiError(400, 'Payment cannot exceed sale total');
      }
      await changeAccount(body.payment.accountId, body.payment.paymentAmount, session);
      const paymentNumber = await assignNumber(Payment, 'paymentNumber', 'PAY', null, session);
      await Payment.create(
        [
          {
            paymentNumber,
            paymentType: 'receive',
            customerId: customer._id,
            saleId: sale._id,
            accountId: body.payment.accountId,
            paymentAmount: body.payment.paymentAmount,
            paymentMethod: body.payment.paymentMethod || 'cash',
            paymentDate: body.invoiceDate || new Date(),
            referenceNumber: body.payment.referenceNumber || '',
            receivedOrPaidByUserId: req.user._id,
          },
        ],
        { session }
      );
      await applySalePayment(sale, body.payment.paymentAmount, session);
    }

    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'sales',
      entityName: 'Sale',
      entityId: sale._id,
      newValues: { invoiceNumber, totalAmount: sale.totalAmount, paidAmount: sale.paidAmount },
    });

    return sale._id;
  });

  invalidateFinance();
  return getSaleById(result);
}

async function updateSale(id, body, req) {
  const result = await withTransaction(async (session) => {
    const sale = await Sale.findById(id).session(session);
    if (!sale) throw new ApiError(404, 'Sale not found');

    if (body.saleStatus === 'cancelled') {
      if (sale.saleStatus === 'cancelled') {
        throw new ApiError(400, 'Sale is already cancelled');
      }
      if (sale.paidAmount > 0) {
        throw new ApiError(400, 'Cannot cancel a sale that has payments');
      }
      if (sale.returnedAmount > 0) {
        throw new ApiError(400, 'Cannot cancel a sale that has returns');
      }
      for (const line of sale.lineItems) {
        await changeStock(line.inventoryItemId, line.quantity, session);
      }
      sale.saleStatus = 'cancelled';
      sale.outstandingAmount = 0;
      sale.paymentStatus = 'unpaid';
    }

    if (body.remarks !== undefined) {
      sale.remarks = body.remarks;
    }
    await sale.save({ session });
    await writeAudit({
      req,
      session,
      actionName: 'update',
      moduleName: 'sales',
      entityName: 'Sale',
      entityId: sale._id,
      newValues: body,
    });
    return sale._id;
  });

  invalidateFinance();
  return getSaleById(result);
}

async function soldQtyByItem(sale) {
  const map = new Map();
  for (const line of sale.lineItems) {
    const key = String(line.inventoryItemId);
    map.set(key, (map.get(key) || 0) + line.quantity);
  }
  return map;
}

async function returnedQtyByItem(saleId, session) {
  const returns = await SalesReturn.find({ originalSaleId: saleId }).session(session);
  const map = new Map();
  for (const doc of returns) {
    for (const line of doc.returnItems) {
      const key = String(line.inventoryItemId);
      map.set(key, (map.get(key) || 0) + line.quantity);
    }
  }
  return map;
}

async function createReturn(body, req) {
  const result = await withTransaction(async (session) => {
    const sale = await Sale.findById(body.originalSaleId).session(session);
    if (!sale) throw new ApiError(400, 'Original sale not found');
    if (sale.saleStatus === 'cancelled') {
      throw new ApiError(400, 'Cannot return a cancelled sale');
    }
    const customerId = body.customerId || sale.customerId;
    if (String(customerId) !== String(sale.customerId)) {
      throw new ApiError(400, 'customerId does not match the original sale');
    }
    await assertCustomer(customerId, session);

    const sold = await soldQtyByItem(sale);
    const already = await returnedQtyByItem(sale._id, session);
    const returnItems = [];

    for (const raw of body.returnItems) {
      const key = String(raw.inventoryItemId);
      const soldQty = sold.get(key) || 0;
      const returnedQty = already.get(key) || 0;
      if (raw.quantity > soldQty - returnedQty) {
        throw new ApiError(400, 'Return quantity exceeds sold quantity for an item');
      }
      const saleLine = sale.lineItems.find((line) => String(line.inventoryItemId) === key);
      const unitPriceAmount = saleLine?.unitPriceAmount || 0;
      returnItems.push({
        inventoryItemId: raw.inventoryItemId,
        quantity: raw.quantity,
        unitPriceAmount,
        lineTotalAmount: roundMoney(raw.quantity * unitPriceAmount),
      });
      await changeStock(raw.inventoryItemId, raw.quantity, session);
    }

    const totalReturnAmount = roundMoney(returnItems.reduce((sum, line) => sum + line.lineTotalAmount, 0));
    const returnNumber = await assignNumber(SalesReturn, 'returnNumber', 'RTN', body.returnNumber, session);
    const [doc] = await SalesReturn.create(
      [
        {
          returnNumber,
          customerId,
          originalSaleId: sale._id,
          returnDate: body.returnDate || new Date(),
          returnItems,
          totalReturnAmount,
          returnReason: body.returnReason || '',
          processedByUserId: req.user._id,
        },
      ],
      { session }
    );

    sale.returnedAmount = roundMoney(sale.returnedAmount + totalReturnAmount);
    const balances = deriveBalances(sale.totalAmount, sale.paidAmount, sale.returnedAmount);
    sale.outstandingAmount = balances.outstandingAmount;
    sale.paymentStatus = balances.paymentStatus;
    sale.saleStatus = deriveSaleStatus(sale.returnedAmount, sale.totalAmount, sale.saleStatus);
    await sale.save({ session });

    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'sales-returns',
      entityName: 'SalesReturn',
      entityId: doc._id,
      newValues: { returnNumber, totalReturnAmount, originalSaleId: sale._id },
    });

    return doc._id;
  });

  invalidateFinance();
  return getReturnById(result);
}

async function createPayment(body, req) {
  const result = await withTransaction(async (session) => {
    const paymentType = body.paymentType;
    let customerId = body.customerId || null;
    let supplierId = body.supplierId || null;
    let sale = null;

    if (body.saleId) {
      sale = await Sale.findById(body.saleId).session(session);
      if (!sale) throw new ApiError(400, 'Sale not found');
      if (sale.saleStatus === 'cancelled') throw new ApiError(400, 'Cannot pay a cancelled sale');
      customerId = customerId || sale.customerId;
      if (String(customerId) !== String(sale.customerId)) {
        throw new ApiError(400, 'customerId does not match the sale');
      }
    }

    if (customerId) await assertCustomer(customerId, session);
    if (supplierId) await assertSupplier(supplierId, session);
    await assertAccount(body.accountId, session);

    if (paymentType === 'receive') {
      if (sale) {
        const maxPay = sale.outstandingAmount;
        if (maxPay <= 0) throw new ApiError(400, 'Sale has no outstanding amount');
        if (body.paymentAmount > maxPay) {
          throw new ApiError(400, 'Payment exceeds sale outstanding amount');
        }
      }
      await changeAccount(body.accountId, body.paymentAmount, session);
      if (sale) await applySalePayment(sale, body.paymentAmount, session);
    } else if (paymentType === 'refund') {
      if (!sale) throw new ApiError(400, 'saleId is required for refund');
      if (body.paymentAmount > sale.paidAmount) {
        throw new ApiError(400, 'Refund exceeds paid amount');
      }
      await changeAccount(body.accountId, -body.paymentAmount, session);
      if (sale) await applySalePayment(sale, -body.paymentAmount, session);
    } else if (paymentType === 'pay') {
      await changeAccount(body.accountId, -body.paymentAmount, session);
    }

    const paymentNumber = await assignNumber(Payment, 'paymentNumber', 'PAY', body.paymentNumber, session);
    const [doc] = await Payment.create(
      [
        {
          paymentNumber,
          paymentType,
          customerId,
          supplierId,
          saleId: sale?._id || null,
          accountId: body.accountId,
          paymentAmount: body.paymentAmount,
          paymentMethod: body.paymentMethod || 'cash',
          paymentDate: body.paymentDate || new Date(),
          referenceNumber: body.referenceNumber || '',
          remarks: body.remarks || '',
          receivedOrPaidByUserId: req.user._id,
        },
      ],
      { session }
    );

    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'payments',
      entityName: 'Payment',
      entityId: doc._id,
      newValues: { paymentNumber, paymentType, paymentAmount: body.paymentAmount },
    });

    return doc._id;
  });

  invalidateFinance();
  return getPaymentById(result);
}

async function createExpense(body, req) {
  const result = await withTransaction(async (session) => {
    await assertCategory(body.expenseCategoryId, session);
    await changeAccount(body.paidFromAccountId, -body.expenseAmount, session);
    const expenseNumber = await assignNumber(Expense, 'expenseNumber', 'EXP', body.expenseNumber, session);
    const [doc] = await Expense.create(
      [
        {
          expenseNumber,
          expenseCategoryId: body.expenseCategoryId,
          paidFromAccountId: body.paidFromAccountId,
          expenseAmount: body.expenseAmount,
          expenseDescription: body.expenseDescription,
          expenseDate: body.expenseDate || new Date(),
          paymentMethod: body.paymentMethod || 'cash',
          remarks: body.remarks || '',
          recordedByUserId: req.user._id,
          approvedByUserId: req.user._id,
        },
      ],
      { session }
    );
    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'expenses',
      entityName: 'Expense',
      entityId: doc._id,
      newValues: { expenseNumber, expenseAmount: body.expenseAmount },
    });
    return doc._id;
  });

  invalidateFinance();
  return getExpenseById(result);
}

async function updateExpense(id, body, req) {
  const result = await withTransaction(async (session) => {
    const expense = await Expense.findById(id).session(session);
    if (!expense) throw new ApiError(404, 'Expense not found');

    if (body.expenseCategoryId) {
      await assertCategory(body.expenseCategoryId, session);
      expense.expenseCategoryId = body.expenseCategoryId;
    }

    const nextAccountId = body.paidFromAccountId || expense.paidFromAccountId;
    const nextAmount = body.expenseAmount ?? expense.expenseAmount;
    const accountChanged = String(nextAccountId) !== String(expense.paidFromAccountId);
    const amountChanged = nextAmount !== expense.expenseAmount;

    if (accountChanged || amountChanged) {
      await changeAccount(expense.paidFromAccountId, expense.expenseAmount, session);
      await changeAccount(nextAccountId, -nextAmount, session);
      expense.paidFromAccountId = nextAccountId;
      expense.expenseAmount = nextAmount;
    }

    if (body.expenseDescription !== undefined) expense.expenseDescription = body.expenseDescription;
    if (body.expenseDate !== undefined) expense.expenseDate = body.expenseDate;
    if (body.paymentMethod !== undefined) expense.paymentMethod = body.paymentMethod;
    if (body.remarks !== undefined) expense.remarks = body.remarks;
    await expense.save({ session });

    await writeAudit({
      req,
      session,
      actionName: 'update',
      moduleName: 'expenses',
      entityName: 'Expense',
      entityId: expense._id,
      newValues: body,
    });
    return expense._id;
  });

  invalidateFinance();
  return getExpenseById(result);
}

async function removeExpense(id, req) {
  await withTransaction(async (session) => {
    const expense = await Expense.findById(id).session(session);
    if (!expense) throw new ApiError(404, 'Expense not found');
    await changeAccount(expense.paidFromAccountId, expense.expenseAmount, session);
    await expense.deleteOne({ session });
    await writeAudit({
      req,
      session,
      actionName: 'delete',
      moduleName: 'expenses',
      entityName: 'Expense',
      entityId: id,
      oldValues: { expenseNumber: expense.expenseNumber, expenseAmount: expense.expenseAmount },
    });
  });
  invalidateFinance();
}

const sale = { create: createSale, list: listSales, getById: getSaleById, update: updateSale };
const salesReturn = { create: createReturn, list: listReturns, getById: getReturnById };
const payment = { create: createPayment, list: listPayments, getById: getPaymentById };
const expense = {
  create: createExpense,
  list: listExpenses,
  getById: getExpenseById,
  update: updateExpense,
  remove: removeExpense,
};

module.exports = { sale, salesReturn, payment, expense };
