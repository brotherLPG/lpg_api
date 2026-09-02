const { z } = require('zod');
const {
  objectId,
  code,
  nonNegative,
  idParamSchema,
  listMasterQuery,
  atLeastOneField,
} = require('./common.validation');
const {
  ASSET_CATEGORIES,
  MAINTENANCE_ASSET_STATUSES,
  MAINTENANCE_TYPES,
  ASSET_STATUSES,
  DEPRECIATION_METHODS,
} = require('../constants/masters');

const optionalDate = z.coerce.date().nullish();
const optionalCode = code.optional();

function createUpdateSchema(bodyShape) {
  return z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(bodyShape).partial()),
  });
}

function createSchema(bodyShape) {
  return z.object({ body: z.object(bodyShape) });
}

const maintenanceAssetBody = {
  assetCode: optionalCode,
  assetName: z.string().trim().min(2).max(160),
  assetCategory: z.enum(ASSET_CATEGORIES),
  manufacturerName: z.string().trim().max(120).optional(),
  modelNumber: z.string().trim().max(80).optional(),
  serialNumber: z.string().trim().max(80).nullish(),
  locationName: z.string().trim().max(160).optional(),
  operationalStatus: z.enum(MAINTENANCE_ASSET_STATUSES).optional(),
};

const maintenanceRecordBody = {
  maintenanceNumber: optionalCode,
  maintenanceAssetId: objectId,
  maintenanceType: z.enum(MAINTENANCE_TYPES),
  maintenanceDate: optionalDate,
  problemDescription: z.string().trim().max(500).optional(),
  workPerformed: z.string().trim().max(1000).optional(),
  maintenanceCostAmount: nonNegative.optional(),
  nextMaintenanceDate: optionalDate,
  performedByEmployeeId: objectId,
};

const maintenanceRecordUpdateBody = {
  maintenanceNumber: optionalCode,
  maintenanceAssetId: objectId.optional(),
  maintenanceType: z.enum(MAINTENANCE_TYPES).optional(),
  maintenanceDate: optionalDate,
  problemDescription: z.string().trim().max(500).optional(),
  workPerformed: z.string().trim().max(1000).optional(),
  maintenanceCostAmount: nonNegative.optional(),
  nextMaintenanceDate: optionalDate,
  performedByEmployeeId: objectId.optional(),
};

const assetBody = {
  assetCode: optionalCode,
  assetName: z.string().trim().min(2).max(160),
  assetCategory: z.enum(ASSET_CATEGORIES),
  purchaseDate: optionalDate,
  purchaseCostAmount: nonNegative.optional(),
  locationName: z.string().trim().max(160).optional(),
  assignedEmployeeId: objectId.nullish(),
  depreciationMethod: z.enum(DEPRECIATION_METHODS).optional(),
  currentBookValueAmount: nonNegative.optional(),
  assetStatus: z.enum(ASSET_STATUSES).optional(),
};

const maintenanceAsset = {
  create: createSchema(maintenanceAssetBody),
  update: createUpdateSchema(maintenanceAssetBody),
  list: listMasterQuery({
    assetCategory: z.enum(ASSET_CATEGORIES).optional(),
    operationalStatus: z.enum(MAINTENANCE_ASSET_STATUSES).optional(),
  }),
  idParam: idParamSchema,
};

const maintenanceRecord = {
  create: createSchema(maintenanceRecordBody),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(maintenanceRecordUpdateBody)),
  }),
  list: listMasterQuery({
    maintenanceAssetId: objectId.optional(),
    performedByEmployeeId: objectId.optional(),
    maintenanceType: z.enum(MAINTENANCE_TYPES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

const asset = {
  create: createSchema(assetBody),
  update: createUpdateSchema(assetBody),
  list: listMasterQuery({
    assetCategory: z.enum(ASSET_CATEGORIES).optional(),
    assetStatus: z.enum(ASSET_STATUSES).optional(),
    assignedEmployeeId: objectId.optional(),
  }),
  idParam: idParamSchema,
};

module.exports = { maintenanceAsset, maintenanceRecord, asset };
