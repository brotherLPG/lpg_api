const mongoose = require('mongoose');
const {
  LPGReceipt,
  FillingBatch,
  Supplier,
  StorageTank,
  CylinderType,
  InventoryItem,
  Employee,
} = require('../models');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { nextSequentialCode } = require('../utils/nextCode');
const { writeAudit } = require('./audit.service');

const RECEIPT_POPULATE = [
  { path: 'supplierId', select: 'supplierCode supplierName contactPersonName phoneNumber city isActive' },
  { path: 'storageTankId', select: 'tankCode tankName capacityKg currentQuantityKg tankStatus' },
  { path: 'receivedByUserId', select: 'fullName emailAddress' },
];

const FILLING_POPULATE = [
  { path: 'storageTankId', select: 'tankCode tankName capacityKg currentQuantityKg tankStatus' },
  { path: 'cylinderTypeId', select: 'typeCode typeName capacityKg cylinderCategory sellingPricePerCylinder isActive' },
  { path: 'operatorEmployeeId', select: 'employeeCode fullName jobTitle employmentStatus' },
  { path: 'createdByUserId', select: 'fullName emailAddress' },
];

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function computePurchaseAmount(quantityKg, rate) {
  return roundMoney(quantityKg * (rate || 0));
}

function applyDateRange(filter, field, query) {
  if (!query.startDate && !query.endDate) return filter;
  filter[field] = {};
  if (query.startDate) filter[field].$gte = new Date(query.startDate);
  if (query.endDate) filter[field].$lte = new Date(query.endDate);
  return filter;
}

function invalidateOps() {
  cache.delByPrefix('storage-tanks:');
  cache.delByPrefix('inventory-items:');
  cache.delByPrefix('lpg-receipts:');
  cache.delByPrefix('filling-batches:');
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

async function assertSupplier(supplierId, session) {
  const supplier = await Supplier.findById(supplierId).session(session);
  if (!supplier) {
    throw new ApiError(400, 'Supplier not found');
  }
  if (!supplier.isActive) {
    throw new ApiError(400, 'Supplier is inactive');
  }
  return supplier;
}

async function assertTank(tankId, session, { mustBeOperational = true } = {}) {
  const tank = await StorageTank.findById(tankId).session(session);
  if (!tank) {
    throw new ApiError(400, 'StorageTank not found');
  }
  if (mustBeOperational && tank.tankStatus !== 'operational') {
    throw new ApiError(400, 'StorageTank is not operational');
  }
  return tank;
}

async function assertCylinderType(cylinderTypeId, session) {
  const cylinderType = await CylinderType.findById(cylinderTypeId).session(session);
  if (!cylinderType) {
    throw new ApiError(400, 'CylinderType not found');
  }
  if (!cylinderType.isActive) {
    throw new ApiError(400, 'CylinderType is inactive');
  }
  return cylinderType;
}

async function assertEmployee(employeeId, session) {
  const employee = await Employee.findById(employeeId).session(session);
  if (!employee) {
    throw new ApiError(400, 'Employee not found');
  }
  if (employee.employmentStatus === 'terminated') {
    throw new ApiError(400, 'Employee is terminated');
  }
  return employee;
}

async function findCylinderStock(cylinderTypeId, itemCategory, session) {
  return InventoryItem.findOne({
    cylinderTypeId,
    itemCategory,
    isActive: true,
  }).session(session);
}

async function incrementTank(tankId, quantityKg, session) {
  const tank = await StorageTank.findOneAndUpdate(
    {
      _id: tankId,
      tankStatus: 'operational',
      $expr: { $lte: [{ $add: ['$currentQuantityKg', quantityKg] }, '$capacityKg'] },
    },
    { $inc: { currentQuantityKg: quantityKg } },
    { new: true, session }
  );
  if (!tank) {
    throw new ApiError(400, 'Tank cannot accept this quantity (capacity or status)');
  }
  return tank;
}

async function decrementTank(tankId, quantityKg, session) {
  const tank = await StorageTank.findOneAndUpdate(
    {
      _id: tankId,
      currentQuantityKg: { $gte: quantityKg },
    },
    { $inc: { currentQuantityKg: -quantityKg } },
    { new: true, session }
  );
  if (!tank) {
    throw new ApiError(400, 'Tank does not have enough LPG for this quantity');
  }
  return tank;
}

async function incrementFilled(itemId, count, session) {
  return InventoryItem.findByIdAndUpdate(
    itemId,
    { $inc: { currentQuantity: count } },
    { new: true, session }
  );
}

async function restoreTank(tankId, quantityKg, session) {
  const tank = await StorageTank.findByIdAndUpdate(
    tankId,
    { $inc: { currentQuantityKg: quantityKg } },
    { new: true, session }
  );
  if (!tank) {
    throw new ApiError(400, 'StorageTank not found');
  }
  return tank;
}

function populateQuery(query, paths) {
  paths.forEach((path) => {
    query = query.populate(path);
  });
  return query;
}

async function getReceiptById(id) {
  const doc = await populateQuery(LPGReceipt.findById(id), RECEIPT_POPULATE);
  if (!doc) {
    throw new ApiError(404, 'LPGReceipt not found');
  }
  return doc;
}

async function getFillingById(id) {
  const doc = await populateQuery(FillingBatch.findById(id), FILLING_POPULATE);
  if (!doc) {
    throw new ApiError(404, 'FillingBatch not found');
  }
  return doc;
}

async function listReceipts(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'receivedAt', query);
  if (query.supplierId) filter.supplierId = query.supplierId;
  if (query.storageTankId) filter.storageTankId = query.storageTankId;
  if (query.search) {
    filter.$or = [
      { receiptNumber: { $regex: query.search, $options: 'i' } },
      { supplierInvoiceNumber: { $regex: query.search, $options: 'i' } },
      { truckRegistrationNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const findQuery = populateQuery(
    LPGReceipt.find(filter).sort({ receivedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    RECEIPT_POPULATE
  );
  const [items, total] = await Promise.all([
    findQuery.lean(),
    LPGReceipt.countDocuments(filter),
  ]);
  return paginated(items, total, page, limit);
}

async function listFillings(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'fillingDate', query);
  if (query.storageTankId) filter.storageTankId = query.storageTankId;
  if (query.cylinderTypeId) filter.cylinderTypeId = query.cylinderTypeId;
  if (query.operatorEmployeeId) filter.operatorEmployeeId = query.operatorEmployeeId;
  if (query.search) {
    filter.$or = [
      { batchNumber: { $regex: query.search, $options: 'i' } },
      { remarks: { $regex: query.search, $options: 'i' } },
    ];
  }

  const findQuery = populateQuery(
    FillingBatch.find(filter).sort({ fillingDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    FILLING_POPULATE
  );
  const [items, total] = await Promise.all([
    findQuery.lean(),
    FillingBatch.countDocuments(filter),
  ]);
  return paginated(items, total, page, limit);
}

async function createReceipt(body, req) {
  const result = await withTransaction(async (session) => {
    await assertSupplier(body.supplierId, session);
    await assertTank(body.storageTankId, session);

    const receiptNumber = await assignNumber(LPGReceipt, 'receiptNumber', 'RCP', body.receiptNumber, session);
    const receivedQuantityKg = body.receivedQuantityKg;
    const purchaseRatePerKg = body.purchaseRatePerKg || 0;
    const payload = {
      receiptNumber,
      supplierId: body.supplierId,
      storageTankId: body.storageTankId,
      receivedQuantityKg,
      purchaseRatePerKg,
      totalPurchaseAmount: computePurchaseAmount(receivedQuantityKg, purchaseRatePerKg),
      truckRegistrationNumber: body.truckRegistrationNumber || '',
      receivedAt: body.receivedAt || new Date(),
      supplierInvoiceNumber: body.supplierInvoiceNumber || '',
      receivedByUserId: req.user._id,
      remarks: body.remarks || '',
    };

    const [doc] = await LPGReceipt.create([payload], { session });
    const tank = await incrementTank(body.storageTankId, receivedQuantityKg, session);

    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'lpg-receipts',
      entityName: 'LPGReceipt',
      entityId: doc._id,
      newValues: {
        ...payload,
        tankQuantityAfterKg: tank.currentQuantityKg,
      },
    });

    return { id: doc._id, tankQuantityAfterKg: tank.currentQuantityKg };
  });

  invalidateOps();
  const receipt = await getReceiptById(result.id);
  return { ...receipt.toObject(), tankQuantityAfterKg: result.tankQuantityAfterKg };
}

async function updateReceipt(id, body, req) {
  const result = await withTransaction(async (session) => {
    const existing = await LPGReceipt.findById(id).session(session);
    if (!existing) {
      throw new ApiError(404, 'LPGReceipt not found');
    }

    if (body.receiptNumber && body.receiptNumber !== existing.receiptNumber) {
      const taken = await LPGReceipt.findOne({ receiptNumber: body.receiptNumber, _id: { $ne: id } }).session(session);
      if (taken) {
        throw new ApiError(409, 'receiptNumber already exists');
      }
    }

    const nextSupplierId = body.supplierId || existing.supplierId;
    const nextTankId = body.storageTankId || existing.storageTankId;
    const nextQty = body.receivedQuantityKg ?? existing.receivedQuantityKg;
    const nextRate = body.purchaseRatePerKg ?? existing.purchaseRatePerKg;

    if (String(nextSupplierId) !== String(existing.supplierId)) {
      await assertSupplier(nextSupplierId, session);
    }

    const qtyChanged = nextQty !== existing.receivedQuantityKg;
    const tankChanged = String(nextTankId) !== String(existing.storageTankId);

    if (qtyChanged || tankChanged) {
      await decrementTank(existing.storageTankId, existing.receivedQuantityKg, session);
      await assertTank(nextTankId, session);
      await incrementTank(nextTankId, nextQty, session);
    }

    const oldValues = {
      receivedQuantityKg: existing.receivedQuantityKg,
      storageTankId: existing.storageTankId,
      purchaseRatePerKg: existing.purchaseRatePerKg,
    };

    existing.receiptNumber = body.receiptNumber || existing.receiptNumber;
    existing.supplierId = nextSupplierId;
    existing.storageTankId = nextTankId;
    existing.receivedQuantityKg = nextQty;
    existing.purchaseRatePerKg = nextRate;
    existing.totalPurchaseAmount = computePurchaseAmount(nextQty, nextRate);
    if (body.truckRegistrationNumber !== undefined) existing.truckRegistrationNumber = body.truckRegistrationNumber;
    if (body.receivedAt !== undefined) existing.receivedAt = body.receivedAt;
    if (body.supplierInvoiceNumber !== undefined) existing.supplierInvoiceNumber = body.supplierInvoiceNumber;
    if (body.remarks !== undefined) existing.remarks = body.remarks;
    await existing.save({ session });

    await writeAudit({
      req,
      session,
      actionName: 'update',
      moduleName: 'lpg-receipts',
      entityName: 'LPGReceipt',
      entityId: existing._id,
      oldValues,
      newValues: body,
    });

    return existing._id;
  });

  invalidateOps();
  return getReceiptById(result);
}

async function applyFillingStock({ storageTankId, cylinderTypeId, cylinderCount, actualLpgUsedKg }, session) {
  await assertTank(storageTankId, session);
  const cylinderType = await assertCylinderType(cylinderTypeId, session);
  const filledItem = await findCylinderStock(cylinderTypeId, 'filled-cylinder', session);
  if (!filledItem) {
    throw new ApiError(400, 'No active filled inventory item for this cylinder type');
  }

  const tank = await decrementTank(storageTankId, actualLpgUsedKg, session);
  const filled = await incrementFilled(filledItem._id, cylinderCount, session);

  return { cylinderType, tank, filled };
}

async function reverseFillingStock({ storageTankId, cylinderTypeId, cylinderCount, actualLpgUsedKg }, session) {
  await restoreTank(storageTankId, actualLpgUsedKg, session);
  const filledItem = await findCylinderStock(cylinderTypeId, 'filled-cylinder', session);
  if (filledItem) {
    const updated = await InventoryItem.findOneAndUpdate(
      { _id: filledItem._id, currentQuantity: { $gte: cylinderCount } },
      { $inc: { currentQuantity: -cylinderCount } },
      { new: true, session }
    );
    if (!updated) {
      throw new ApiError(400, 'Cannot reverse filling; filled stock was already used');
    }
  }
}

function resolveFillingQty(body, cylinderType, existing) {
  const cylinderCount = body.cylinderCount ?? existing?.cylinderCount;
  const targetFillWeightKg = body.targetFillWeightKg ?? existing?.targetFillWeightKg ?? cylinderType.capacityKg;
  const actualLpgUsedKg = body.actualLpgUsedKg ?? existing?.actualLpgUsedKg ?? cylinderCount * targetFillWeightKg;
  return { cylinderCount, targetFillWeightKg, actualLpgUsedKg };
}

async function createFilling(body, req) {
  const result = await withTransaction(async (session) => {
    await assertEmployee(body.operatorEmployeeId, session);
    const cylinderType = await assertCylinderType(body.cylinderTypeId, session);
    const qty = resolveFillingQty(body, cylinderType);
    const stock = await applyFillingStock({
      storageTankId: body.storageTankId,
      cylinderTypeId: body.cylinderTypeId,
      cylinderCount: qty.cylinderCount,
      actualLpgUsedKg: qty.actualLpgUsedKg,
    }, session);

    const batchNumber = await assignNumber(FillingBatch, 'batchNumber', 'FLL', body.batchNumber, session);
    const payload = {
      batchNumber,
      storageTankId: body.storageTankId,
      cylinderTypeId: body.cylinderTypeId,
      cylinderCount: qty.cylinderCount,
      targetFillWeightKg: qty.targetFillWeightKg,
      actualLpgUsedKg: qty.actualLpgUsedKg,
      fillingDate: body.fillingDate || new Date(),
      operatorEmployeeId: body.operatorEmployeeId,
      createdByUserId: req.user._id,
      remarks: body.remarks || '',
    };

    const [doc] = await FillingBatch.create([payload], { session });
    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'filling-batches',
      entityName: 'FillingBatch',
      entityId: doc._id,
      newValues: {
        ...payload,
        tankQuantityAfterKg: stock.tank.currentQuantityKg,
        filledQuantityAfter: stock.filled.currentQuantity,
      },
    });

    return {
      id: doc._id,
      tankQuantityAfterKg: stock.tank.currentQuantityKg,
      filledQuantityAfter: stock.filled.currentQuantity,
    };
  });

  invalidateOps();
  const batch = await getFillingById(result.id);
  return {
    ...batch.toObject(),
    tankQuantityAfterKg: result.tankQuantityAfterKg,
    filledQuantityAfter: result.filledQuantityAfter,
  };
}

async function updateFilling(id, body, req) {
  const result = await withTransaction(async (session) => {
    const existing = await FillingBatch.findById(id).session(session);
    if (!existing) {
      throw new ApiError(404, 'FillingBatch not found');
    }

    if (body.batchNumber && body.batchNumber !== existing.batchNumber) {
      const taken = await FillingBatch.findOne({ batchNumber: body.batchNumber, _id: { $ne: id } }).session(session);
      if (taken) {
        throw new ApiError(409, 'batchNumber already exists');
      }
    }

    const nextTankId = body.storageTankId || existing.storageTankId;
    const nextTypeId = body.cylinderTypeId || existing.cylinderTypeId;
    const nextEmployeeId = body.operatorEmployeeId || existing.operatorEmployeeId;
    if (String(nextEmployeeId) !== String(existing.operatorEmployeeId)) {
      await assertEmployee(nextEmployeeId, session);
    }

    const cylinderType = await assertCylinderType(nextTypeId, session);
    const qty = resolveFillingQty(body, cylinderType, existing);

    const stockChanged =
      qty.cylinderCount !== existing.cylinderCount
      || qty.actualLpgUsedKg !== existing.actualLpgUsedKg
      || String(nextTankId) !== String(existing.storageTankId)
      || String(nextTypeId) !== String(existing.cylinderTypeId);

    if (stockChanged) {
      await reverseFillingStock({
        storageTankId: existing.storageTankId,
        cylinderTypeId: existing.cylinderTypeId,
        cylinderCount: existing.cylinderCount,
        actualLpgUsedKg: existing.actualLpgUsedKg,
      }, session);
      await applyFillingStock({
        storageTankId: nextTankId,
        cylinderTypeId: nextTypeId,
        cylinderCount: qty.cylinderCount,
        actualLpgUsedKg: qty.actualLpgUsedKg,
      }, session);
    }

    const oldValues = {
      cylinderCount: existing.cylinderCount,
      actualLpgUsedKg: existing.actualLpgUsedKg,
      storageTankId: existing.storageTankId,
      cylinderTypeId: existing.cylinderTypeId,
    };

    existing.batchNumber = body.batchNumber || existing.batchNumber;
    existing.storageTankId = nextTankId;
    existing.cylinderTypeId = nextTypeId;
    existing.cylinderCount = qty.cylinderCount;
    existing.targetFillWeightKg = qty.targetFillWeightKg;
    existing.actualLpgUsedKg = qty.actualLpgUsedKg;
    existing.operatorEmployeeId = nextEmployeeId;
    if (body.fillingDate !== undefined) existing.fillingDate = body.fillingDate;
    if (body.remarks !== undefined) existing.remarks = body.remarks;
    await existing.save({ session });

    await writeAudit({
      req,
      session,
      actionName: 'update',
      moduleName: 'filling-batches',
      entityName: 'FillingBatch',
      entityId: existing._id,
      oldValues,
      newValues: body,
    });

    return existing._id;
  });

  invalidateOps();
  return getFillingById(result);
}

const receipt = {
  create: createReceipt,
  list: listReceipts,
  getById: getReceiptById,
  update: updateReceipt,
};

const filling = {
  create: createFilling,
  list: listFillings,
  getById: getFillingById,
  update: updateFilling,
};

module.exports = {
  receipt,
  filling,
};
