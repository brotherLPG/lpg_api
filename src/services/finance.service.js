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
  LPGReceipt,
} = require('../models');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { nextSequentialCode } = require('../utils/nextCode');
const { writeAudit } = require('./audit.service');
const {
  PAYMENT_TERMS,
  SALE_TYPES,
  SALE_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  GST_TAX_RATE,
  RETURN_REASONS,
  RETURN_ACTION_TYPE,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_DIRECTIONS,
  PAYMENT_DIRECTION_OPTIONS,
  PAYMENT_VOUCHER_STATUSES,
  EXPENSE_STATUSES,
} = require('../constants/masters');

const SALE_POPULATE = [
  { path: 'customerId', select: 'customerCode customerName phoneNumber creditLimitAmount paymentTermDays isActive' },
  { path: 'createdByUserId', select: 'fullName emailAddress' },
  { path: 'lineItems.inventoryItemId', select: 'itemCode itemName itemCategory unitOfMeasure currentQuantity unitSellingPriceAmount' },
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
  { path: 'allocations.saleId', select: 'invoiceNumber totalAmount paidAmount outstandingAmount paymentStatus' },
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
  const startDate = query.startDate || query.fromDate || query.dateFrom;
  const endDate = query.endDate || query.toDate || query.dateTo;
  if (!startDate && !endDate) return filter;
  filter[field] = {};
  if (startDate) filter[field].$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0) {
      end.setHours(23, 59, 59, 999);
    }
    filter[field].$lte = end;
  }
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
      .populate('cylinderTypeId', 'sellingPricePerCylinder refillPriceAmount typeName typeCode')
      .session(session);
    if (!item) throw new ApiError(400, 'InventoryItem not found');
    if (!item.isActive) throw new ApiError(400, `Inventory item ${item.itemCode} is inactive`);

    const quantity = raw.quantity;
    const unitPriceAmount = raw.unitPriceAmount ?? defaultUnitPrice(item);
    const discountAmount = raw.discountAmount || 0;
    const taxableAmount = roundMoney(quantity * unitPriceAmount - discountAmount);
    if (taxableAmount < 0) {
      throw new ApiError(400, 'Line total cannot be negative');
    }
    const taxAmount = roundMoney(taxableAmount * GST_TAX_RATE);
    const lineTotalAmount = roundMoney(taxableAmount + taxAmount);

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

function defaultUnitPrice(item) {
  if (item.unitSellingPriceAmount) return item.unitSellingPriceAmount;
  if (item.cylinderTypeId?.sellingPricePerCylinder) return item.cylinderTypeId.sellingPricePerCylinder;
  if (item.cylinderTypeId?.refillPriceAmount) return item.cylinderTypeId.refillPriceAmount;
  return 0;
}

function totalsFromLines(lines, tradeDiscountAmount = 0) {
  const subtotalAmount = roundMoney(
    lines.reduce((sum, line) => sum + (line.quantity * line.unitPriceAmount - (line.discountAmount || 0)), 0)
  );
  const lineDiscountAmount = roundMoney(lines.reduce((sum, line) => sum + (line.discountAmount || 0), 0));
  const tradeDiscount = roundMoney(tradeDiscountAmount || 0);
  if (tradeDiscount > subtotalAmount) {
    throw new ApiError(400, 'Trade discount cannot exceed subtotal');
  }
  const taxableAmount = roundMoney(subtotalAmount - tradeDiscount);
  const taxAmount = roundMoney(taxableAmount * GST_TAX_RATE);
  const totalAmount = roundMoney(taxableAmount + taxAmount);
  return {
    subtotalAmount,
    discountAmount: lineDiscountAmount,
    tradeDiscountAmount: tradeDiscount,
    taxAmount,
    totalAmount,
  };
}

function paymentStatusLabel(status) {
  return PAYMENT_STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function saleStatusLabel(status) {
  return SALE_STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function saleTypeOf(sale) {
  if (sale.saleType === 'cash' || sale.saleType === 'credit') return sale.saleType;
  return (sale.outstandingAmount || 0) > 0 ? 'credit' : 'cash';
}

function itemQuantityOf(sale) {
  return (sale.lineItems || []).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
}

function toSaleItem(sale) {
  const customer = sale.customerId && typeof sale.customerId === 'object' ? sale.customerId : null;
  const saleType = saleTypeOf(sale);
  const lineItems = (sale.lineItems || []).map((line) => {
    const item = line.inventoryItemId && typeof line.inventoryItemId === 'object' ? line.inventoryItemId : null;
    return {
      _id: line._id,
      inventoryItemId: item?._id || line.inventoryItemId,
      itemCode: item?.itemCode || '',
      itemName: item?.itemName || line.itemDescription || '',
      itemDescription: line.itemDescription || item?.itemName || '',
      quantity: line.quantity,
      unitPriceAmount: roundMoney(line.unitPriceAmount),
      discountAmount: roundMoney(line.discountAmount),
      taxRatePercent: Math.round(GST_TAX_RATE * 100),
      taxAmount: roundMoney(line.taxAmount),
      lineTotalAmount: roundMoney(line.lineTotalAmount),
    };
  });

  return {
    _id: sale._id,
    saleNumber: sale.saleNumber || sale.invoiceNumber,
    invoiceNumber: sale.invoiceNumber,
    customerId: customer?._id || sale.customerId,
    customerName: customer?.customerName || '',
    customerCode: customer?.customerCode || '',
    invoiceDate: sale.invoiceDate,
    saleType,
    type: saleType,
    saleTypeLabel: SALE_TYPES.find((item) => item.value === saleType)?.label || saleType,
    paymentTermDays: sale.paymentTermDays ?? customer?.paymentTermDays ?? 0,
    lineItems,
    itemCount: lineItems.length,
    itemQuantity: itemQuantityOf(sale),
    items: itemQuantityOf(sale),
    subtotalAmount: roundMoney(sale.subtotalAmount),
    discountAmount: roundMoney(sale.discountAmount),
    tradeDiscountAmount: roundMoney(sale.tradeDiscountAmount),
    taxAmount: roundMoney(sale.taxAmount),
    taxRate: GST_TAX_RATE,
    taxRatePercent: Math.round(GST_TAX_RATE * 100),
    totalAmount: roundMoney(sale.totalAmount),
    amount: roundMoney(sale.totalAmount),
    paidAmount: roundMoney(sale.paidAmount),
    returnedAmount: roundMoney(sale.returnedAmount),
    outstandingAmount: roundMoney(sale.outstandingAmount),
    paymentStatus: sale.paymentStatus,
    paymentStatusLabel: paymentStatusLabel(sale.paymentStatus),
    saleStatus: sale.saleStatus,
    saleStatusLabel: saleStatusLabel(sale.saleStatus),
    remarks: sale.remarks || '',
    internalRemarks: sale.remarks || '',
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
  };
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { $gte: start, $lt: end };
}

function activeSaleMatch() {
  return { saleStatus: { $nin: ['cancelled', 'draft'] } };
}

async function nextInvoiceNumber(session) {
  const year = new Date().getFullYear();
  return nextSequentialCode(Sale, 'invoiceNumber', `INV-${year}`, 4, session);
}

async function resolveReceiveAccount(accountId, session) {
  if (accountId) {
    return assertAccount(accountId, session);
  }
  const primary = await Account.findOne({
    isPrimary: true,
    isActive: true,
    accountType: { $in: ['cash', 'bank'] },
  }).session(session);
  if (primary) return primary;
  const cash = await Account.findOne({ isActive: true, accountType: 'cash' }).sort({ createdAt: 1 }).session(session);
  if (cash) return cash;
  throw new ApiError(400, 'No cash or bank account is configured to receive payment');
}

async function postSaleReceipt({ sale, customerId, amount, accountId, paymentMethod, paymentDate, referenceNumber, userId }, session) {
  const account = await resolveReceiveAccount(accountId, session);
  await changeAccount(account._id, amount, session);
  const paymentNumber = await assignNumber(Payment, 'paymentNumber', 'PAY', null, session);
  await Payment.create(
    [
      {
        paymentNumber,
        paymentType: 'receive',
        customerId,
        saleId: sale._id,
        accountId: account._id,
        paymentAmount: amount,
        paymentMethod: paymentMethod || 'cash',
        paymentDate: paymentDate || sale.invoiceDate || new Date(),
        referenceNumber: referenceNumber || '',
        receivedOrPaidByUserId: userId,
      },
    ],
    { session }
  );
  return account;
}

async function assertCreditLimit(customer, extraAmount, session, excludeSaleId) {
  if (!customer.creditLimitAmount) return;
  const match = { customerId: customer._id, saleStatus: { $nin: ['cancelled', 'draft'] } };
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
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...toSaleItem(plain),
    form: await getSaleFormOptions({ id }),
  };
}

async function getReturnById(id) {
  const doc = await populateQuery(SalesReturn.findById(id), RETURN_POPULATE);
  if (!doc) throw new ApiError(404, 'SalesReturn not found');
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...toReturnItem(plain),
    form: await getReturnFormOptions(),
  };
}

async function getPaymentById(id) {
  const doc = await populateQuery(Payment.findById(id), PAYMENT_POPULATE);
  if (!doc) throw new ApiError(404, 'Payment not found');
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const mapped = toPaymentItem(plain);
  return {
    ...mapped,
    form: await getPaymentFormOptions({
      customerId: mapped.customerId || undefined,
      supplierId: mapped.supplierId || undefined,
      paymentType: mapped.paymentType,
    }),
  };
}

async function getExpenseById(id) {
  const doc = await populateQuery(Expense.findById(id), EXPENSE_POPULATE);
  if (!doc) throw new ApiError(404, 'Expense not found');
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    ...toExpenseItem(plain),
    form: await getExpenseFormOptions(),
  };
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

async function buildSaleListFilter(query) {
  const filter = applyDateRange({}, 'invoiceDate', query);
  if (query.customerId) filter.customerId = query.customerId;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  if (query.saleStatus) filter.saleStatus = query.saleStatus;
  const saleType = query.saleType || query.type;
  if (saleType) filter.saleType = saleType;

  if (query.search) {
    const regex = { $regex: query.search.trim(), $options: 'i' };
    const customers = await Customer.find({
      $or: [{ customerName: regex }, { customerCode: regex }],
    }).select('_id');
    filter.$or = [
      { invoiceNumber: regex },
      { saleNumber: regex },
      { remarks: regex },
      { customerId: { $in: customers.map((item) => item._id) } },
    ];
  }
  return filter;
}

async function salesSummary() {
  const todayMatch = { ...activeSaleMatch(), invoiceDate: todayRange() };
  const [todayRows, pending] = await Promise.all([
    Sale.aggregate([
      { $match: todayMatch },
      {
        $addFields: {
          resolvedType: {
            $ifNull: [
              '$saleType',
              { $cond: [{ $gt: ['$outstandingAmount', 0] }, 'credit', 'cash'] },
            ],
          },
        },
      },
      {
        $group: {
          _id: '$resolvedType',
          amount: { $sum: '$totalAmount' },
          count: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate([
      { $match: { ...activeSaleMatch(), outstandingAmount: { $gt: 0 } } },
      { $group: { _id: null, amount: { $sum: '$outstandingAmount' } } },
    ]),
  ]);

  const cash = todayRows.find((row) => row._id === 'cash') || { amount: 0, count: 0 };
  const credit = todayRows.find((row) => row._id === 'credit') || { amount: 0, count: 0 };

  return {
    todaySalesAmount: roundMoney((cash.amount || 0) + (credit.amount || 0)),
    todaySalesCount: (cash.count || 0) + (credit.count || 0),
    cashSalesAmount: roundMoney(cash.amount),
    cashSalesCount: cash.count || 0,
    creditSalesAmount: roundMoney(credit.amount),
    creditSalesCount: credit.count || 0,
    pendingCreditAmount: roundMoney(pending[0]?.amount),
  };
}

async function listSales(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = await buildSaleListFilter(query);
  const findQuery = populateQuery(
    Sale.find(filter).sort({ invoiceDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    SALE_POPULATE
  );
  const [items, total, summary] = await Promise.all([
    findQuery.lean(),
    Sale.countDocuments(filter),
    salesSummary(),
  ]);

  return {
    ...paginated(items.map(toSaleItem), total, page, limit),
    summary,
    meta: {
      saleTypes: SALE_TYPES,
      paymentStatuses: PAYMENT_STATUS_OPTIONS,
      saleStatuses: SALE_STATUS_OPTIONS,
    },
  };
}

async function getSaleFormOptions() {
  const [nextSaleNumber, nextInvoice, customers, inventoryItems, accounts] = await Promise.all([
    nextSequentialCode(Sale, 'saleNumber', 'SAL', 3),
    nextInvoiceNumber(),
    Customer.find({ isActive: true })
      .select('customerCode customerName phoneNumber paymentTermDays creditLimitAmount')
      .sort({ customerName: 1 })
      .lean(),
    InventoryItem.find({ isActive: true })
      .populate('cylinderTypeId', 'sellingPricePerCylinder refillPriceAmount typeName typeCode capacityKg')
      .select('itemCode itemName itemCategory unitOfMeasure currentQuantity unitSellingPriceAmount cylinderTypeId')
      .sort({ itemName: 1 })
      .lean(),
    Account.find({ isActive: true, accountType: { $in: ['cash', 'bank'] } })
      .select('accountCode accountName accountType isPrimary currentBalanceAmount')
      .sort({ isPrimary: -1, accountName: 1 })
      .lean(),
  ]);

  return {
    nextSaleNumber,
    nextInvoiceNumber: nextInvoice,
    taxRate: GST_TAX_RATE,
    taxRatePercent: Math.round(GST_TAX_RATE * 100),
    defaultPaymentTermDays: 0,
    paymentTerms: PAYMENT_TERMS,
    saleTypes: SALE_TYPES,
    customers: customers.map((customer) => ({
      _id: customer._id,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      phoneNumber: customer.phoneNumber || '',
      paymentTermDays: customer.paymentTermDays || 0,
      creditLimitAmount: customer.creditLimitAmount || 0,
      label: `${customer.customerCode} – ${customer.customerName}`,
    })),
    inventoryItems: inventoryItems.map((item) => ({
      _id: item._id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemCategory: item.itemCategory,
      unitOfMeasure: item.unitOfMeasure,
      currentQuantity: item.currentQuantity || 0,
      unitPriceAmount: roundMoney(defaultUnitPrice(item)),
      label: `${item.itemCode} – ${item.itemName}`,
    })),
    accounts: accounts.map((account) => ({
      _id: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      isPrimary: Boolean(account.isPrimary),
      label: `${account.accountCode} – ${account.accountName}`,
    })),
  };
}

async function nextReturnNumber(session) {
  const year = new Date().getFullYear();
  return nextSequentialCode(SalesReturn, 'returnNumber', `RET-${year}`, 4, session);
}

function returnReasonLabel(value) {
  return RETURN_REASONS.find((item) => item.value === value)?.label || value || '';
}

function toReturnItem(doc) {
  const customer = doc.customerId && typeof doc.customerId === 'object' ? doc.customerId : null;
  const sale = doc.originalSaleId && typeof doc.originalSaleId === 'object' ? doc.originalSaleId : null;
  const returnItems = (doc.returnItems || []).map((line) => {
    const item = line.inventoryItemId && typeof line.inventoryItemId === 'object' ? line.inventoryItemId : null;
    return {
      _id: line._id,
      inventoryItemId: item?._id || line.inventoryItemId,
      itemCode: item?.itemCode || '',
      itemName: item?.itemName || '',
      quantity: line.quantity,
      unitPriceAmount: roundMoney(line.unitPriceAmount),
      lineTotalAmount: roundMoney(line.lineTotalAmount),
    };
  });

  return {
    _id: doc._id,
    returnNumber: doc.returnNumber,
    customerId: customer?._id || doc.customerId,
    customerName: customer?.customerName || '',
    customerCode: customer?.customerCode || '',
    originalSaleId: sale?._id || doc.originalSaleId,
    originalInvoiceNumber: sale?.invoiceNumber || '',
    returnDate: doc.returnDate,
    returnReason: doc.returnReason || '',
    returnReasonLabel: returnReasonLabel(doc.returnReason),
    inspectionNotes: doc.inspectionNotes || '',
    adjustmentType: doc.adjustmentType || RETURN_ACTION_TYPE.value,
    adjustmentTypeLabel: RETURN_ACTION_TYPE.label,
    returnItems,
    itemCount: returnItems.length,
    itemQuantity: returnItems.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    totalReturnAmount: roundMoney(doc.totalReturnAmount),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function findOriginalSale({ originalSaleId, originalInvoiceNumber }, session) {
  let query = null;
  if (originalSaleId) {
    query = Sale.findById(originalSaleId);
  } else if (originalInvoiceNumber) {
    query = Sale.findOne({
      invoiceNumber: { $regex: `^${String(originalInvoiceNumber).trim()}$`, $options: 'i' },
    });
  }
  if (query && session) query = query.session(session);
  const sale = query ? await query : null;
  if (!sale) throw new ApiError(400, 'Original sale invoice not found');
  if (sale.saleStatus === 'cancelled' || sale.saleStatus === 'draft') {
    throw new ApiError(400, 'Cannot return a cancelled or draft sale');
  }
  return sale;
}

async function originalSalePreview(sale) {
  await sale.populate([
    { path: 'customerId', select: 'customerCode customerName phoneNumber' },
    { path: 'lineItems.inventoryItemId', select: 'itemCode itemName itemCategory unitOfMeasure' },
  ]);
  const already = await returnedQtyByItem(sale._id);
  const customer = sale.customerId && sale.customerId.customerName ? sale.customerId : null;
  const lineItems = (sale.lineItems || []).map((line) => {
    const item = line.inventoryItemId && line.inventoryItemId.itemName ? line.inventoryItemId : null;
    const originalQuantity = line.quantity;
    const alreadyReturnedQuantity = already.get(String(item?._id || line.inventoryItemId)) || 0;
    const remainingQuantity = roundMoney(originalQuantity - alreadyReturnedQuantity);
    return {
      inventoryItemId: item?._id || line.inventoryItemId,
      itemCode: item?.itemCode || '',
      itemName: item?.itemName || line.itemDescription || '',
      originalQuantity,
      alreadyReturnedQuantity,
      remainingQuantity,
      unitPriceAmount: roundMoney(line.unitPriceAmount),
      originalLineTotalAmount: roundMoney(line.lineTotalAmount),
    };
  });

  return {
    _id: sale._id,
    saleNumber: sale.saleNumber || sale.invoiceNumber,
    invoiceNumber: sale.invoiceNumber,
    invoiceDate: sale.invoiceDate,
    customerId: customer?._id || sale.customerId,
    customerName: customer?.customerName || '',
    customerCode: customer?.customerCode || '',
    totalAmount: roundMoney(sale.totalAmount),
    paidAmount: roundMoney(sale.paidAmount),
    outstandingAmount: roundMoney(sale.outstandingAmount),
    itemCount: lineItems.length,
    lineItems,
  };
}

async function listReturns(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'returnDate', query);
  if (query.customerId) filter.customerId = query.customerId;
  if (query.originalSaleId) filter.originalSaleId = query.originalSaleId;

  if (query.search) {
    const regex = { $regex: query.search.trim(), $options: 'i' };
    const [customers, sales] = await Promise.all([
      Customer.find({ $or: [{ customerName: regex }, { customerCode: regex }] }).select('_id'),
      Sale.find({ invoiceNumber: regex }).select('_id'),
    ]);
    filter.$or = [
      { returnNumber: regex },
      { returnReason: regex },
      { inspectionNotes: regex },
      { customerId: { $in: customers.map((item) => item._id) } },
      { originalSaleId: { $in: sales.map((item) => item._id) } },
    ];
  }

  const findQuery = populateQuery(
    SalesReturn.find(filter).sort({ returnDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    RETURN_POPULATE
  );
  const [items, total] = await Promise.all([
    findQuery.lean(),
    SalesReturn.countDocuments(filter),
  ]);

  return {
    ...paginated(items.map(toReturnItem), total, page, limit),
    meta: {
      returnReasons: RETURN_REASONS,
      actionType: RETURN_ACTION_TYPE,
    },
  };
}

async function getReturnFormOptions(query = {}) {
  const customerFilter = { isActive: true };
  const [nextNumber, customers] = await Promise.all([
    nextReturnNumber(),
    Customer.find(customerFilter)
      .select('customerCode customerName phoneNumber')
      .sort({ customerName: 1 })
      .lean(),
  ]);

  const invoiceFilter = { saleStatus: { $nin: ['draft', 'cancelled'] } };
  if (query.customerId) invoiceFilter.customerId = query.customerId;

  const invoices = query.customerId
    ? await Sale.find(invoiceFilter)
      .populate('customerId', 'customerCode customerName')
      .select('invoiceNumber saleNumber invoiceDate totalAmount customerId saleStatus')
      .sort({ invoiceDate: -1 })
      .limit(50)
      .lean()
    : [];

  let originalSale = null;
  let invoiceError = null;
  if (query.invoiceNumber || query.originalSaleId) {
    try {
      const sale = await findOriginalSale({
        originalSaleId: query.originalSaleId,
        originalInvoiceNumber: query.invoiceNumber,
      });
      originalSale = await originalSalePreview(sale);
    } catch (error) {
      invoiceError = error.message || 'Original sale invoice not found';
    }
  }

  return {
    nextReturnNumber: nextNumber,
    returnReasons: RETURN_REASONS,
    actionType: RETURN_ACTION_TYPE,
    customers: customers.map((customer) => ({
      _id: customer._id,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      phoneNumber: customer.phoneNumber || '',
      label: `${customer.customerCode} – ${customer.customerName}`,
    })),
    invoices: invoices.map((sale) => ({
      _id: sale._id,
      invoiceNumber: sale.invoiceNumber,
      saleNumber: sale.saleNumber || sale.invoiceNumber,
      invoiceDate: sale.invoiceDate,
      totalAmount: roundMoney(sale.totalAmount),
      customerId: sale.customerId?._id || sale.customerId,
      customerName: sale.customerId?.customerName || '',
      label: `${sale.invoiceNumber} – ${sale.customerId?.customerName || ''}`.trim(),
    })),
    originalSale,
    invoiceError,
  };
}

function formatRs(value) {
  return `Rs. ${roundMoney(value).toLocaleString('en-US')}`;
}

function paymentTypeOf(body) {
  return body.paymentType || body.direction;
}

function paymentAllocationsOf(doc) {
  if (Array.isArray(doc.allocations) && doc.allocations.length) {
    return doc.allocations;
  }
  if (doc.saleId) {
    return [{ saleId: doc.saleId, amountApplied: doc.paymentAmount }];
  }
  return [];
}

function normalizeAllocations(body) {
  if (Array.isArray(body.allocations) && body.allocations.length) {
    return body.allocations
      .filter((item) => item.saleId && Number(item.amountApplied) > 0)
      .map((item) => ({
        saleId: item.saleId,
        amountApplied: roundMoney(item.amountApplied),
      }));
  }
  if (body.saleId) {
    return [{ saleId: body.saleId, amountApplied: roundMoney(body.paymentAmount) }];
  }
  return [];
}

function paymentMethodLabel(value) {
  return PAYMENT_METHOD_OPTIONS.find((item) => item.value === value)?.label || value;
}

function paymentDirectionLabel(value) {
  return PAYMENT_DIRECTIONS.find((item) => item.value === value)?.label || value;
}

function paymentVoucherStatusLabel(value) {
  return PAYMENT_VOUCHER_STATUSES.find((item) => item.value === value)?.label || value || 'Recorded';
}

function toPaymentItem(doc) {
  const customer = doc.customerId && typeof doc.customerId === 'object' ? doc.customerId : null;
  const supplier = doc.supplierId && typeof doc.supplierId === 'object' ? doc.supplierId : null;
  const account = doc.accountId && typeof doc.accountId === 'object' ? doc.accountId : null;
  const paymentType = doc.paymentType;
  const paymentStatus = doc.paymentStatus || 'recorded';
  const allocations = paymentAllocationsOf(doc).map((line) => {
    const sale = line.saleId && typeof line.saleId === 'object' ? line.saleId : null;
    return {
      saleId: sale?._id || line.saleId,
      invoiceNumber: sale?.invoiceNumber || '',
      amountApplied: roundMoney(line.amountApplied),
      outstandingAmount: sale ? roundMoney(sale.outstandingAmount) : null,
    };
  });

  return {
    _id: doc._id,
    paymentNumber: doc.paymentNumber,
    paymentDate: doc.paymentDate,
    paymentType,
    direction: paymentType === 'pay' ? 'pay' : 'receive',
    directionLabel: paymentDirectionLabel(paymentType === 'refund' ? 'receive' : paymentType),
    customerId: customer?._id || doc.customerId || null,
    supplierId: supplier?._id || doc.supplierId || null,
    partyName: customer?.customerName || supplier?.supplierName || '',
    partyCode: customer?.customerCode || supplier?.supplierCode || '',
    partyType: supplier ? 'supplier' : customer ? 'customer' : null,
    accountId: account?._id || doc.accountId,
    accountName: account ? `${account.accountCode} – ${account.accountName}` : '',
    paymentAmount: roundMoney(doc.paymentAmount),
    paymentMethod: doc.paymentMethod,
    paymentMethodLabel: paymentMethodLabel(doc.paymentMethod),
    paymentStatus,
    paymentStatusLabel: paymentVoucherStatusLabel(paymentStatus),
    referenceNumber: doc.referenceNumber || '',
    remarks: doc.remarks || '',
    allocations,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function nextPaymentNumber(session) {
  const year = new Date().getFullYear();
  return nextSequentialCode(Payment, 'paymentNumber', `PAY-${year}`, 4, session);
}

async function customerLedgerOutstanding(customerId, session) {
  const pipeline = Sale.aggregate([
    { $match: { customerId, saleStatus: { $nin: ['cancelled', 'draft'] } } },
    { $group: { _id: null, outstanding: { $sum: '$outstandingAmount' } } },
  ]);
  if (session) pipeline.session(session);
  const [row] = await pipeline;
  let customerQuery = Customer.findById(customerId).select('openingBalanceAmount');
  if (session) customerQuery = customerQuery.session(session);
  const customer = await customerQuery;
  return roundMoney((row?.outstanding || 0) + (customer?.openingBalanceAmount || 0));
}

async function supplierLedgerOutstanding(supplierId, session) {
  const purchases = LPGReceipt.aggregate([
    { $match: { supplierId, receiptStatus: 'confirmed' } },
    { $group: { _id: null, total: { $sum: '$totalPurchaseAmount' } } },
  ]);
  const paid = Payment.aggregate([
    { $match: { supplierId, paymentType: 'pay', paymentStatus: { $ne: 'pending' } } },
    { $group: { _id: null, total: { $sum: '$paymentAmount' } } },
  ]);
  if (session) {
    purchases.session(session);
    paid.session(session);
  }
  const [[purchaseRow], [paidRow]] = await Promise.all([purchases, paid]);
  let supplierQuery = Supplier.findById(supplierId).select('openingBalanceAmount');
  if (session) supplierQuery = supplierQuery.session(session);
  const supplier = await supplierQuery;
  return roundMoney((supplier?.openingBalanceAmount || 0) + (purchaseRow?.total || 0) - (paidRow?.total || 0));
}

async function outstandingSalesForCustomer(customerId) {
  const sales = await Sale.find({
    customerId,
    saleStatus: { $nin: ['draft', 'cancelled'] },
    outstandingAmount: { $gt: 0 },
  })
    .select('invoiceNumber saleNumber invoiceDate totalAmount outstandingAmount paidAmount')
    .sort({ invoiceDate: 1, createdAt: 1 })
    .lean();

  return sales.map((sale) => ({
    _id: sale._id,
    invoiceNumber: sale.invoiceNumber,
    saleNumber: sale.saleNumber || sale.invoiceNumber,
    invoiceDate: sale.invoiceDate,
    totalAmount: roundMoney(sale.totalAmount),
    outstandingAmount: roundMoney(sale.outstandingAmount),
    paidAmount: roundMoney(sale.paidAmount),
    label: `${sale.invoiceNumber} – Outstanding ${formatRs(sale.outstandingAmount)}`,
  }));
}

function buildAllocationRemarks(allocations, invoices, paymentAmount) {
  if (!allocations.length) {
    return `${formatRs(paymentAmount)} recorded on account`;
  }
  return allocations.map((alloc) => {
    const invoice = invoices.find((item) => String(item._id) === String(alloc.saleId));
    const invoiceNumber = invoice?.invoiceNumber || 'invoice';
    const newBal = invoice ? roundMoney(invoice.outstandingAmount - alloc.amountApplied) : 0;
    return `${formatRs(alloc.amountApplied)} applied to ${invoiceNumber} (New Bal: ${formatRs(newBal)})`;
  }).join('; ');
}

async function loadAndValidateAllocations(allocations, { customerId, paymentAmount, paymentType }, session) {
  if (!allocations.length) return [];
  if (paymentType !== 'receive' && paymentType !== 'refund') {
    throw new ApiError(400, 'Invoice allocations are only allowed for customer receipts');
  }

  const totalApplied = roundMoney(allocations.reduce((sum, item) => sum + item.amountApplied, 0));
  if (totalApplied > paymentAmount) {
    throw new ApiError(400, 'Allocated amount cannot exceed payment amount');
  }

  const loaded = [];
  for (const alloc of allocations) {
    let saleQuery = Sale.findById(alloc.saleId);
    if (session) saleQuery = saleQuery.session(session);
    const sale = await saleQuery;
    if (!sale) throw new ApiError(400, 'Allocated sale invoice not found');
    if (sale.saleStatus === 'cancelled' || sale.saleStatus === 'draft') {
      throw new ApiError(400, 'Cannot allocate to a cancelled or draft sale');
    }
    if (customerId && String(sale.customerId) !== String(customerId)) {
      throw new ApiError(400, 'Allocated invoice does not belong to the selected customer');
    }
    if (alloc.amountApplied > sale.outstandingAmount) {
      throw new ApiError(400, `Payment exceeds outstanding amount on ${sale.invoiceNumber}`);
    }
    loaded.push({ sale, amountApplied: alloc.amountApplied });
  }
  return loaded;
}

async function postPaymentEffects({ paymentType, accountId, paymentAmount, allocations }, session) {
  if (paymentType === 'receive') {
    await changeAccount(accountId, paymentAmount, session);
    for (const alloc of allocations) {
      await applySalePayment(alloc.sale, alloc.amountApplied, session);
    }
    return;
  }
  if (paymentType === 'refund') {
    if (!allocations.length) throw new ApiError(400, 'saleId is required for refund');
    await changeAccount(accountId, -paymentAmount, session);
    for (const alloc of allocations) {
      if (alloc.amountApplied > alloc.sale.paidAmount) {
        throw new ApiError(400, 'Refund exceeds paid amount');
      }
      await applySalePayment(alloc.sale, -alloc.amountApplied, session);
    }
    return;
  }
  if (paymentType === 'pay') {
    await changeAccount(accountId, -paymentAmount, session);
  }
}

async function reversePaymentEffects(payment, session) {
  const allocations = paymentAllocationsOf(payment);
  if (payment.paymentType === 'receive') {
    await changeAccount(payment.accountId, -payment.paymentAmount, session);
    for (const alloc of allocations) {
      const sale = await Sale.findById(alloc.saleId?._id || alloc.saleId).session(session);
      if (sale) await applySalePayment(sale, -alloc.amountApplied, session);
    }
    return;
  }
  if (payment.paymentType === 'refund') {
    await changeAccount(payment.accountId, payment.paymentAmount, session);
    for (const alloc of allocations) {
      const sale = await Sale.findById(alloc.saleId?._id || alloc.saleId).session(session);
      if (sale) await applySalePayment(sale, alloc.amountApplied, session);
    }
    return;
  }
  if (payment.paymentType === 'pay') {
    await changeAccount(payment.accountId, payment.paymentAmount, session);
  }
}

async function listPayments(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'paymentDate', query);
  if (query.customerId) filter.customerId = query.customerId;
  if (query.supplierId) filter.supplierId = query.supplierId;
  if (query.saleId) filter.saleId = query.saleId;
  if (query.accountId) filter.accountId = query.accountId;
  const paymentType = query.paymentType || query.direction;
  if (paymentType) filter.paymentType = paymentType;
  const paymentStatus = query.paymentStatus || query.status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  if (query.search) {
    const regex = { $regex: query.search.trim(), $options: 'i' };
    const [customers, suppliers] = await Promise.all([
      Customer.find({ $or: [{ customerName: regex }, { customerCode: regex }] }).select('_id'),
      Supplier.find({ $or: [{ supplierName: regex }, { supplierCode: regex }] }).select('_id'),
    ]);
    filter.$or = [
      { paymentNumber: regex },
      { referenceNumber: regex },
      { remarks: regex },
      { customerId: { $in: customers.map((item) => item._id) } },
      { supplierId: { $in: suppliers.map((item) => item._id) } },
    ];
  }

  const findQuery = populateQuery(
    Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    PAYMENT_POPULATE
  );
  const [items, total] = await Promise.all([
    findQuery.lean(),
    Payment.countDocuments(filter),
  ]);

  return {
    ...paginated(items.map(toPaymentItem), total, page, limit),
    meta: {
      directions: PAYMENT_DIRECTIONS,
      paymentMethods: PAYMENT_METHOD_OPTIONS,
      statuses: PAYMENT_VOUCHER_STATUSES,
    },
  };
}

async function getPaymentFormOptions(query = {}) {
  const paymentType = query.paymentType || query.direction;
  const [nextNumber, customers, suppliers, accounts] = await Promise.all([
    nextPaymentNumber(),
    Customer.find({ isActive: true }).select('customerCode customerName phoneNumber').sort({ customerName: 1 }).lean(),
    Supplier.find({ isActive: true }).select('supplierCode supplierName phoneNumber').sort({ supplierName: 1 }).lean(),
    Account.find({ isActive: true, accountType: { $in: ['cash', 'bank'] } })
      .select('accountCode accountName accountType isPrimary currentBalanceAmount')
      .sort({ isPrimary: -1, accountName: 1 })
      .lean(),
  ]);

  let ledgerBalance = 0;
  let outstandingInvoices = [];
  if (query.customerId) {
    [ledgerBalance, outstandingInvoices] = await Promise.all([
      customerLedgerOutstanding(query.customerId),
      outstandingSalesForCustomer(query.customerId),
    ]);
  } else if (query.supplierId) {
    ledgerBalance = await supplierLedgerOutstanding(query.supplierId);
  }

  return {
    nextPaymentNumber: nextNumber,
    directions: PAYMENT_DIRECTION_OPTIONS,
    paymentMethods: PAYMENT_METHOD_OPTIONS,
    statuses: PAYMENT_VOUCHER_STATUSES,
    paymentType: paymentType || null,
    ledgerBalance,
    ledgerBalanceLabel: query.customerId || query.supplierId
      ? `${formatRs(ledgerBalance)} Outstanding`
      : '',
    outstandingInvoices,
    customers: customers.map((customer) => ({
      _id: customer._id,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      label: `${customer.customerCode} – ${customer.customerName}`,
    })),
    suppliers: suppliers.map((supplier) => ({
      _id: supplier._id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
      label: `${supplier.supplierCode} – ${supplier.supplierName}`,
    })),
    accounts: accounts.map((account) => ({
      _id: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      isPrimary: Boolean(account.isPrimary),
      label: `${account.accountCode} – ${account.accountName}`,
    })),
  };
}

function resolveExpenseStatus(body, fallback = 'paid') {
  if (body.expenseStatus) return body.expenseStatus;
  if (body.isApproved === false) return 'pending';
  if (body.isApproved === true) return 'paid';
  return fallback;
}

function expenseStatusLabel(value) {
  return EXPENSE_STATUSES.find((item) => item.value === value)?.label || titleCaseExpense(value);
}

function titleCaseExpense(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toExpenseItem(doc) {
  const category = doc.expenseCategoryId && typeof doc.expenseCategoryId === 'object' ? doc.expenseCategoryId : null;
  const account = doc.paidFromAccountId && typeof doc.paidFromAccountId === 'object' ? doc.paidFromAccountId : null;
  const approvedBy = doc.approvedByUserId && typeof doc.approvedByUserId === 'object' ? doc.approvedByUserId : null;
  const recordedBy = doc.recordedByUserId && typeof doc.recordedByUserId === 'object' ? doc.recordedByUserId : null;
  const expenseStatus = doc.expenseStatus || 'paid';

  return {
    _id: doc._id,
    expenseNumber: doc.expenseNumber,
    expenseDate: doc.expenseDate,
    expenseCategoryId: category?._id || doc.expenseCategoryId || null,
    categoryName: category?.categoryName || '',
    categoryCode: category?.categoryCode || '',
    expenseDescription: doc.expenseDescription || '',
    vendorPayeeName: doc.vendorPayeeName || '',
    expenseAmount: roundMoney(doc.expenseAmount),
    paymentMethod: doc.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_OPTIONS.find((item) => item.value === doc.paymentMethod)?.label || doc.paymentMethod,
    paidFromAccountId: account?._id || doc.paidFromAccountId || null,
    paidFromAccountName: account ? `${account.accountCode} – ${account.accountName}` : '',
    referenceNumber: doc.referenceNumber || '',
    paymentDate: doc.paymentDate || null,
    expenseStatus,
    expenseStatusLabel: expenseStatusLabel(expenseStatus),
    isApproved: expenseStatus === 'paid',
    approvedByUserId: approvedBy?._id || doc.approvedByUserId || null,
    approvedByName: expenseStatus === 'paid' ? (approvedBy?.fullName || '') : '',
    recordedByUserId: recordedBy?._id || doc.recordedByUserId || null,
    recordedByName: recordedBy?.fullName || '',
    remarks: doc.remarks || '',
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function currentMonthRange() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { $gte: start, $lt: end };
}

async function nextExpenseNumber(session) {
  return nextSequentialCode(Expense, 'expenseNumber', 'EXP', 4, session);
}

async function expenseSummary() {
  const monthMatch = { expenseDate: currentMonthRange() };
  const [totals, byCategory] = await Promise.all([
    Expense.aggregate([
      { $match: monthMatch },
      { $group: { _id: null, amount: { $sum: '$expenseAmount' }, count: { $sum: 1 } } },
    ]),
    Expense.aggregate([
      { $match: monthMatch },
      { $group: { _id: '$expenseCategoryId', amount: { $sum: '$expenseAmount' }, count: { $sum: 1 } } },
      { $sort: { amount: -1 } },
    ]),
  ]);

  const categoryIds = byCategory.map((row) => row._id).filter(Boolean);
  const categories = await ExpenseCategory.find({ _id: { $in: categoryIds } })
    .select('categoryCode categoryName')
    .lean();
  const categoryMap = new Map(categories.map((item) => [String(item._id), item]));

  return {
    thisMonthTotalAmount: roundMoney(totals[0]?.amount),
    thisMonthCount: totals[0]?.count || 0,
    categoryCards: byCategory.map((row) => {
      const category = categoryMap.get(String(row._id));
      return {
        expenseCategoryId: row._id,
        categoryCode: category?.categoryCode || '',
        categoryName: category?.categoryName || 'Other',
        amount: roundMoney(row.amount),
        count: row.count || 0,
      };
    }),
  };
}

async function listExpenses(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'expenseDate', query);
  if (query.expenseCategoryId) filter.expenseCategoryId = query.expenseCategoryId;
  if (query.paidFromAccountId) filter.paidFromAccountId = query.paidFromAccountId;
  const expenseStatus = query.expenseStatus || query.status;
  if (expenseStatus) filter.expenseStatus = expenseStatus;

  if (query.search) {
    const regex = { $regex: query.search.trim(), $options: 'i' };
    filter.$or = [
      { expenseNumber: regex },
      { expenseDescription: regex },
      { vendorPayeeName: regex },
      { referenceNumber: regex },
      { remarks: regex },
    ];
  }

  const findQuery = populateQuery(
    Expense.find(filter).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    EXPENSE_POPULATE
  );
  const [items, total, summary, categories] = await Promise.all([
    findQuery.lean(),
    Expense.countDocuments(filter),
    expenseSummary(),
    ExpenseCategory.find({ isActive: true }).select('categoryCode categoryName').sort({ categoryName: 1 }).lean(),
  ]);

  return {
    ...paginated(items.map(toExpenseItem), total, page, limit),
    summary,
    meta: {
      statuses: EXPENSE_STATUSES,
      paymentMethods: PAYMENT_METHOD_OPTIONS,
      categories: categories.map((category) => ({
        _id: category._id,
        categoryCode: category.categoryCode,
        categoryName: category.categoryName,
        label: category.categoryName,
      })),
    },
  };
}

async function getExpenseFormOptions() {
  const [nextNumber, categories, accounts] = await Promise.all([
    nextExpenseNumber(),
    ExpenseCategory.find({ isActive: true }).select('categoryCode categoryName').sort({ categoryName: 1 }).lean(),
    Account.find({ isActive: true, accountType: { $in: ['cash', 'bank'] } })
      .select('accountCode accountName accountType isPrimary currentBalanceAmount')
      .sort({ isPrimary: -1, accountName: 1 })
      .lean(),
  ]);

  return {
    nextExpenseNumber: nextNumber,
    statuses: EXPENSE_STATUSES,
    paymentMethods: PAYMENT_METHOD_OPTIONS,
    categories: categories.map((category) => ({
      _id: category._id,
      categoryCode: category.categoryCode,
      categoryName: category.categoryName,
      label: category.categoryName,
    })),
    accounts: accounts.map((account) => ({
      _id: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      isPrimary: Boolean(account.isPrimary),
      label: `${account.accountCode} – ${account.accountName}`,
    })),
  };
}

async function createSale(body, req) {
  const result = await withTransaction(async (session) => {
    const customer = await assertCustomer(body.customerId, session);
    const isDraft = body.saveAsDraft === true;
    const lineItems = await buildSaleLines(body.lineItems, session);
    const totals = totalsFromLines(lineItems, body.tradeDiscountAmount);
    const amountPaid = roundMoney(body.amountPaid ?? body.payment?.paymentAmount ?? 0);
    if (amountPaid > totals.totalAmount) {
      throw new ApiError(400, 'Amount paid cannot exceed sale total');
    }

    const balances = deriveBalances(totals.totalAmount, amountPaid, 0);
    const saleType = balances.outstandingAmount > 0 ? 'credit' : 'cash';
    if (!isDraft && balances.outstandingAmount > 0) {
      await assertCreditLimit(customer, balances.outstandingAmount, session);
    }

    if (!isDraft) {
      for (const line of lineItems) {
        await changeStock(line.inventoryItemId, -line.quantity, session);
      }
    }

    const saleNumber = await assignNumber(Sale, 'saleNumber', 'SAL', body.saleNumber, session);
    const invoiceNumber = body.invoiceNumber
      ? await assignNumber(Sale, 'invoiceNumber', 'INV', body.invoiceNumber, session)
      : await nextInvoiceNumber(session);

    const [sale] = await Sale.create(
      [
        {
          saleNumber,
          invoiceNumber,
          customerId: customer._id,
          invoiceDate: body.invoiceDate || new Date(),
          saleType,
          paymentTermDays: body.paymentTermDays ?? customer.paymentTermDays ?? 0,
          lineItems,
          ...totals,
          paidAmount: amountPaid,
          returnedAmount: 0,
          outstandingAmount: balances.outstandingAmount,
          paymentStatus: balances.paymentStatus,
          saleStatus: isDraft ? 'draft' : 'confirmed',
          createdByUserId: req.user._id,
          remarks: body.remarks || body.internalRemarks || '',
        },
      ],
      { session }
    );

    if (!isDraft && amountPaid > 0) {
      await postSaleReceipt({
        sale,
        customerId: customer._id,
        amount: amountPaid,
        accountId: body.accountId || body.payment?.accountId,
        paymentMethod: body.payment?.paymentMethod || (saleType === 'cash' ? 'cash' : 'cash'),
        paymentDate: body.invoiceDate,
        referenceNumber: body.payment?.referenceNumber,
        userId: req.user._id,
      }, session);
    }

    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'sales',
      entityName: 'Sale',
      entityId: sale._id,
      newValues: {
        saleNumber,
        invoiceNumber,
        totalAmount: sale.totalAmount,
        paidAmount: sale.paidAmount,
        saleStatus: sale.saleStatus,
      },
    });

    return sale._id;
  });

  invalidateFinance();
  return getSaleById(result);
}

async function applyDraftSaleFields(sale, body, session) {
  const customer = await assertCustomer(body.customerId || sale.customerId, session);
  sale.customerId = customer._id;
  if (body.invoiceDate !== undefined) sale.invoiceDate = body.invoiceDate;
  if (body.paymentTermDays !== undefined) sale.paymentTermDays = body.paymentTermDays;
  if (body.remarks !== undefined || body.internalRemarks !== undefined) {
    sale.remarks = body.remarks ?? body.internalRemarks;
  }

  if (body.lineItems) {
    sale.lineItems = await buildSaleLines(body.lineItems, session);
  }

  const tradeDiscount = body.tradeDiscountAmount !== undefined
    ? body.tradeDiscountAmount
    : sale.tradeDiscountAmount;
  const totals = totalsFromLines(sale.lineItems, tradeDiscount);
  sale.subtotalAmount = totals.subtotalAmount;
  sale.discountAmount = totals.discountAmount;
  sale.tradeDiscountAmount = totals.tradeDiscountAmount;
  sale.taxAmount = totals.taxAmount;
  sale.totalAmount = totals.totalAmount;

  if (body.amountPaid !== undefined || body.payment?.paymentAmount !== undefined) {
    const amountPaid = roundMoney(body.amountPaid ?? body.payment.paymentAmount);
    if (amountPaid > totals.totalAmount) {
      throw new ApiError(400, 'Amount paid cannot exceed sale total');
    }
    sale.paidAmount = amountPaid;
  } else if (sale.paidAmount > totals.totalAmount) {
    throw new ApiError(400, 'Amount paid cannot exceed sale total');
  }

  const balances = deriveBalances(sale.totalAmount, sale.paidAmount, sale.returnedAmount || 0);
  sale.outstandingAmount = balances.outstandingAmount;
  sale.paymentStatus = balances.paymentStatus;
  sale.saleType = balances.outstandingAmount > 0 ? 'credit' : 'cash';
  return customer;
}

async function updateSale(id, body, req) {
  const result = await withTransaction(async (session) => {
    const sale = await Sale.findById(id).session(session);
    if (!sale) throw new ApiError(404, 'Sale not found');

    if (body.saveAsDraft === true && (body.saleStatus === 'confirmed' || body.saleStatus === 'cancelled')) {
      throw new ApiError(400, 'Cannot change sale status while saving as draft');
    }

    const wantsDraftEdit = [
      'customerId',
      'invoiceDate',
      'paymentTermDays',
      'lineItems',
      'tradeDiscountAmount',
      'amountPaid',
      'payment',
    ].some((key) => body[key] !== undefined);

    if (wantsDraftEdit) {
      if (sale.saleStatus !== 'draft') {
        throw new ApiError(400, 'Only a draft sale can be edited');
      }
      await applyDraftSaleFields(sale, body, session);
    }

    const shouldConfirm = body.saleStatus === 'confirmed' || body.saveAsDraft === false;
    if (shouldConfirm) {
      if (sale.saleStatus !== 'draft') {
        throw new ApiError(400, 'Only a draft sale can be confirmed');
      }
      const customer = await assertCustomer(sale.customerId, session);
      if (sale.outstandingAmount > 0) {
        await assertCreditLimit(customer, sale.outstandingAmount, session, sale._id);
      }
      for (const line of sale.lineItems) {
        await changeStock(line.inventoryItemId, -line.quantity, session);
      }
      if (sale.paidAmount > 0) {
        await postSaleReceipt({
          sale,
          customerId: customer._id,
          amount: sale.paidAmount,
          accountId: body.accountId || body.payment?.accountId,
          paymentMethod: body.payment?.paymentMethod,
          paymentDate: sale.invoiceDate,
          referenceNumber: body.payment?.referenceNumber,
          userId: req.user._id,
        }, session);
      }
      sale.saleStatus = 'confirmed';
    }

    if (body.saleStatus === 'cancelled') {
      if (sale.saleStatus === 'cancelled') {
        throw new ApiError(400, 'Sale is already cancelled');
      }
      if (sale.paidAmount > 0 && sale.saleStatus !== 'draft') {
        throw new ApiError(400, 'Cannot cancel a sale that has payments');
      }
      if (sale.returnedAmount > 0) {
        throw new ApiError(400, 'Cannot cancel a sale that has returns');
      }
      if (sale.saleStatus !== 'draft') {
        for (const line of sale.lineItems) {
          await changeStock(line.inventoryItemId, line.quantity, session);
        }
      }
      sale.saleStatus = 'cancelled';
      sale.outstandingAmount = 0;
      sale.paymentStatus = 'unpaid';
    }

    if (body.remarks !== undefined || body.internalRemarks !== undefined) {
      sale.remarks = body.remarks ?? body.internalRemarks;
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
    const sale = await findOriginalSale({
      originalSaleId: body.originalSaleId,
      originalInvoiceNumber: body.originalInvoiceNumber,
    }, session);
    const customerId = body.customerId || sale.customerId;
    if (String(customerId) !== String(sale.customerId)) {
      throw new ApiError(400, 'customerId does not match the original sale');
    }
    await assertCustomer(customerId, session);

    const sold = await soldQtyByItem(sale);
    const already = await returnedQtyByItem(sale._id, session);
    const returnItems = [];

    for (const raw of body.returnItems) {
      if (!raw.quantity) continue;
      const key = String(raw.inventoryItemId);
      const soldQty = sold.get(key) || 0;
      const returnedQty = already.get(key) || 0;
      const saleLine = sale.lineItems.find((line) => String(line.inventoryItemId) === key);
      if (!saleLine) {
        throw new ApiError(400, 'Return item was not on the original invoice');
      }
      if (raw.quantity > soldQty - returnedQty) {
        throw new ApiError(400, 'Return quantity exceeds remaining quantity for an item');
      }
      const unitPriceAmount = saleLine.unitPriceAmount || 0;
      returnItems.push({
        inventoryItemId: raw.inventoryItemId,
        quantity: raw.quantity,
        unitPriceAmount,
        lineTotalAmount: roundMoney(raw.quantity * unitPriceAmount),
      });
      await changeStock(raw.inventoryItemId, raw.quantity, session);
    }

    if (!returnItems.length) {
      throw new ApiError(400, 'At least one return item is required');
    }

    const totalReturnAmount = roundMoney(returnItems.reduce((sum, line) => sum + line.lineTotalAmount, 0));
    const returnNumber = body.returnNumber
      ? await assignNumber(SalesReturn, 'returnNumber', 'RET', body.returnNumber, session)
      : await nextReturnNumber(session);
    const [doc] = await SalesReturn.create(
      [
        {
          returnNumber,
          customerId,
          originalSaleId: sale._id,
          returnDate: body.returnDate,
          returnItems,
          totalReturnAmount,
          returnReason: body.returnReason,
          inspectionNotes: body.inspectionNotes || '',
          adjustmentType: RETURN_ACTION_TYPE.value,
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
    const paymentType = paymentTypeOf(body);
    if (!paymentType) throw new ApiError(400, 'paymentType or direction is required');

    let customerId = body.customerId || null;
    let supplierId = body.supplierId || null;
    const isDraft = body.saveAsDraft === true;
    const allocations = normalizeAllocations(body);

    if (allocations[0]?.saleId && !customerId && paymentType !== 'pay') {
      const firstSale = await Sale.findById(allocations[0].saleId).session(session);
      customerId = firstSale?.customerId || customerId;
    }

    if (customerId) await assertCustomer(customerId, session);
    if (supplierId) await assertSupplier(supplierId, session);
    await assertAccount(body.accountId, session);

    const loadedAllocations = await loadAndValidateAllocations(
      allocations,
      { customerId, paymentAmount: body.paymentAmount, paymentType },
      session
    );

    if (!isDraft) {
      await postPaymentEffects({
        paymentType,
        accountId: body.accountId,
        paymentAmount: body.paymentAmount,
        allocations: loadedAllocations,
      }, session);
    }

    const invoices = loadedAllocations.map((item) => ({
      _id: item.sale._id,
      invoiceNumber: item.sale.invoiceNumber,
      outstandingAmount: item.sale.outstandingAmount + (isDraft ? 0 : item.amountApplied),
    }));
    const remarks = body.remarks || buildAllocationRemarks(allocations, invoices, body.paymentAmount);
    const paymentNumber = body.paymentNumber
      ? await assignNumber(Payment, 'paymentNumber', 'PAY', body.paymentNumber, session)
      : await nextPaymentNumber(session);

    const [doc] = await Payment.create(
      [
        {
          paymentNumber,
          paymentType,
          customerId,
          supplierId,
          saleId: allocations[0]?.saleId || null,
          allocations,
          accountId: body.accountId,
          paymentAmount: body.paymentAmount,
          paymentMethod: body.paymentMethod || 'cash',
          paymentDate: body.paymentDate,
          paymentStatus: isDraft ? 'pending' : 'recorded',
          referenceNumber: body.referenceNumber || '',
          remarks,
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
      newValues: { paymentNumber, paymentType, paymentAmount: body.paymentAmount, paymentStatus: doc.paymentStatus },
    });

    return doc._id;
  });

  invalidateFinance();
  return getPaymentById(result);
}

async function updatePayment(id, body, req) {
  const result = await withTransaction(async (session) => {
    const payment = await Payment.findById(id).session(session);
    if (!payment) throw new ApiError(404, 'Payment not found');

    if (payment.paymentStatus === 'recorded') {
      if (body.remarks !== undefined) payment.remarks = body.remarks;
      if (body.referenceNumber !== undefined) payment.referenceNumber = body.referenceNumber;
      await payment.save({ session });
      await writeAudit({
        req,
        session,
        actionName: 'update',
        moduleName: 'payments',
        entityName: 'Payment',
        entityId: payment._id,
        newValues: body,
      });
      return payment._id;
    }

    const postingNow = body.paymentStatus === 'recorded' || body.saveAsDraft === false;

    if (body.paymentDate !== undefined) payment.paymentDate = body.paymentDate;
    if (body.paymentMethod !== undefined) payment.paymentMethod = body.paymentMethod;
    if (body.accountId !== undefined) {
      await assertAccount(body.accountId, session);
      payment.accountId = body.accountId;
    }
    if (body.paymentAmount !== undefined) payment.paymentAmount = body.paymentAmount;
    if (body.referenceNumber !== undefined) payment.referenceNumber = body.referenceNumber;
    if (body.customerId !== undefined) {
      await assertCustomer(body.customerId, session);
      payment.customerId = body.customerId;
    }
    if (body.supplierId !== undefined) {
      await assertSupplier(body.supplierId, session);
      payment.supplierId = body.supplierId;
    }
    if (body.allocations !== undefined) {
      const allocations = normalizeAllocations({ ...body, paymentAmount: payment.paymentAmount, saleId: body.saleId });
      await loadAndValidateAllocations(
        allocations,
        { customerId: payment.customerId, paymentAmount: payment.paymentAmount, paymentType: payment.paymentType },
        session
      );
      payment.allocations = allocations;
      payment.saleId = allocations[0]?.saleId || null;
    }
    if (body.remarks !== undefined) payment.remarks = body.remarks;

    if (postingNow) {
      const allocations = normalizeAllocations({
        allocations: payment.allocations,
        saleId: payment.saleId,
        paymentAmount: payment.paymentAmount,
      });
      const loadedAllocations = await loadAndValidateAllocations(
        allocations,
        { customerId: payment.customerId, paymentAmount: payment.paymentAmount, paymentType: payment.paymentType },
        session
      );
      await postPaymentEffects({
        paymentType: payment.paymentType,
        accountId: payment.accountId,
        paymentAmount: payment.paymentAmount,
        allocations: loadedAllocations,
      }, session);
      payment.paymentStatus = 'recorded';
    }

    await payment.save({ session });
    await writeAudit({
      req,
      session,
      actionName: 'update',
      moduleName: 'payments',
      entityName: 'Payment',
      entityId: payment._id,
      newValues: body,
    });
    return payment._id;
  });

  invalidateFinance();
  return getPaymentById(result);
}

async function removePayment(id, req) {
  await withTransaction(async (session) => {
    const payment = await Payment.findById(id).session(session);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (payment.paymentStatus === 'recorded') {
      await reversePaymentEffects(payment, session);
    }
    await payment.deleteOne({ session });
    await writeAudit({
      req,
      session,
      actionName: 'delete',
      moduleName: 'payments',
      entityName: 'Payment',
      entityId: id,
      oldValues: { paymentNumber: payment.paymentNumber, paymentAmount: payment.paymentAmount },
    });
  });
  invalidateFinance();
}

async function createExpense(body, req) {
  const result = await withTransaction(async (session) => {
    await assertCategory(body.expenseCategoryId, session);
    const expenseStatus = resolveExpenseStatus(body, 'paid');
    const paidFromAccountId = body.paidFromAccountId || null;

    if (expenseStatus === 'paid') {
      if (!paidFromAccountId) {
        throw new ApiError(400, 'paidFromAccountId is required for a paid expense');
      }
      await changeAccount(paidFromAccountId, -body.expenseAmount, session);
    } else if (paidFromAccountId) {
      await assertAccount(paidFromAccountId, session);
    }

    const expenseNumber = body.expenseNumber
      ? await assignNumber(Expense, 'expenseNumber', 'EXP', body.expenseNumber, session)
      : await nextExpenseNumber(session);

    const [doc] = await Expense.create(
      [
        {
          expenseNumber,
          expenseCategoryId: body.expenseCategoryId,
          paidFromAccountId,
          expenseAmount: body.expenseAmount,
          expenseDescription: body.expenseDescription,
          expenseDate: body.expenseDate,
          vendorPayeeName: body.vendorPayeeName || '',
          paymentMethod: body.paymentMethod || 'cash',
          referenceNumber: body.referenceNumber || '',
          paymentDate: body.paymentDate || (expenseStatus === 'paid' ? body.expenseDate : null),
          expenseStatus,
          remarks: body.remarks || '',
          recordedByUserId: req.user._id,
          approvedByUserId: expenseStatus === 'paid' ? req.user._id : null,
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
      newValues: { expenseNumber, expenseAmount: body.expenseAmount, expenseStatus },
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

    const previousStatus = expense.expenseStatus || 'paid';
    const nextStatus = resolveExpenseStatus(body, previousStatus);
    const previousAccountId = expense.paidFromAccountId;
    const previousAmount = expense.expenseAmount;
    const nextAccountId = body.paidFromAccountId !== undefined ? body.paidFromAccountId : expense.paidFromAccountId;
    const nextAmount = body.expenseAmount ?? expense.expenseAmount;

    if (nextStatus === 'paid' && !nextAccountId) {
      throw new ApiError(400, 'paidFromAccountId is required for a paid expense');
    }
    if (nextAccountId) await assertAccount(nextAccountId, session);

    const wasPosted = previousStatus === 'paid' && previousAccountId;
    const willPost = nextStatus === 'paid' && nextAccountId;
    const postingChanged = wasPosted !== willPost
      || (willPost && (String(previousAccountId) !== String(nextAccountId) || previousAmount !== nextAmount));

    if (postingChanged) {
      if (wasPosted) {
        await changeAccount(previousAccountId, previousAmount, session);
      }
      if (willPost) {
        await changeAccount(nextAccountId, -nextAmount, session);
      }
    }

    expense.paidFromAccountId = nextAccountId || null;
    expense.expenseAmount = nextAmount;
    expense.expenseStatus = nextStatus;
    if (nextStatus === 'paid') {
      expense.approvedByUserId = expense.approvedByUserId || req.user._id;
      if (!expense.paymentDate) expense.paymentDate = body.paymentDate || body.expenseDate || expense.expenseDate;
    } else {
      expense.approvedByUserId = null;
    }

    if (body.expenseDescription !== undefined) expense.expenseDescription = body.expenseDescription;
    if (body.expenseDate !== undefined) expense.expenseDate = body.expenseDate;
    if (body.vendorPayeeName !== undefined) expense.vendorPayeeName = body.vendorPayeeName;
    if (body.paymentMethod !== undefined) expense.paymentMethod = body.paymentMethod;
    if (body.referenceNumber !== undefined) expense.referenceNumber = body.referenceNumber;
    if (body.paymentDate !== undefined) expense.paymentDate = body.paymentDate;
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
    const status = expense.expenseStatus || 'paid';
    if (status === 'paid' && expense.paidFromAccountId) {
      await changeAccount(expense.paidFromAccountId, expense.expenseAmount, session);
    }
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

const sale = {
  create: createSale,
  list: listSales,
  getById: getSaleById,
  update: updateSale,
  getFormOptions: getSaleFormOptions,
};
const salesReturn = {
  create: createReturn,
  list: listReturns,
  getById: getReturnById,
  getFormOptions: getReturnFormOptions,
};
const payment = {
  create: createPayment,
  list: listPayments,
  getById: getPaymentById,
  update: updatePayment,
  remove: removePayment,
  getFormOptions: getPaymentFormOptions,
};
const expense = {
  create: createExpense,
  list: listExpenses,
  getById: getExpenseById,
  update: updateExpense,
  remove: removeExpense,
  getFormOptions: getExpenseFormOptions,
};

module.exports = { sale, salesReturn, payment, expense };
