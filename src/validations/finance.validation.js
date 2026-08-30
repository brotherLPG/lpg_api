const { z } = require('zod');
const {
  objectId,
  code,
  nonNegative,
  idParamSchema,
  listMasterQuery,
  atLeastOneField,
} = require('./common.validation');
const { PAYMENT_TYPES, PAYMENT_METHODS, SALE_STATUSES } = require('../constants/masters');

const optionalDate = z.coerce.date().optional();
const optionalCode = code.optional();
const positiveAmount = z.coerce.number().gt(0);
const positiveQty = z.coerce.number().gt(0);

const saleLine = z.object({
  inventoryItemId: objectId,
  itemDescription: z.string().trim().max(160).optional(),
  quantity: positiveQty,
  unitPriceAmount: nonNegative.optional(),
  discountAmount: nonNegative.optional(),
  taxAmount: nonNegative.optional(),
});

const salePayment = z.object({
  accountId: objectId,
  paymentAmount: positiveAmount,
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  referenceNumber: z.string().trim().max(80).optional(),
});

const sale = {
  create: z.object({
    body: z.object({
      invoiceNumber: optionalCode,
      customerId: objectId,
      invoiceDate: optionalDate,
      lineItems: z.array(saleLine).min(1),
      remarks: z.string().trim().max(500).optional(),
      payment: salePayment.optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(
      z.object({
        remarks: z.string().trim().max(500).optional(),
        saleStatus: z.enum(['cancelled']).optional(),
      })
    ),
  }),
  list: listMasterQuery({
    customerId: objectId.optional(),
    paymentStatus: z.string().optional(),
    saleStatus: z.enum(SALE_STATUSES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

const salesReturn = {
  create: z.object({
    body: z.object({
      returnNumber: optionalCode,
      originalSaleId: objectId,
      customerId: objectId.optional(),
      returnDate: optionalDate,
      returnReason: z.string().trim().max(300).optional(),
      returnItems: z.array(
        z.object({
          inventoryItemId: objectId,
          quantity: positiveQty,
        })
      ).min(1),
    }),
  }),
  list: listMasterQuery({
    customerId: objectId.optional(),
    originalSaleId: objectId.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

const payment = {
  create: z.object({
    body: z.object({
      paymentNumber: optionalCode,
      paymentType: z.enum(PAYMENT_TYPES),
      customerId: objectId.optional(),
      supplierId: objectId.optional(),
      saleId: objectId.optional(),
      accountId: objectId,
      paymentAmount: positiveAmount,
      paymentMethod: z.enum(PAYMENT_METHODS).optional(),
      paymentDate: optionalDate,
      referenceNumber: z.string().trim().max(80).optional(),
      remarks: z.string().trim().max(500).optional(),
    }).superRefine((data, ctx) => {
      if (data.paymentType === 'receive' || data.paymentType === 'refund') {
        if (!data.customerId && !data.saleId) {
          ctx.addIssue({ code: 'custom', message: 'customerId or saleId is required for this paymentType' });
        }
        if (data.supplierId) {
          ctx.addIssue({ code: 'custom', message: 'supplierId is not allowed for receive/refund' });
        }
      }
      if (data.paymentType === 'pay' && !data.supplierId) {
        ctx.addIssue({ code: 'custom', message: 'supplierId is required when paymentType is pay' });
      }
    }),
  }),
  list: listMasterQuery({
    customerId: objectId.optional(),
    supplierId: objectId.optional(),
    saleId: objectId.optional(),
    accountId: objectId.optional(),
    paymentType: z.enum(PAYMENT_TYPES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

const expense = {
  create: z.object({
    body: z.object({
      expenseNumber: optionalCode,
      expenseCategoryId: objectId,
      paidFromAccountId: objectId,
      expenseAmount: positiveAmount,
      expenseDescription: z.string().trim().min(2).max(300),
      expenseDate: optionalDate,
      paymentMethod: z.enum(PAYMENT_METHODS).optional(),
      remarks: z.string().trim().max(500).optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(
      z.object({
        expenseCategoryId: objectId.optional(),
        paidFromAccountId: objectId.optional(),
        expenseAmount: positiveAmount.optional(),
        expenseDescription: z.string().trim().min(2).max(300).optional(),
        expenseDate: optionalDate,
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        remarks: z.string().trim().max(500).optional(),
      })
    ),
  }),
  list: listMasterQuery({
    expenseCategoryId: objectId.optional(),
    paidFromAccountId: objectId.optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

module.exports = { sale, salesReturn, payment, expense };
