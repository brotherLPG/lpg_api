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
const { RECEIPT_STATUSES, BATCH_STATUSES } = require('../constants/masters');

const RECEIPT_POPULATE = [
  { path: 'supplierId', select: 'supplierCode supplierName contactPersonName phoneNumber city isActive' },
  { path: 'storageTankId', select: 'tankCode tankName capacityKg currentQuantityKg tankStatus' },
  { path: 'receivedByUserId', select: 'fullName emailAddress' },
  { path: 'receivedByEmployeeId', select: 'employeeCode fullName jobTitle employmentStatus' },
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
  if (query.date) {
    const start = new Date(query.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter[field] = { $gte: start, $lt: end };
    return filter;
  }
  if (!query.startDate && !query.endDate) return filter;
  filter[field] = {};
  if (query.startDate) filter[field].$gte = new Date(query.startDate);
  if (query.endDate) filter[field].$lte = new Date(query.endDate);
  return filter;
}

function receiptStatusOf(doc) {
  return doc.receiptStatus || 'confirmed';
}

function receiptStatusLabel(status) {
  return RECEIPT_STATUSES.find((item) => item.value === status)?.label || 'Confirmed';
}

function employeeLabel(employee) {
  if (!employee || !employee.fullName) return '';
  return employee.jobTitle ? `${employee.fullName} (${employee.jobTitle})` : employee.fullName;
}

function resolveReceiptStatus(body, fallback = 'confirmed') {
  if (body.saveAsDraft === true) return 'pending';
  if (body.receiptStatus) return body.receiptStatus;
  return fallback;
}

function toReceiptItem(doc) {
  const receiptStatus = receiptStatusOf(doc);
  const tank = doc.storageTankId && doc.storageTankId.tankCode ? doc.storageTankId : null;
  const employee = doc.receivedByEmployeeId && doc.receivedByEmployeeId.fullName
    ? doc.receivedByEmployeeId
    : null;

  return {
    _id: doc._id,
    receiptNumber: doc.receiptNumber,
    supplierId: doc.supplierId?._id || doc.supplierId,
    supplierName: doc.supplierId?.supplierName || '',
    supplier: doc.supplierId && doc.supplierId.supplierName
      ? {
          _id: doc.supplierId._id,
          supplierCode: doc.supplierId.supplierCode,
          supplierName: doc.supplierId.supplierName,
        }
      : doc.supplierId,
    receivedAt: doc.receivedAt,
    truckRegistrationNumber: doc.truckRegistrationNumber || '',
    receivedQuantityKg: doc.receivedQuantityKg,
    purchaseRatePerKg: doc.purchaseRatePerKg || 0,
    totalPurchaseAmount: doc.totalPurchaseAmount || 0,
    receiptStatus,
    receiptStatusLabel: receiptStatusLabel(receiptStatus),
    supplierInvoiceNumber: doc.supplierInvoiceNumber || '',
    remarks: doc.remarks || '',
    receivedByUserId: doc.receivedByUserId,
    receivedByEmployeeId: employee
      ? {
          _id: employee._id,
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          jobTitle: employee.jobTitle || '',
        }
      : doc.receivedByEmployeeId || null,
    receivedByEmployeeName: employeeLabel(employee),
    storageTankId: tank?._id || doc.storageTankId || null,
    tank: tank
      ? {
          _id: tank._id,
          tankCode: tank.tankCode,
          tankName: tank.tankName,
          currentQuantityKg: tank.currentQuantityKg,
          capacityKg: tank.capacityKg,
        }
      : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function resolveBatchStatus(body, fallback = 'pending') {
  if (body.batchStatus) return body.batchStatus;
  return fallback;
}

function batchStatusOf(doc) {
  return doc.batchStatus || 'completed';
}

function batchStatusLabel(status) {
  return BATCH_STATUSES.find((item) => item.value === status)?.label || 'Completed';
}

function tankDisplayName(tank) {
  if (!tank) return '';
  const current = tank.currentQuantityKg || 0;
  const capacity = tank.capacityKg || 0;
  return `${tank.tankCode} — ${tank.tankName} (${current.toLocaleString('en-US')} / ${capacity.toLocaleString('en-US')} KG)`;
}

function toFillingItem(doc) {
  const batchStatus = batchStatusOf(doc);
  const tank = doc.storageTankId && doc.storageTankId.tankCode ? doc.storageTankId : null;
  const type = doc.cylinderTypeId && doc.cylinderTypeId.typeName ? doc.cylinderTypeId : null;
  const operator = doc.operatorEmployeeId && doc.operatorEmployeeId.fullName ? doc.operatorEmployeeId : null;

  return {
    _id: doc._id,
    batchNumber: doc.batchNumber,
    fillingDate: doc.fillingDate,
    cylinderCount: doc.cylinderCount,
    targetFillWeightKg: doc.targetFillWeightKg,
    actualLpgUsedKg: doc.actualLpgUsedKg,
    remarks: doc.remarks || '',
    batchStatus,
    batchStatusLabel: batchStatusLabel(batchStatus),
    storageTankId: tank?._id || doc.storageTankId || null,
    sourceTankName: tank?.tankName || '',
    tank: tank
      ? {
          _id: tank._id,
          tankCode: tank.tankCode,
          tankName: tank.tankName,
          currentQuantityKg: tank.currentQuantityKg,
          capacityKg: tank.capacityKg,
          displayName: tankDisplayName(tank),
        }
      : null,
    cylinderTypeId: type?._id || doc.cylinderTypeId || null,
    cylinderTypeName: type?.typeName || '',
    cylinderType: type
      ? {
          _id: type._id,
          typeCode: type.typeCode,
          typeName: type.typeName,
          capacityKg: type.capacityKg,
        }
      : null,
    operatorEmployeeId: operator?._id || doc.operatorEmployeeId || null,
    operatorName: employeeLabel(operator),
    operator: operator
      ? {
          _id: operator._id,
          employeeCode: operator.employeeCode,
          fullName: operator.fullName,
          jobTitle: operator.jobTitle || '',
        }
      : null,
    createdByUserId: doc.createdByUserId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function currentMonthRange(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
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

async function resolveTankId(storageTankId, session) {
  if (storageTankId) {
    await assertTank(storageTankId, session);
    return storageTankId;
  }
  const tank = await StorageTank.findOne().sort({ createdAt: 1 }).session(session);
  if (!tank) {
    throw new ApiError(400, 'No storage tank is configured');
  }
  await assertTank(tank._id, session);
  return tank._id;
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

async function getReceiptFormOptions() {
  const [suppliers, employees, tank, nextReceiptNumber] = await Promise.all([
    Supplier.find({ isActive: true }).select('supplierCode supplierName contactPersonName').sort({ supplierName: 1 }).lean(),
    Employee.find({ employmentStatus: { $ne: 'terminated' } })
      .select('employeeCode fullName jobTitle employmentStatus')
      .sort({ fullName: 1 })
      .lean(),
    StorageTank.findOne().sort({ createdAt: 1 }).lean(),
    nextSequentialCode(LPGReceipt, 'receiptNumber', 'RCP'),
  ]);

  if (!tank) {
    throw new ApiError(400, 'No storage tank is configured');
  }

  return {
    nextReceiptNumber,
    suppliers: suppliers.map((supplier) => ({
      _id: supplier._id,
      supplierCode: supplier.supplierCode,
      supplierName: supplier.supplierName,
    })),
    employees: employees.map((employee) => ({
      _id: employee._id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle || '',
      displayName: employeeLabel(employee),
    })),
    tank: {
      _id: tank._id,
      tankCode: tank.tankCode,
      tankName: tank.tankName,
      currentQuantityKg: tank.currentQuantityKg,
      capacityKg: tank.capacityKg,
      availableCapacityKg: roundMoney((tank.capacityKg || 0) - (tank.currentQuantityKg || 0)),
      tankStatus: tank.tankStatus,
    },
  };
}

async function getFillingFormOptions() {
  const [cylinderTypes, employees, tank, nextBatchNumber] = await Promise.all([
    CylinderType.find({ isActive: true })
      .select('typeCode typeName capacityKg cylinderCategory tareWeightKg sellingPricePerCylinder')
      .sort({ capacityKg: 1 })
      .lean(),
    Employee.find({ employmentStatus: { $ne: 'terminated' } })
      .select('employeeCode fullName jobTitle employmentStatus')
      .sort({ fullName: 1 })
      .lean(),
    StorageTank.findOne().sort({ createdAt: 1 }).lean(),
    nextSequentialCode(FillingBatch, 'batchNumber', 'FLL'),
  ]);

  if (!tank) {
    throw new ApiError(400, 'No storage tank is configured');
  }

  return {
    nextBatchNumber,
    statuses: BATCH_STATUSES,
    tank: {
      _id: tank._id,
      tankCode: tank.tankCode,
      tankName: tank.tankName,
      currentQuantityKg: tank.currentQuantityKg,
      capacityKg: tank.capacityKg,
      availableCapacityKg: roundMoney((tank.capacityKg || 0) - (tank.currentQuantityKg || 0)),
      tankStatus: tank.tankStatus,
      displayName: tankDisplayName(tank),
    },
    cylinderTypes: cylinderTypes.map((type) => ({
      _id: type._id,
      typeCode: type.typeCode,
      typeName: type.typeName,
      capacityKg: type.capacityKg,
      cylinderCategory: type.cylinderCategory || '',
    })),
    employees: employees.map((employee) => ({
      _id: employee._id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      jobTitle: employee.jobTitle || '',
      displayName: employeeLabel(employee),
    })),
  };
}

async function getReceiptById(id) {
  const [doc, form] = await Promise.all([
    populateQuery(LPGReceipt.findById(id), RECEIPT_POPULATE),
    getReceiptFormOptions(),
  ]);
  if (!doc) {
    throw new ApiError(404, 'LPGReceipt not found');
  }
  return {
    ...toReceiptItem(doc),
    form,
  };
}

async function getFillingById(id) {
  const [doc, form] = await Promise.all([
    populateQuery(FillingBatch.findById(id), FILLING_POPULATE),
    getFillingFormOptions(),
  ]);
  if (!doc) {
    throw new ApiError(404, 'FillingBatch not found');
  }
  return {
    ...toFillingItem(doc),
    form,
  };
}

async function listReceipts(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'receivedAt', query);
  if (query.supplierId) filter.supplierId = query.supplierId;
  if (query.storageTankId) filter.storageTankId = query.storageTankId;
  if (query.receiptStatus === 'pending') {
    filter.receiptStatus = 'pending';
  } else if (query.receiptStatus === 'confirmed') {
    filter.receiptStatus = { $ne: 'pending' };
  }

  if (query.search) {
    const search = query.search.trim();
    const matchingSuppliers = await Supplier.find({
      supplierName: { $regex: search, $options: 'i' },
    }).select('_id');
    filter.$or = [
      { receiptNumber: { $regex: search, $options: 'i' } },
      { supplierInvoiceNumber: { $regex: search, $options: 'i' } },
      { truckRegistrationNumber: { $regex: search, $options: 'i' } },
      { supplierId: { $in: matchingSuppliers.map((supplier) => supplier._id) } },
    ];
  }

  const { start: monthStart, end: monthEnd } = currentMonthRange();
  const findQuery = populateQuery(
    LPGReceipt.find(filter).sort({ receivedAt: -1, createdAt: -1 }).skip(skip).limit(limit),
    RECEIPT_POPULATE
  );

  const [items, total, monthAgg, pendingReceipts, suppliers] = await Promise.all([
    findQuery.lean(),
    LPGReceipt.countDocuments(filter),
    LPGReceipt.aggregate([
      { $match: { receivedAt: { $gte: monthStart, $lt: monthEnd } } },
      {
        $group: {
          _id: null,
          shipmentCount: { $sum: 1 },
          quantityKg: { $sum: '$receivedQuantityKg' },
          purchaseCost: { $sum: '$totalPurchaseAmount' },
        },
      },
    ]),
    LPGReceipt.countDocuments({ receiptStatus: 'pending' }),
    Supplier.find({ isActive: true }).select('supplierCode supplierName').sort({ supplierName: 1 }).lean(),
  ]);

  const month = monthAgg[0] || { shipmentCount: 0, quantityKg: 0, purchaseCost: 0 };

  return {
    ...paginated(items.map(toReceiptItem), total, page, limit),
    summary: {
      thisMonthReceipts: month.shipmentCount || 0,
      thisMonthQuantityKg: roundMoney(month.quantityKg || 0),
      thisMonthPurchaseCost: roundMoney(month.purchaseCost || 0),
      pendingReceipts,
    },
    meta: {
      statuses: RECEIPT_STATUSES,
      suppliers: suppliers.map((supplier) => ({
        _id: supplier._id,
        supplierCode: supplier.supplierCode,
        supplierName: supplier.supplierName,
      })),
    },
  };
}

async function listFillings(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = applyDateRange({}, 'fillingDate', query);
  if (query.storageTankId) filter.storageTankId = query.storageTankId;
  if (query.cylinderTypeId) filter.cylinderTypeId = query.cylinderTypeId;
  if (query.operatorEmployeeId) filter.operatorEmployeeId = query.operatorEmployeeId;
  if (query.batchStatus === 'pending') {
    filter.batchStatus = 'pending';
  } else if (query.batchStatus === 'completed') {
    filter.batchStatus = { $ne: 'pending' };
  }

  if (query.search) {
    const search = query.search.trim();
    const regex = { $regex: search, $options: 'i' };
    const [tanks, types, operators] = await Promise.all([
      StorageTank.find({ $or: [{ tankName: regex }, { tankCode: regex }] }).select('_id'),
      CylinderType.find({ $or: [{ typeName: regex }, { typeCode: regex }] }).select('_id'),
      Employee.find({ fullName: regex }).select('_id'),
    ]);
    filter.$or = [
      { batchNumber: regex },
      { remarks: regex },
      { storageTankId: { $in: tanks.map((item) => item._id) } },
      { cylinderTypeId: { $in: types.map((item) => item._id) } },
      { operatorEmployeeId: { $in: operators.map((item) => item._id) } },
    ];
  }

  const findQuery = populateQuery(
    FillingBatch.find(filter).sort({ fillingDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    FILLING_POPULATE
  );

  const [items, total, summaryAgg, pending] = await Promise.all([
    findQuery.lean(),
    FillingBatch.countDocuments(filter),
    FillingBatch.aggregate([
      {
        $group: {
          _id: null,
          totalBatches: { $sum: 1 },
          totalQuantityKg: {
            $sum: {
              $cond: [{ $ne: ['$batchStatus', 'pending'] }, '$actualLpgUsedKg', 0],
            },
          },
          completed: {
            $sum: { $cond: [{ $ne: ['$batchStatus', 'pending'] }, 1, 0] },
          },
        },
      },
    ]),
    FillingBatch.countDocuments({ batchStatus: 'pending' }),
  ]);

  const stats = summaryAgg[0] || { totalBatches: 0, totalQuantityKg: 0, completed: 0 };

  return {
    ...paginated(items.map(toFillingItem), total, page, limit),
    summary: {
      totalBatches: stats.totalBatches || 0,
      totalQuantityKg: roundMoney(stats.totalQuantityKg || 0),
      completed: stats.completed || 0,
      pending,
    },
    meta: {
      statuses: BATCH_STATUSES,
    },
  };
}

async function createReceipt(body, req) {
  const result = await withTransaction(async (session) => {
    await assertSupplier(body.supplierId, session);
    await assertEmployee(body.receivedByEmployeeId, session);
    const tank = await StorageTank.findById(await resolveTankId(body.storageTankId, session)).session(session);
    if (!tank) {
      throw new ApiError(400, 'No storage tank is configured');
    }
    await assertTank(tank._id, session);

    const receiptNumber = await assignNumber(LPGReceipt, 'receiptNumber', 'RCP', body.receiptNumber, session);
    const receivedQuantityKg = body.receivedQuantityKg;
    const purchaseRatePerKg = body.purchaseRatePerKg;
    const receiptStatus = resolveReceiptStatus(body, 'confirmed');
    const quantityBeforeKg = tank.currentQuantityKg || 0;
    const payload = {
      receiptNumber,
      supplierId: body.supplierId,
      storageTankId: tank._id,
      receivedQuantityKg,
      purchaseRatePerKg,
      totalPurchaseAmount: computePurchaseAmount(receivedQuantityKg, purchaseRatePerKg),
      truckRegistrationNumber: body.truckRegistrationNumber,
      receivedAt: body.receivedAt || new Date(),
      supplierInvoiceNumber: body.supplierInvoiceNumber,
      receivedByUserId: req.user._id,
      receivedByEmployeeId: body.receivedByEmployeeId,
      remarks: body.remarks || '',
      receiptStatus,
    };

    const [doc] = await LPGReceipt.create([payload], { session });
    let quantityAfterKg = quantityBeforeKg;
    if (receiptStatus === 'confirmed') {
      const updatedTank = await incrementTank(tank._id, receivedQuantityKg, session);
      quantityAfterKg = updatedTank.currentQuantityKg;
    }

    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'lpg-receipts',
      entityName: 'LPGReceipt',
      entityId: doc._id,
      newValues: {
        ...payload,
        tankQuantityAfterKg: quantityAfterKg,
      },
    });

    return {
      id: doc._id,
      inventoryUpdate: {
        tankCode: tank.tankCode,
        tankName: tank.tankName,
        quantityBeforeKg,
        quantityAfterKg,
        applied: receiptStatus === 'confirmed',
      },
    };
  });

  invalidateOps();
  const receipt = await getReceiptById(result.id);
  return {
    ...receipt,
    tankQuantityAfterKg: result.inventoryUpdate.quantityAfterKg,
    inventoryUpdate: result.inventoryUpdate,
  };
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
    const previousStatus = receiptStatusOf(existing);
    const nextStatus = resolveReceiptStatus(body, previousStatus);

    if (String(nextSupplierId) !== String(existing.supplierId)) {
      await assertSupplier(nextSupplierId, session);
    }
    if (body.receivedByEmployeeId && String(body.receivedByEmployeeId) !== String(existing.receivedByEmployeeId)) {
      await assertEmployee(body.receivedByEmployeeId, session);
    }

    const qtyChanged = nextQty !== existing.receivedQuantityKg;
    const tankChanged = String(nextTankId) !== String(existing.storageTankId);
    const wasConfirmed = previousStatus === 'confirmed';
    const willConfirm = nextStatus === 'confirmed';

    if (wasConfirmed && willConfirm && (qtyChanged || tankChanged)) {
      await decrementTank(existing.storageTankId, existing.receivedQuantityKg, session);
      await assertTank(nextTankId, session);
      await incrementTank(nextTankId, nextQty, session);
    } else if (!wasConfirmed && willConfirm) {
      await assertTank(nextTankId, session);
      await incrementTank(nextTankId, nextQty, session);
    } else if (wasConfirmed && !willConfirm) {
      await decrementTank(existing.storageTankId, existing.receivedQuantityKg, session);
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
    existing.receiptStatus = nextStatus;
    if (body.receivedByEmployeeId !== undefined) existing.receivedByEmployeeId = body.receivedByEmployeeId;
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
    const storageTankId = await resolveTankId(body.storageTankId, session);
    const tank = await StorageTank.findById(storageTankId).session(session);
    const batchStatus = resolveBatchStatus(body, 'pending');
    const quantityBeforeKg = tank?.currentQuantityKg || 0;

    let stock = { tank, filled: null };
    if (batchStatus === 'completed') {
      stock = await applyFillingStock({
        storageTankId,
        cylinderTypeId: body.cylinderTypeId,
        cylinderCount: qty.cylinderCount,
        actualLpgUsedKg: qty.actualLpgUsedKg,
      }, session);
    }

    const batchNumber = await assignNumber(FillingBatch, 'batchNumber', 'FLL', body.batchNumber, session);
    const payload = {
      batchNumber,
      storageTankId,
      cylinderTypeId: body.cylinderTypeId,
      cylinderCount: qty.cylinderCount,
      targetFillWeightKg: qty.targetFillWeightKg,
      actualLpgUsedKg: qty.actualLpgUsedKg,
      fillingDate: body.fillingDate,
      operatorEmployeeId: body.operatorEmployeeId,
      createdByUserId: req.user._id,
      remarks: body.remarks || '',
      batchStatus,
    };

    const [doc] = await FillingBatch.create([payload], { session });
    const quantityAfterKg = stock.tank?.currentQuantityKg ?? quantityBeforeKg;
    await writeAudit({
      req,
      session,
      actionName: 'create',
      moduleName: 'filling-batches',
      entityName: 'FillingBatch',
      entityId: doc._id,
      newValues: {
        ...payload,
        tankQuantityAfterKg: quantityAfterKg,
      },
    });

    return {
      id: doc._id,
      inventoryUpdate: {
        tankCode: tank.tankCode,
        tankName: tank.tankName,
        quantityBeforeKg,
        quantityAfterKg,
        lpgUsedKg: qty.actualLpgUsedKg,
        applied: batchStatus === 'completed',
      },
    };
  });

  invalidateOps();
  const batch = await getFillingById(result.id);
  return {
    ...batch,
    tankQuantityAfterKg: result.inventoryUpdate.quantityAfterKg,
    inventoryUpdate: result.inventoryUpdate,
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
    const previousStatus = batchStatusOf(existing);
    const nextStatus = resolveBatchStatus(body, previousStatus);
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
    const wasCompleted = previousStatus === 'completed';
    const willComplete = nextStatus === 'completed';

    if (wasCompleted && willComplete && stockChanged) {
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
    } else if (!wasCompleted && willComplete) {
      await applyFillingStock({
        storageTankId: nextTankId,
        cylinderTypeId: nextTypeId,
        cylinderCount: qty.cylinderCount,
        actualLpgUsedKg: qty.actualLpgUsedKg,
      }, session);
    } else if (wasCompleted && !willComplete) {
      await reverseFillingStock({
        storageTankId: existing.storageTankId,
        cylinderTypeId: existing.cylinderTypeId,
        cylinderCount: existing.cylinderCount,
        actualLpgUsedKg: existing.actualLpgUsedKg,
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
    existing.batchStatus = nextStatus;
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
  getFormOptions: getReceiptFormOptions,
};

const filling = {
  create: createFilling,
  list: listFillings,
  getById: getFillingById,
  update: updateFilling,
  getFormOptions: getFillingFormOptions,
};

module.exports = {
  receipt,
  filling,
};
