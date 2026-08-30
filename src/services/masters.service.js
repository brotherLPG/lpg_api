const {
  Customer,
  Supplier,
  CylinderType,
  StorageTank,
  InventoryItem,
  Employee,
  Account,
  ExpenseCategory,
  User,
  LPGReceipt,
  FillingBatch,
  Sale,
  SalesReturn,
  Payment,
  Expense,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { createMasterService } = require('./master.factory');
const {
  TANK_STATUSES,
  ACCOUNT_TYPES,
  EMPLOYMENT_STATUSES,
  ITEM_CATEGORIES,
} = require('../constants/masters');

async function assertActiveCylinderType(cylinderTypeId) {
  if (!cylinderTypeId) return null;
  const cylinderType = await CylinderType.findById(cylinderTypeId);
  if (!cylinderType) {
    throw new ApiError(400, 'CylinderType not found');
  }
  if (!cylinderType.isActive) {
    throw new ApiError(400, 'CylinderType is inactive');
  }
  return cylinderType;
}

function assertTankLevels(payload, existing = {}) {
  const capacityKg = payload.capacityKg ?? existing.capacityKg;
  const currentQuantityKg = payload.currentQuantityKg ?? existing.currentQuantityKg ?? 0;
  const minimumSafeQuantityKg = payload.minimumSafeQuantityKg ?? existing.minimumSafeQuantityKg ?? 0;
  const maximumSafeQuantityKg = payload.maximumSafeQuantityKg ?? existing.maximumSafeQuantityKg ?? 0;

  if (currentQuantityKg > capacityKg) {
    throw new ApiError(400, 'currentQuantityKg cannot exceed capacityKg');
  }
  if (maximumSafeQuantityKg && maximumSafeQuantityKg > capacityKg) {
    throw new ApiError(400, 'maximumSafeQuantityKg cannot exceed capacityKg');
  }
  if (maximumSafeQuantityKg && minimumSafeQuantityKg > maximumSafeQuantityKg) {
    throw new ApiError(400, 'minimumSafeQuantityKg cannot exceed maximumSafeQuantityKg');
  }
}

async function assertParentAccount(parentAccountId, currentId) {
  if (!parentAccountId) return;
  if (currentId && String(parentAccountId) === String(currentId)) {
    throw new ApiError(400, 'Account cannot be its own parent');
  }

  const seen = new Set(currentId ? [String(currentId)] : []);
  let walkId = parentAccountId;
  let depth = 0;

  while (walkId) {
    if (seen.has(String(walkId))) {
      throw new ApiError(400, 'Circular account parent is not allowed');
    }
    seen.add(String(walkId));
    const parent = await Account.findById(walkId).select('parentAccountId isActive');
    if (!parent) {
      throw new ApiError(400, 'Parent account not found');
    }
    walkId = parent.parentAccountId;
    depth += 1;
    if (depth > 20) {
      throw new ApiError(400, 'Account parent chain is too deep');
    }
  }
}

function assertStockLevels(payload, existing = {}) {
  const minimumStockLevel = payload.minimumStockLevel ?? existing.minimumStockLevel ?? 0;
  const maximumStockLevel = payload.maximumStockLevel ?? existing.maximumStockLevel ?? 0;
  if (maximumStockLevel && minimumStockLevel > maximumStockLevel) {
    throw new ApiError(400, 'minimumStockLevel cannot exceed maximumStockLevel');
  }
}

const customer = createMasterService({
  Model: Customer,
  entityName: 'Customer',
  moduleName: 'customers',
  uniqueField: 'customerCode',
  codePrefix: 'CUST',
  cachePrefix: 'customers:',
  searchFields: ['customerCode', 'customerName', 'phoneNumber', 'emailAddress'],
  assertDelete: async (doc) => {
    const [sales, returns, payments] = await Promise.all([
      Sale.countDocuments({ customerId: doc._id }),
      SalesReturn.countDocuments({ customerId: doc._id }),
      Payment.countDocuments({ customerId: doc._id }),
    ]);
    if (sales || returns || payments) {
      throw new ApiError(400, 'Customer has sales or payments and cannot be deleted');
    }
  },
});

const supplier = createMasterService({
  Model: Supplier,
  entityName: 'Supplier',
  moduleName: 'suppliers',
  uniqueField: 'supplierCode',
  codePrefix: 'SUP',
  cachePrefix: 'suppliers:',
  searchFields: ['supplierCode', 'supplierName', 'phoneNumber', 'emailAddress'],
  assertDelete: async (doc) => {
    const used = await LPGReceipt.countDocuments({ supplierId: doc._id });
    const paid = await Payment.countDocuments({ supplierId: doc._id });
    if (used > 0 || paid > 0) {
      throw new ApiError(400, 'Supplier has LPG receipts or payments and cannot be deleted');
    }
  },
});

const cylinderType = createMasterService({
  Model: CylinderType,
  entityName: 'CylinderType',
  moduleName: 'cylinder-types',
  uniqueField: 'typeCode',
  codePrefix: 'CYL',
  cachePrefix: 'cylinder-types:',
  searchFields: ['typeCode', 'typeName'],
  sort: { capacityKg: 1 },
  assertDelete: async (doc) => {
    const inUse = await InventoryItem.countDocuments({ cylinderTypeId: doc._id });
    if (inUse > 0) {
      throw new ApiError(400, 'CylinderType is used by inventory items and cannot be deleted');
    }
    const batches = await FillingBatch.countDocuments({ cylinderTypeId: doc._id });
    if (batches > 0) {
      throw new ApiError(400, 'CylinderType is used by filling batches and cannot be deleted');
    }
  },
});

const storageTank = createMasterService({
  Model: StorageTank,
  entityName: 'StorageTank',
  moduleName: 'storage-tanks',
  uniqueField: 'tankCode',
  codePrefix: 'TNK',
  cachePrefix: 'storage-tanks:',
  searchFields: ['tankCode', 'tankName', 'locationDescription'],
  hasIsActive: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.tankStatus) filter.tankStatus = query.tankStatus;
    return filter;
  },
  listMeta: async () => ({
    tankStatuses: TANK_STATUSES,
  }),
  prepareCreate: async (body) => {
    assertTankLevels(body);
    return body;
  },
  prepareUpdate: async (body, doc) => {
    assertTankLevels(body, doc);
    return body;
  },
  assertDelete: async (doc) => {
    if (doc.currentQuantityKg > 0) {
      throw new ApiError(400, 'StorageTank still has LPG and cannot be deleted');
    }
    const [receipts, batches] = await Promise.all([
      LPGReceipt.countDocuments({ storageTankId: doc._id }),
      FillingBatch.countDocuments({ storageTankId: doc._id }),
    ]);
    if (receipts > 0 || batches > 0) {
      throw new ApiError(400, 'StorageTank has LPG history and cannot be deleted');
    }
  },
});

const inventoryItem = createMasterService({
  Model: InventoryItem,
  entityName: 'InventoryItem',
  moduleName: 'inventory-items',
  uniqueField: 'itemCode',
  codePrefix: 'ITM',
  cachePrefix: 'inventory-items:',
  populate: [{ path: 'cylinderTypeId', select: 'typeCode typeName capacityKg isActive' }],
  searchFields: ['itemCode', 'itemName'],
  extraFilters: (query) => {
    const filter = {};
    if (query.itemCategory) filter.itemCategory = query.itemCategory;
    if (query.cylinderTypeId) filter.cylinderTypeId = query.cylinderTypeId;
    return filter;
  },
  listMeta: async () => ({
    itemCategories: ITEM_CATEGORIES,
  }),
  prepareCreate: async (body) => {
    await assertActiveCylinderType(body.cylinderTypeId);
    assertStockLevels(body);
    return body;
  },
  prepareUpdate: async (body, doc) => {
    if (body.cylinderTypeId !== undefined) {
      await assertActiveCylinderType(body.cylinderTypeId);
    }
    assertStockLevels(body, doc);
    return body;
  },
  assertDelete: async (doc) => {
    if (doc.currentQuantity !== 0) {
      throw new ApiError(400, 'InventoryItem still has stock and cannot be deleted');
    }
    const sold = await Sale.countDocuments({ 'lineItems.inventoryItemId': doc._id });
    if (sold > 0) {
      throw new ApiError(400, 'InventoryItem is used in sales and cannot be deleted');
    }
  },
});

const employee = createMasterService({
  Model: Employee,
  entityName: 'Employee',
  moduleName: 'employees',
  uniqueField: 'employeeCode',
  codePrefix: 'EMP',
  cachePrefix: 'employees:',
  searchFields: ['employeeCode', 'fullName', 'phoneNumber', 'emailAddress', 'jobTitle'],
  hasIsActive: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.employmentStatus) filter.employmentStatus = query.employmentStatus;
    return filter;
  },
  listMeta: async () => ({
    employmentStatuses: EMPLOYMENT_STATUSES,
  }),
  assertDelete: async (doc) => {
    const linked = await User.countDocuments({ employeeId: doc._id });
    if (linked > 0) {
      throw new ApiError(400, 'Employee is linked to a user and cannot be deleted');
    }
    const batches = await FillingBatch.countDocuments({ operatorEmployeeId: doc._id });
    if (batches > 0) {
      throw new ApiError(400, 'Employee has filling batches and cannot be deleted');
    }
  },
});

const account = createMasterService({
  Model: Account,
  entityName: 'Account',
  moduleName: 'accounts',
  uniqueField: 'accountCode',
  codePrefix: 'ACC',
  cachePrefix: 'accounts:',
  populate: [{ path: 'parentAccountId', select: 'accountCode accountName accountType' }],
  searchFields: ['accountCode', 'accountName'],
  sort: { accountCode: 1 },
  allowDelete: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.accountType) filter.accountType = query.accountType;
    return filter;
  },
  listMeta: async () => ({
    accountTypes: ACCOUNT_TYPES,
  }),
  prepareCreate: async (body) => {
    await assertParentAccount(body.parentAccountId);
    const openingBalanceAmount = body.openingBalanceAmount || 0;
    return {
      ...body,
      openingBalanceAmount,
      currentBalanceAmount: openingBalanceAmount,
    };
  },
  prepareUpdate: async (body, doc) => {
    if (body.parentAccountId !== undefined) {
      await assertParentAccount(body.parentAccountId, doc._id);
    }
    return body;
  },
});

const expenseCategory = createMasterService({
  Model: ExpenseCategory,
  entityName: 'ExpenseCategory',
  moduleName: 'expense-categories',
  uniqueField: 'categoryCode',
  codePrefix: 'CAT',
  cachePrefix: 'expense-categories:',
  searchFields: ['categoryCode', 'categoryName'],
  sort: { categoryName: 1 },
  assertDelete: async (doc) => {
    const used = await Expense.countDocuments({ expenseCategoryId: doc._id });
    if (used > 0) {
      throw new ApiError(400, 'ExpenseCategory is used by expenses and cannot be deleted');
    }
  },
});

module.exports = {
  customer,
  supplier,
  cylinderType,
  storageTank,
  inventoryItem,
  employee,
  account,
  expenseCategory,
};
