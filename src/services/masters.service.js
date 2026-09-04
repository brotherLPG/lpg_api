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
  MaintenanceAsset,
  MaintenanceRecord,
  Asset,
} = require('../models');
const ApiError = require('../utils/ApiError');
const cache = require('../config/cache');
const { nextSequentialCode } = require('../utils/nextCode');
const { createMasterService } = require('./master.factory');
const {
  TANK_STATUSES,
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_CATEGORIES,
  ACCOUNT_RECORD_STATUSES,
  EMPLOYMENT_STATUSES,
  ITEM_CATEGORY_OPTIONS,
  UNIT_OF_MEASURE_OPTIONS,
  STOCK_STATUSES,
  PAYMENT_TERMS,
  ACTIVE_STATUSES,
  CYLINDER_CATEGORIES,
  CYLINDER_COLOR_CODES,
  CYLINDER_VALVE_TYPES,
  CYLINDER_MATERIALS,
  ASSET_CATEGORIES,
  MAINTENANCE_ASSET_STATUSES,
  MAINTENANCE_TYPES,
  ASSET_STATUSES,
  DEPRECIATION_METHODS,
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

async function supplierFormOptions() {
  return {
    nextSupplierCode: await nextSequentialCode(Supplier, 'supplierCode', 'SUP'),
    paymentTerms: PAYMENT_TERMS,
    statuses: ACTIVE_STATUSES,
  };
}

const supplier = createMasterService({
  Model: Supplier,
  entityName: 'Supplier',
  moduleName: 'suppliers',
  uniqueField: 'supplierCode',
  codePrefix: 'SUP',
  cachePrefix: 'suppliers:',
  searchFields: [
    'supplierCode',
    'supplierName',
    'contactPersonName',
    'phoneNumber',
    'emailAddress',
    'city',
    'taxRegistrationNumber',
    'bankName',
  ],
  listMeta: async () => ({
    paymentTerms: PAYMENT_TERMS,
    statuses: ACTIVE_STATUSES,
  }),
  formOptions: supplierFormOptions,
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
  searchFields: ['typeCode', 'typeName', 'cylinderCategory', 'colorCode', 'safetyCertificationNumber'],
  sort: { capacityKg: 1 },
  extraFilters: (query) => {
    const filter = {};
    if (query.cylinderCategory) filter.cylinderCategory = query.cylinderCategory;
    return filter;
  },
  listMeta: async () => ({
    categories: CYLINDER_CATEGORIES,
    colorCodes: CYLINDER_COLOR_CODES,
    valveTypes: CYLINDER_VALVE_TYPES,
    materials: CYLINDER_MATERIALS,
    statuses: ACTIVE_STATUSES,
  }),
  formOptions: async () => ({
    nextTypeCode: await nextSequentialCode(CylinderType, 'typeCode', 'CYL'),
    categories: CYLINDER_CATEGORIES,
    colorCodes: CYLINDER_COLOR_CODES,
    valveTypes: CYLINDER_VALVE_TYPES,
    materials: CYLINDER_MATERIALS,
    statuses: ACTIVE_STATUSES,
  }),
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
    const existingCount = await StorageTank.countDocuments();
    if (existingCount > 0) {
      throw new ApiError(400, 'Plant already has a storage tank');
    }
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

function titleCase(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatKg(value) {
  const amount = Number(value) || 0;
  if (Number.isInteger(amount)) return String(amount);
  return String(Math.round(amount * 10) / 10);
}

function cylinderDescription(type) {
  if (!type) return '';
  const category = CYLINDER_CATEGORIES.find((item) => item.value === type.cylinderCategory);
  const categoryLabel = category?.label || titleCase(type.cylinderCategory);
  if (type.capacityKg && categoryLabel) {
    return `${formatKg(type.capacityKg)} KG ${categoryLabel}`;
  }
  return type.typeName || '';
}

function tankLevel(tank) {
  const capacityKg = tank.capacityKg || 0;
  const currentQuantityKg = tank.currentQuantityKg || 0;
  const minimumSafeQuantityKg = tank.minimumSafeQuantityKg || 0;
  const maximumSafeQuantityKg = tank.maximumSafeQuantityKg || 0;
  const fillPercent = capacityKg > 0
    ? Math.round((currentQuantityKg / capacityKg) * 1000) / 10
    : 0;

  let stockStatus = 'ok';
  let stockAlert = null;

  if (minimumSafeQuantityKg > 0 && currentQuantityKg <= minimumSafeQuantityKg) {
    stockStatus = 'below-minimum';
    stockAlert = `Tank is at or below the minimum safe threshold of ${minimumSafeQuantityKg.toLocaleString('en-US')} KG.`;
  } else if (minimumSafeQuantityKg > 0 && currentQuantityKg <= minimumSafeQuantityKg * 2.5) {
    stockStatus = 'approaching';
    stockAlert = `Tank approaching minimum safe threshold level of ${minimumSafeQuantityKg.toLocaleString('en-US')} KG.`;
  } else if (maximumSafeQuantityKg > 0 && currentQuantityKg >= maximumSafeQuantityKg) {
    stockStatus = 'above-maximum';
    stockAlert = `Tank is at or above the maximum safe capacity of ${maximumSafeQuantityKg.toLocaleString('en-US')} KG.`;
  }

  return {
    fillPercent,
    stockStatus,
    stockAlert,
  };
}

async function getTankDashboard(query = {}) {
  const recentLimit = Math.min(20, Math.max(1, parseInt(query.recentLimit, 10) || 5));
  const tank = await StorageTank.findOne().sort({ createdAt: 1 }).lean();
  if (!tank) {
    throw new ApiError(404, 'No storage tank is configured');
  }

  const [receipts, batches] = await Promise.all([
    LPGReceipt.find({ storageTankId: tank._id })
      .populate('supplierId', 'supplierCode supplierName')
      .sort({ receivedAt: -1, createdAt: -1 })
      .limit(recentLimit)
      .lean(),
    FillingBatch.find({ storageTankId: tank._id })
      .populate('cylinderTypeId', 'typeCode typeName capacityKg cylinderCategory')
      .sort({ fillingDate: -1, createdAt: -1 })
      .limit(recentLimit)
      .lean(),
  ]);

  const level = tankLevel(tank);

  return {
    _id: tank._id,
    tankCode: tank.tankCode,
    tankName: tank.tankName,
    tankStatus: tank.tankStatus,
    tankStatusLabel: titleCase(tank.tankStatus),
    locationDescription: tank.locationDescription || '',
    installationDate: tank.installationDate,
    capacityKg: tank.capacityKg,
    currentQuantityKg: tank.currentQuantityKg,
    minimumSafeQuantityKg: tank.minimumSafeQuantityKg,
    maximumSafeQuantityKg: tank.maximumSafeQuantityKg,
    fillPercent: level.fillPercent,
    stockStatus: level.stockStatus,
    stockAlert: level.stockAlert,
    recentReceipts: receipts.map((receipt) => ({
      _id: receipt._id,
      receiptNumber: receipt.receiptNumber,
      receivedAt: receipt.receivedAt,
      receivedQuantityKg: receipt.receivedQuantityKg,
      supplierId: receipt.supplierId?._id || receipt.supplierId,
      supplierName: receipt.supplierId?.supplierName || '',
    })),
    recentFillingBatches: batches.map((batch) => ({
      _id: batch._id,
      batchNumber: batch.batchNumber,
      fillingDate: batch.fillingDate,
      cylinderCount: batch.cylinderCount,
      cylinderTypeId: batch.cylinderTypeId?._id || batch.cylinderTypeId,
      typeName: batch.cylinderTypeId?.typeName || '',
      cylinderDescription: cylinderDescription(batch.cylinderTypeId),
    })),
  };
}

storageTank.getDashboard = getTankDashboard;

const CYLINDER_ITEM_CATEGORIES = ['filled-cylinder', 'empty-cylinder'];

async function assertActiveSupplier(supplierId) {
  if (!supplierId) return null;
  const supplier = await Supplier.findById(supplierId).select('supplierCode supplierName isActive');
  if (!supplier) {
    throw new ApiError(400, 'Supplier not found');
  }
  if (!supplier.isActive) {
    throw new ApiError(400, 'Supplier is inactive');
  }
  return supplier;
}

async function assertUniqueCylinderStock(itemCategory, cylinderTypeId, excludeId) {
  if (!CYLINDER_ITEM_CATEGORIES.includes(itemCategory) || !cylinderTypeId) {
    return;
  }
  const filter = { itemCategory, cylinderTypeId };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  const exists = await InventoryItem.findOne(filter).select('itemCode');
  if (exists) {
    throw new ApiError(409, `An inventory item already exists for this cylinder type (${exists.itemCode})`);
  }
}

function stockStatusOf(item) {
  const qty = Number(item.currentQuantity) || 0;
  const min = Number(item.minimumStockLevel) || 0;
  if (qty <= 0) {
    return { stockStatus: 'out-of-stock', stockStatusLabel: 'Out of Stock' };
  }
  if (min > 0 && qty <= min) {
    return { stockStatus: 'low-stock', stockStatusLabel: 'Low Stock' };
  }
  return { stockStatus: 'in-stock', stockStatusLabel: 'In Stock' };
}

function stockStatusFilter(stockStatus) {
  if (stockStatus === 'out-of-stock') {
    return { currentQuantity: { $lte: 0 } };
  }
  if (stockStatus === 'low-stock') {
    return {
      $expr: {
        $and: [
          { $gt: ['$currentQuantity', 0] },
          { $gt: ['$minimumStockLevel', 0] },
          { $lte: ['$currentQuantity', '$minimumStockLevel'] },
        ],
      },
    };
  }
  if (stockStatus === 'in-stock') {
    return {
      $expr: {
        $and: [
          { $gt: ['$currentQuantity', 0] },
          {
            $or: [
              { $lte: ['$minimumStockLevel', 0] },
              { $gt: ['$currentQuantity', '$minimumStockLevel'] },
            ],
          },
        ],
      },
    };
  }
  return {};
}

function categoryLabelOf(itemCategory) {
  return ITEM_CATEGORY_OPTIONS.find((item) => item.value === itemCategory)?.label || titleCase(itemCategory);
}

function unitLabelOf(unitOfMeasure) {
  return UNIT_OF_MEASURE_OPTIONS.find((item) => item.value === unitOfMeasure)?.label || unitOfMeasure;
}

function cylinderVolumeOf(type) {
  if (type?.capacityKg == null) return 'N/A';
  return `${formatKg(type.capacityKg)} KG`;
}

function cylinderCardHint(item, status) {
  if (item.itemCategory === 'filled-cylinder') {
    if (status.stockStatus === 'low-stock' || status.stockStatus === 'out-of-stock') {
      return 'Below operational buffer';
    }
    if (item.cylinderTypeId?.cylinderCategory === 'commercial') {
      return 'Ready for commercial delivery';
    }
    return 'Normal operational levels';
  }
  if (item.itemCategory === 'empty-cylinder') {
    if (status.stockStatus === 'low-stock' || status.stockStatus === 'out-of-stock') {
      return 'Requires bulk collection run';
    }
    return 'Sufficient for next 2 batches';
  }
  return '';
}

function cylinderCardTitle(item, type) {
  const cap = type?.capacityKg != null ? `${formatKg(type.capacityKg)}KG` : '';
  if (item.itemCategory === 'filled-cylinder') {
    return cap ? `Filled ${cap} Cylinders` : item.itemName;
  }
  if (item.itemCategory === 'empty-cylinder') {
    return cap ? `Empty ${cap} Cylinders` : item.itemName;
  }
  return item.itemName;
}

function mapInventoryItem(item) {
  const type = item.cylinderTypeId && typeof item.cylinderTypeId === 'object' ? item.cylinderTypeId : null;
  const supplier = item.preferredSupplierId && typeof item.preferredSupplierId === 'object'
    ? item.preferredSupplierId
    : null;
  const status = stockStatusOf(item);

  return {
    _id: item._id,
    itemCode: item.itemCode,
    itemName: item.itemName,
    itemCategory: item.itemCategory,
    categoryLabel: categoryLabelOf(item.itemCategory),
    description: item.description || '',
    unitOfMeasure: item.unitOfMeasure,
    unitOfMeasureLabel: unitLabelOf(item.unitOfMeasure),
    cylinderTypeId: type?._id || item.cylinderTypeId || null,
    cylinderTypeName: type?.typeName || '',
    capacityKg: type?.capacityKg ?? null,
    cylinderVolume: cylinderVolumeOf(type),
    currentQuantity: item.currentQuantity || 0,
    minimumStockLevel: item.minimumStockLevel || 0,
    maximumStockLevel: item.maximumStockLevel || 0,
    reorderQuantity: item.reorderQuantity || 0,
    preferredSupplierId: supplier?._id || item.preferredSupplierId || null,
    preferredSupplierName: supplier?.supplierName || '',
    unitPurchasePriceAmount: item.unitPurchasePriceAmount || 0,
    unitSellingPriceAmount: item.unitSellingPriceAmount || 0,
    lastPurchaseDate: item.lastPurchaseDate || null,
    rackBayNumber: item.rackBayNumber || '',
    storageNotes: item.storageNotes || '',
    isActive: item.isActive !== false,
    ...status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

async function inventoryListSummary() {
  const items = await InventoryItem.find({
    itemCategory: { $in: CYLINDER_ITEM_CATEGORIES },
    isActive: true,
  })
    .populate('cylinderTypeId', 'typeCode typeName capacityKg cylinderCategory')
    .sort({ itemCategory: 1 })
    .lean();

  const cylinderCards = items
    .map((item) => {
      const type = item.cylinderTypeId && typeof item.cylinderTypeId === 'object' ? item.cylinderTypeId : null;
      const status = stockStatusOf(item);
      return {
        itemId: item._id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        title: cylinderCardTitle(item, type),
        itemCategory: item.itemCategory,
        categoryLabel: categoryLabelOf(item.itemCategory),
        capacityKg: type?.capacityKg ?? null,
        currentQuantity: item.currentQuantity || 0,
        hint: cylinderCardHint(item, status),
        ...status,
      };
    })
    .sort((a, b) => {
      const categoryOrder = Number(a.itemCategory === 'empty-cylinder') - Number(b.itemCategory === 'empty-cylinder');
      if (categoryOrder !== 0) return categoryOrder;
      return (a.capacityKg || 0) - (b.capacityKg || 0);
    });

  return { cylinderCards };
}

async function inventoryFormOptions() {
  const [nextItemCode, cylinderTypes, suppliers] = await Promise.all([
    nextSequentialCode(InventoryItem, 'itemCode', 'ITM'),
    CylinderType.find({ isActive: true })
      .select('typeCode typeName capacityKg cylinderCategory')
      .sort({ capacityKg: 1 })
      .lean(),
    Supplier.find({ isActive: true })
      .select('supplierCode supplierName')
      .sort({ supplierName: 1 })
      .lean(),
  ]);

  return {
    nextItemCode,
    categories: ITEM_CATEGORY_OPTIONS,
    unitsOfMeasure: UNIT_OF_MEASURE_OPTIONS,
    stockStatuses: STOCK_STATUSES,
    statuses: ACTIVE_STATUSES,
    cylinderTypes: cylinderTypes.map((type) => ({
      _id: type._id,
      typeCode: type.typeCode,
      typeName: type.typeName,
      capacityKg: type.capacityKg,
      cylinderCategory: type.cylinderCategory,
      label: `${type.typeName} (${formatKg(type.capacityKg)} KG)`,
      volumeLabel: `${formatKg(type.capacityKg)} KG`,
    })),
    suppliers: suppliers.map((supplier) => ({
      _id: supplier._id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
    })),
  };
}

async function prepareInventoryPayload(body, existing = {}) {
  const category = body.itemCategory ?? existing.itemCategory;

  if (CYLINDER_ITEM_CATEGORIES.includes(category)) {
    const cylinderTypeId = body.cylinderTypeId !== undefined ? body.cylinderTypeId : existing.cylinderTypeId;
    if (!cylinderTypeId) {
      throw new ApiError(400, 'cylinderTypeId is required for cylinder inventory items');
    }
    await assertActiveCylinderType(cylinderTypeId);
    await assertUniqueCylinderStock(category, cylinderTypeId, existing._id);
    if (body.unitOfMeasure === undefined && !existing.unitOfMeasure) {
      body.unitOfMeasure = 'PCS';
    }
  } else if (body.itemCategory !== undefined || body.cylinderTypeId !== undefined) {
    body.cylinderTypeId = null;
  }

  if (body.preferredSupplierId) {
    await assertActiveSupplier(body.preferredSupplierId);
  }

  if (body.currentQuantity === undefined && !existing._id) {
    body.currentQuantity = 0;
  }

  assertStockLevels(body, existing);
  return body;
}

const inventoryItem = createMasterService({
  Model: InventoryItem,
  entityName: 'InventoryItem',
  moduleName: 'inventory-items',
  uniqueField: 'itemCode',
  codePrefix: 'ITM',
  cachePrefix: 'inventory-items:',
  populate: [
    { path: 'cylinderTypeId', select: 'typeCode typeName capacityKg cylinderCategory sellingPricePerCylinder isActive' },
    { path: 'preferredSupplierId', select: 'supplierCode supplierName isActive' },
  ],
  searchFields: ['itemCode', 'itemName', 'description', 'rackBayNumber'],
  extraFilters: (query) => {
    const filter = {};
    if (query.itemCategory) filter.itemCategory = query.itemCategory;
    if (query.cylinderTypeId) filter.cylinderTypeId = query.cylinderTypeId;
    Object.assign(filter, stockStatusFilter(query.stockStatus));
    return filter;
  },
  mapItem: mapInventoryItem,
  listMeta: async () => ({
    categories: ITEM_CATEGORY_OPTIONS,
    stockStatuses: STOCK_STATUSES,
    unitsOfMeasure: UNIT_OF_MEASURE_OPTIONS,
    statuses: ACTIVE_STATUSES,
  }),
  listSummary: inventoryListSummary,
  formOptions: inventoryFormOptions,
  prepareCreate: async (body) => prepareInventoryPayload(body),
  prepareUpdate: async (body, doc) => prepareInventoryPayload(body, doc),
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
    const maintenance = await MaintenanceRecord.countDocuments({ performedByEmployeeId: doc._id });
    if (maintenance > 0) {
      throw new ApiError(400, 'Employee has maintenance records and cannot be deleted');
    }
    const assignedAssets = await Asset.countDocuments({ assignedEmployeeId: doc._id });
    if (assignedAssets > 0) {
      throw new ApiError(400, 'Employee has assigned assets and cannot be deleted');
    }
  },
});

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function accountStatusOf(account) {
  if (account.isActive === false) {
    return { status: 'inactive', statusLabel: 'Inactive' };
  }
  if (account.needsReview) {
    return { status: 'review', statusLabel: 'Review' };
  }
  return { status: 'active', statusLabel: 'Active' };
}

function accountStatusFilter(status) {
  if (status === 'inactive') {
    return { isActive: false };
  }
  if (status === 'review') {
    return { needsReview: true };
  }
  if (status === 'active') {
    return { isActive: true, needsReview: { $ne: true } };
  }
  return {};
}

function branchDisplayOf(account) {
  const bankName = account.bankName || '';
  const branchName = account.branchName || '';
  if (bankName && branchName) return `${bankName} – ${branchName}`;
  return bankName || branchName || '';
}

function mapAccount(account) {
  const parent = account.parentAccountId && typeof account.parentAccountId === 'object'
    ? account.parentAccountId
    : null;
  const status = accountStatusOf(account);

  return {
    _id: account._id,
    accountCode: account.accountCode,
    accountName: account.accountName,
    accountType: account.accountType,
    accountTypeLabel: ACCOUNT_TYPE_OPTIONS.find((item) => item.value === account.accountType)?.label
      || titleCase(account.accountType),
    accountCategory: account.accountCategory || 'operating',
    accountCategoryLabel: ACCOUNT_CATEGORIES.find((item) => item.value === account.accountCategory)?.label
      || titleCase(account.accountCategory),
    parentAccountId: parent?._id || account.parentAccountId || null,
    parentAccountName: parent?.accountName || '',
    parentAccountCode: parent?.accountCode || '',
    description: account.description || '',
    bankName: account.bankName || '',
    branchName: account.branchName || '',
    branchDisplay: branchDisplayOf(account),
    accountNumber: account.accountNumber || '',
    ibanOrSwift: account.ibanOrSwift || '',
    openingBalanceAmount: roundMoney(account.openingBalanceAmount),
    currentBalanceAmount: roundMoney(account.currentBalanceAmount),
    openedAt: account.openedAt || null,
    allowManualEntries: account.allowManualEntries !== false,
    isPrimary: Boolean(account.isPrimary),
    needsReview: Boolean(account.needsReview),
    isActive: account.isActive !== false,
    ...status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

async function clearOtherPrimaryAccounts(excludeId) {
  const filter = { isPrimary: true };
  if (excludeId) filter._id = { $ne: excludeId };
  await Account.updateMany(filter, { $set: { isPrimary: false } });
}

async function accountListSummary() {
  const [totals] = await Account.aggregate([
    {
      $group: {
        _id: null,
        totalAccounts: { $sum: 1 },
        activeAccounts: { $sum: { $cond: ['$isActive', 1, 0] } },
        totalOpeningBalance: { $sum: '$openingBalanceAmount' },
        totalCurrentBalance: { $sum: '$currentBalanceAmount' },
        needsReviewCount: { $sum: { $cond: ['$needsReview', 1, 0] } },
      },
    },
  ]);

  return {
    totalAccounts: totals?.totalAccounts || 0,
    activeAccounts: totals?.activeAccounts || 0,
    totalOpeningBalance: roundMoney(totals?.totalOpeningBalance),
    totalCurrentBalance: roundMoney(totals?.totalCurrentBalance),
    needsReviewCount: totals?.needsReviewCount || 0,
  };
}

async function accountFormOptions(query = {}) {
  const excludeId = query.id;
  const parentFilter = { isActive: true };
  if (excludeId) parentFilter._id = { $ne: excludeId };

  const [nextAccountCode, parentAccounts] = await Promise.all([
    nextSequentialCode(Account, 'accountCode', 'ACC'),
    Account.find(parentFilter).select('accountCode accountName accountType').sort({ accountCode: 1 }).lean(),
  ]);

  return {
    nextAccountCode,
    accountTypes: ACCOUNT_TYPE_OPTIONS,
    accountCategories: ACCOUNT_CATEGORIES,
    statuses: ACCOUNT_RECORD_STATUSES,
    activeStatuses: ACTIVE_STATUSES,
    parentAccounts: parentAccounts.map((account) => ({
      _id: account._id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      label: `${account.accountCode} – ${account.accountName}`,
    })),
  };
}

async function prepareAccountCreate(body) {
  delete body.currentBalanceAmount;
  await assertParentAccount(body.parentAccountId);
  if (body.isPrimary) {
    await clearOtherPrimaryAccounts();
  }
  const openingBalanceAmount = body.openingBalanceAmount ?? 0;
  return {
    ...body,
    openingBalanceAmount,
    currentBalanceAmount: openingBalanceAmount,
    allowManualEntries: body.allowManualEntries !== false,
    isPrimary: Boolean(body.isPrimary),
    needsReview: Boolean(body.needsReview),
  };
}

async function prepareAccountUpdate(body, doc) {
  delete body.currentBalanceAmount;
  if (body.parentAccountId !== undefined) {
    await assertParentAccount(body.parentAccountId, doc._id);
  }
  if (body.isPrimary === true) {
    await clearOtherPrimaryAccounts(doc._id);
  }
  return body;
}

const account = createMasterService({
  Model: Account,
  entityName: 'Account',
  moduleName: 'accounts',
  uniqueField: 'accountCode',
  codePrefix: 'ACC',
  cachePrefix: 'accounts:',
  populate: [{ path: 'parentAccountId', select: 'accountCode accountName accountType' }],
  searchFields: ['accountCode', 'accountName', 'bankName', 'branchName', 'accountNumber'],
  sort: { accountCode: 1 },
  allowDelete: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.accountType) filter.accountType = query.accountType;
    if (query.accountCategory) filter.accountCategory = query.accountCategory;
    Object.assign(filter, accountStatusFilter(query.status));
    return filter;
  },
  mapItem: mapAccount,
  listMeta: async () => ({
    accountTypes: ACCOUNT_TYPE_OPTIONS,
    accountCategories: ACCOUNT_CATEGORIES,
    statuses: ACCOUNT_RECORD_STATUSES,
  }),
  listSummary: accountListSummary,
  formOptions: accountFormOptions,
  prepareCreate: prepareAccountCreate,
  prepareUpdate: prepareAccountUpdate,
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

async function assertWorkEmployee(employeeId) {
  if (!employeeId) return null;
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new ApiError(400, 'Employee not found');
  }
  if (employee.employmentStatus === 'terminated') {
    throw new ApiError(400, 'Employee is terminated');
  }
  return employee;
}

async function assertMaintenanceAssetExists(maintenanceAssetId) {
  const plantAsset = await MaintenanceAsset.findById(maintenanceAssetId);
  if (!plantAsset) {
    throw new ApiError(400, 'MaintenanceAsset not found');
  }
  if (plantAsset.operationalStatus === 'retired') {
    throw new ApiError(400, 'MaintenanceAsset is retired');
  }
  return plantAsset;
}

function assertBookValue(payload, existing = {}) {
  const purchaseCostAmount = payload.purchaseCostAmount ?? existing.purchaseCostAmount ?? 0;
  const currentBookValueAmount = payload.currentBookValueAmount ?? existing.currentBookValueAmount ?? purchaseCostAmount;
  if (currentBookValueAmount > purchaseCostAmount) {
    throw new ApiError(400, 'currentBookValueAmount cannot exceed purchaseCostAmount');
  }
}

function assertMaintenanceDates(payload, existing = {}) {
  const maintenanceDate = payload.maintenanceDate ?? existing.maintenanceDate;
  const nextMaintenanceDate = payload.nextMaintenanceDate ?? existing.nextMaintenanceDate;
  if (maintenanceDate && nextMaintenanceDate && new Date(nextMaintenanceDate) < new Date(maintenanceDate)) {
    throw new ApiError(400, 'nextMaintenanceDate cannot be before maintenanceDate');
  }
}

const maintenanceAsset = createMasterService({
  Model: MaintenanceAsset,
  entityName: 'MaintenanceAsset',
  moduleName: 'maintenance-assets',
  uniqueField: 'assetCode',
  codePrefix: 'MAS',
  cachePrefix: 'maintenance-assets:',
  searchFields: ['assetCode', 'assetName', 'serialNumber', 'locationName', 'manufacturerName'],
  hasIsActive: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.assetCategory) filter.assetCategory = query.assetCategory;
    if (query.operationalStatus) filter.operationalStatus = query.operationalStatus;
    return filter;
  },
  listMeta: async () => ({
    assetCategories: ASSET_CATEGORIES,
    operationalStatuses: MAINTENANCE_ASSET_STATUSES,
  }),
  prepareCreate: async (body) => {
    if (!body.serialNumber) body.serialNumber = null;
    return body;
  },
  prepareUpdate: async (body) => {
    if (body.serialNumber === '') body.serialNumber = null;
    return body;
  },
  assertDelete: async (doc) => {
    const records = await MaintenanceRecord.countDocuments({ maintenanceAssetId: doc._id });
    if (records > 0) {
      throw new ApiError(400, 'MaintenanceAsset has records and cannot be deleted');
    }
  },
});

const maintenanceRecord = createMasterService({
  Model: MaintenanceRecord,
  entityName: 'MaintenanceRecord',
  moduleName: 'maintenance-records',
  uniqueField: 'maintenanceNumber',
  codePrefix: 'MNT',
  cachePrefix: 'maintenance-records:',
  populate: [
    { path: 'maintenanceAssetId', select: 'assetCode assetName assetCategory operationalStatus locationName' },
    { path: 'performedByEmployeeId', select: 'employeeCode fullName jobTitle employmentStatus' },
    { path: 'approvedByUserId', select: 'fullName emailAddress' },
  ],
  searchFields: ['maintenanceNumber', 'problemDescription', 'workPerformed'],
  hasIsActive: false,
  allowDelete: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.maintenanceAssetId) filter.maintenanceAssetId = query.maintenanceAssetId;
    if (query.performedByEmployeeId) filter.performedByEmployeeId = query.performedByEmployeeId;
    if (query.maintenanceType) filter.maintenanceType = query.maintenanceType;
    if (query.startDate || query.endDate) {
      filter.maintenanceDate = {};
      if (query.startDate) filter.maintenanceDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.maintenanceDate.$lte = new Date(query.endDate);
    }
    return filter;
  },
  listMeta: async () => ({
    maintenanceTypes: MAINTENANCE_TYPES,
  }),
  prepareCreate: async (body, req) => {
    const plantAsset = await assertMaintenanceAssetExists(body.maintenanceAssetId);
    await assertWorkEmployee(body.performedByEmployeeId);
    if (!body.maintenanceDate) body.maintenanceDate = new Date();
    assertMaintenanceDates(body);
    body.approvedByUserId = req.user._id;
    if (['corrective', 'emergency'].includes(body.maintenanceType) && plantAsset.operationalStatus === 'operational') {
      plantAsset.operationalStatus = 'maintenance';
      await plantAsset.save();
      cache.delByPrefix('maintenance-assets:');
    }
    return body;
  },
  prepareUpdate: async (body, doc) => {
    if (body.maintenanceAssetId) {
      await assertMaintenanceAssetExists(body.maintenanceAssetId);
    }
    if (body.performedByEmployeeId) {
      await assertWorkEmployee(body.performedByEmployeeId);
    }
    assertMaintenanceDates(body, doc);
    return body;
  },
});

const asset = createMasterService({
  Model: Asset,
  entityName: 'Asset',
  moduleName: 'assets',
  uniqueField: 'assetCode',
  codePrefix: 'AST',
  cachePrefix: 'assets:',
  populate: [{ path: 'assignedEmployeeId', select: 'employeeCode fullName jobTitle employmentStatus' }],
  searchFields: ['assetCode', 'assetName', 'locationName'],
  hasIsActive: false,
  extraFilters: (query) => {
    const filter = {};
    if (query.assetCategory) filter.assetCategory = query.assetCategory;
    if (query.assetStatus) filter.assetStatus = query.assetStatus;
    if (query.assignedEmployeeId) filter.assignedEmployeeId = query.assignedEmployeeId;
    return filter;
  },
  listMeta: async () => ({
    assetCategories: ASSET_CATEGORIES,
    assetStatuses: ASSET_STATUSES,
    depreciationMethods: DEPRECIATION_METHODS,
  }),
  prepareCreate: async (body) => {
    await assertWorkEmployee(body.assignedEmployeeId);
    if (body.currentBookValueAmount === undefined) {
      body.currentBookValueAmount = body.purchaseCostAmount || 0;
    }
    assertBookValue(body);
    return body;
  },
  prepareUpdate: async (body, doc) => {
    if (body.assignedEmployeeId !== undefined) {
      await assertWorkEmployee(body.assignedEmployeeId);
    }
    assertBookValue(body, doc);
    return body;
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
  maintenanceAsset,
  maintenanceRecord,
  asset,
};
