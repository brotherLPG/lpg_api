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
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_VOUCHER_STATUS_VALUES,
  EXPENSE_STATUS_VALUES,
  SALE_STATUSES,
  SALE_TYPE_VALUES,
  PAYMENT_TERM_DAYS,
  RETURN_REASON_VALUES,
} = require('../constants/masters');

const paymentTermDays = z.coerce
  .number()
  .int()
  .refine((value) => PAYMENT_TERM_DAYS.includes(value), {
    message: 'Invalid payment terms',
  });

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
      saleNumber: optionalCode,
      customerId: objectId,
      invoiceDate: z.coerce.date(),
      paymentTermDays: paymentTermDays.optional(),
      lineItems: z.array(saleLine).min(1),
      tradeDiscountAmount: nonNegative.optional(),
      amountPaid: nonNegative.optional(),
      accountId: objectId.optional(),
      remarks: z.string().trim().max(500).optional(),
      saveAsDraft: z.boolean().optional(),
      payment: salePayment.optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(
      z.object({
        remarks: z.string().trim().max(500).optional(),
        saleStatus: z.enum(['cancelled', 'confirmed']).optional(),
        accountId: objectId.optional(),
      })
    ),
  }),
  list: listMasterQuery({
    customerId: objectId.optional(),
    paymentStatus: z.string().optional(),
    saleStatus: z.enum(SALE_STATUSES).optional(),
    saleType: z.enum(SALE_TYPE_VALUES).optional(),
    type: z.enum(SALE_TYPE_VALUES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

const salesReturn = {
  create: z.object({
    body: z.object({
      returnNumber: optionalCode,
      originalSaleId: objectId.optional(),
      originalInvoiceNumber: z.string().trim().min(1).max(40).optional(),
      customerId: objectId.optional(),
      returnDate: z.coerce.date(),
      returnReason: z.enum(RETURN_REASON_VALUES),
      inspectionNotes: z.string().trim().max(1000).optional(),
      returnItems: z.array(
        z.object({
          inventoryItemId: objectId,
          quantity: positiveQty,
        })
      ).min(1),
    }).superRefine((data, ctx) => {
      if (!data.originalSaleId && !data.originalInvoiceNumber) {
        ctx.addIssue({
          code: 'custom',
          message: 'originalSaleId or originalInvoiceNumber is required',
          path: ['originalInvoiceNumber'],
        });
      }
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

const paymentAllocation = z.object({
  saleId: objectId,
  amountApplied: positiveAmount,
});

const payment = {
  create: z.object({
    body: z.object({
      paymentNumber: optionalCode,
      paymentType: z.enum(PAYMENT_TYPES).optional(),
      direction: z.enum(PAYMENT_DIRECTION_VALUES).optional(),
      customerId: objectId.optional(),
      supplierId: objectId.optional(),
      saleId: objectId.optional(),
      accountId: objectId,
      paymentAmount: positiveAmount,
      paymentMethod: z.enum(PAYMENT_METHODS),
      paymentDate: z.coerce.date(),
      referenceNumber: z.string().trim().max(80).optional(),
      remarks: z.string().trim().max(500).optional(),
      allocations: z.array(paymentAllocation).optional(),
      saveAsDraft: z.boolean().optional(),
    }).superRefine((data, ctx) => {
      const paymentType = data.paymentType || data.direction;
      if (!paymentType) {
        ctx.addIssue({ code: 'custom', message: 'paymentType or direction is required', path: ['paymentType'] });
        return;
      }
      if (paymentType === 'receive' || paymentType === 'refund') {
        if (!data.customerId && !data.saleId && !(data.allocations && data.allocations.length)) {
          ctx.addIssue({ code: 'custom', message: 'customerId or saleId is required for this paymentType' });
        }
        if (data.supplierId) {
          ctx.addIssue({ code: 'custom', message: 'supplierId is not allowed for receive/refund' });
        }
      }
      if (paymentType === 'pay' && !data.supplierId) {
        ctx.addIssue({ code: 'custom', message: 'supplierId is required when paymentType is pay' });
      }
    }),
  }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(
      z.object({
        paymentDate: optionalDate,
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        accountId: objectId.optional(),
        paymentAmount: positiveAmount.optional(),
        referenceNumber: z.string().trim().max(80).optional(),
        remarks: z.string().trim().max(500).optional(),
        allocations: z.array(paymentAllocation).optional(),
        customerId: objectId.optional(),
        supplierId: objectId.optional(),
        paymentStatus: z.enum(PAYMENT_VOUCHER_STATUS_VALUES).optional(),
        saveAsDraft: z.boolean().optional(),
      })
    ),
  }),
  list: listMasterQuery({
    customerId: objectId.optional(),
    supplierId: objectId.optional(),
    saleId: objectId.optional(),
    accountId: objectId.optional(),
    paymentType: z.enum(PAYMENT_TYPES).optional(),
    direction: z.enum(PAYMENT_DIRECTION_VALUES).optional(),
    paymentStatus: z.enum(PAYMENT_VOUCHER_STATUS_VALUES).optional(),
    status: z.enum(PAYMENT_VOUCHER_STATUS_VALUES).optional(),
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
      paidFromAccountId: objectId.optional(),
      expenseAmount: positiveAmount,
      expenseDescription: z.string().trim().min(2).max(1000),
      expenseDate: z.coerce.date(),
      vendorPayeeName: z.string().trim().max(160).optional(),
      paymentMethod: z.enum(PAYMENT_METHODS).optional(),
      referenceNumber: z.string().trim().max(80).optional(),
      paymentDate: optionalDate,
      remarks: z.string().trim().max(1000).optional(),
      expenseStatus: z.enum(EXPENSE_STATUS_VALUES).optional(),
      isApproved: z.boolean().optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(
      z.object({
        expenseCategoryId: objectId.optional(),
        paidFromAccountId: objectId.optional(),
        expenseAmount: positiveAmount.optional(),
        expenseDescription: z.string().trim().min(2).max(1000).optional(),
        expenseDate: optionalDate,
        vendorPayeeName: z.string().trim().max(160).optional(),
        paymentMethod: z.enum(PAYMENT_METHODS).optional(),
        referenceNumber: z.string().trim().max(80).optional(),
        paymentDate: optionalDate,
        remarks: z.string().trim().max(1000).optional(),
        expenseStatus: z.enum(EXPENSE_STATUS_VALUES).optional(),
        isApproved: z.boolean().optional(),
      })
    ),
  }),
  list: listMasterQuery({
    expenseCategoryId: objectId.optional(),
    paidFromAccountId: objectId.optional(),
    expenseStatus: z.enum(EXPENSE_STATUS_VALUES).optional(),
    status: z.enum(EXPENSE_STATUS_VALUES).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
  idParam: idParamSchema,
};

module.exports = { sale, salesReturn, payment, expense };
