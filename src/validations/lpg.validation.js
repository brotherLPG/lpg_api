const { z } = require('zod');
const {
  objectId,
  code,
  nonNegative,
  positiveKg,
  idParamSchema,
  listMasterQuery,
  atLeastOneField,
} = require('./common.validation');
const { RECEIPT_STATUS_VALUES, BATCH_STATUS_VALUES, PAYMENT_METHODS, PAYMENT_STATUSES } = require('../constants/masters');

const optionalDate = z.coerce.date().optional();
const optionalCode = code.optional();
const optionalAccountId = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'object' && value._id) return String(value._id);
  return value;
}, objectId.optional());

const receiptPayment = z.object({
  accountId: optionalAccountId,
  paymentAmount: nonNegative.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  referenceNumber: z.string().trim().max(80).optional(),
});

const receiptPaymentFields = {
  amountPaid: nonNegative.optional(),
  accountId: optionalAccountId,
  paymentAccountId: optionalAccountId,
  paidFromAccountId: optionalAccountId,
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  referenceNumber: z.string().trim().max(80).optional(),
  payment: receiptPayment.optional(),
};

const receiptCreateBody = {
  receiptNumber: optionalCode,
  supplierId: objectId,
  storageTankId: objectId.optional(),
  receivedQuantityKg: positiveKg,
  purchaseRatePerKg: nonNegative,
  truckRegistrationNumber: z.string().trim().min(3).max(40),
  receivedAt: optionalDate,
  supplierInvoiceNumber: z.string().trim().min(2).max(80),
  receivedByEmployeeId: objectId,
  remarks: z.string().trim().max(1000).optional(),
  receiptStatus: z.enum(RECEIPT_STATUS_VALUES).optional(),
  saveAsDraft: z.boolean().optional(),
  ...receiptPaymentFields,
};

const receiptUpdateBody = {
  receiptNumber: optionalCode,
  supplierId: objectId.optional(),
  storageTankId: objectId.optional(),
  receivedQuantityKg: positiveKg.optional(),
  purchaseRatePerKg: nonNegative.optional(),
  truckRegistrationNumber: z.string().trim().min(3).max(40).optional(),
  receivedAt: optionalDate,
  supplierInvoiceNumber: z.string().trim().min(2).max(80).optional(),
  receivedByEmployeeId: objectId.optional(),
  remarks: z.string().trim().max(1000).optional(),
  receiptStatus: z.enum(RECEIPT_STATUS_VALUES).optional(),
  saveAsDraft: z.boolean().optional(),
  ...receiptPaymentFields,
};

const fillingCreateBody = {
  batchNumber: optionalCode,
  storageTankId: objectId.optional(),
  cylinderTypeId: objectId,
  cylinderCount: z.coerce.number().int().min(1),
  targetFillWeightKg: positiveKg,
  residualRecoveredKg: nonNegative.optional(),
  actualLpgUsedKg: positiveKg.optional(),
  fillingDate: z.coerce.date(),
  operatorEmployeeId: objectId,
  remarks: z.string().trim().max(1000).optional(),
  batchStatus: z.enum(BATCH_STATUS_VALUES).optional(),
};

const fillingUpdateBody = {
  batchNumber: optionalCode,
  storageTankId: objectId.optional(),
  cylinderTypeId: objectId.optional(),
  cylinderCount: z.coerce.number().int().min(1).optional(),
  targetFillWeightKg: positiveKg.optional(),
  residualRecoveredKg: nonNegative.optional(),
  actualLpgUsedKg: positiveKg.optional(),
  fillingDate: optionalDate,
  operatorEmployeeId: objectId.optional(),
  remarks: z.string().trim().max(1000).optional(),
  batchStatus: z.enum(BATCH_STATUS_VALUES).optional(),
};

const receiptList = listMasterQuery({
  supplierId: objectId.optional(),
  storageTankId: objectId.optional(),
  receiptStatus: z.enum(RECEIPT_STATUS_VALUES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  date: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const fillingList = listMasterQuery({
  storageTankId: objectId.optional(),
  cylinderTypeId: objectId.optional(),
  operatorEmployeeId: objectId.optional(),
  batchStatus: z.enum(BATCH_STATUS_VALUES).optional(),
  date: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const lpgReceipt = {
  create: z.object({ body: z.object(receiptCreateBody) }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(receiptUpdateBody)),
  }),
  list: receiptList,
  idParam: idParamSchema,
};

const fillingBatch = {
  create: z.object({ body: z.object(fillingCreateBody) }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(fillingUpdateBody)),
  }),
  list: fillingList,
  idParam: idParamSchema,
};

module.exports = { lpgReceipt, fillingBatch };
