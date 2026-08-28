const { z } = require('zod');
const {
  objectId,
  optionalEmail,
  code,
  nonNegative,
  positiveKg,
  idParamSchema,
  listMasterQuery,
  atLeastOneField,
} = require('./common.validation');
const {
  TANK_STATUSES,
  ACCOUNT_TYPES,
  EMPLOYMENT_STATUSES,
  ITEM_CATEGORIES,
  UNITS_OF_MEASURE,
} = require('../constants/masters');

const optionalDate = z.coerce.date().nullish();

const customerBody = {
  customerCode: code.optional(),
  customerName: z.string().trim().min(2).max(160),
  contactPersonName: z.string().trim().max(120).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  emailAddress: optionalEmail,
  billingAddress: z.string().trim().max(400).optional(),
  taxRegistrationNumber: z.string().trim().max(80).optional(),
  creditLimitAmount: nonNegative.optional(),
  paymentTermDays: z.coerce.number().int().min(0).optional(),
  openingBalanceAmount: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
};

const supplierBody = {
  supplierCode: code.optional(),
  supplierName: z.string().trim().min(2).max(160),
  contactPersonName: z.string().trim().max(120).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  emailAddress: optionalEmail,
  businessAddress: z.string().trim().max(400).optional(),
  taxRegistrationNumber: z.string().trim().max(80).optional(),
  paymentTermDays: z.coerce.number().int().min(0).optional(),
  openingBalanceAmount: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
};

const cylinderTypeBody = {
  typeCode: code.optional(),
  typeName: z.string().trim().min(2).max(120),
  capacityKg: positiveKg,
  tareWeightKg: nonNegative.optional(),
  sellingPricePerCylinder: nonNegative.optional(),
  isActive: z.boolean().optional(),
};

const storageTankCreateBody = {
  tankCode: code.optional(),
  tankName: z.string().trim().min(2).max(120),
  capacityKg: positiveKg,
  currentQuantityKg: nonNegative.optional(),
  minimumSafeQuantityKg: nonNegative.optional(),
  maximumSafeQuantityKg: nonNegative.optional(),
  tankStatus: z.enum(TANK_STATUSES).optional(),
  installationDate: optionalDate,
  locationDescription: z.string().trim().max(400).optional(),
};

const storageTankUpdateBody = {
  tankCode: code.optional(),
  tankName: z.string().trim().min(2).max(120).optional(),
  capacityKg: positiveKg.optional(),
  minimumSafeQuantityKg: nonNegative.optional(),
  maximumSafeQuantityKg: nonNegative.optional(),
  tankStatus: z.enum(TANK_STATUSES).optional(),
  installationDate: optionalDate,
  locationDescription: z.string().trim().max(400).optional(),
};

const inventoryCreateBody = {
  itemCode: code.optional(),
  itemName: z.string().trim().min(2).max(160),
  itemCategory: z.enum(ITEM_CATEGORIES),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  cylinderTypeId: objectId.nullish(),
  currentQuantity: z.coerce.number().optional(),
  minimumStockLevel: nonNegative.optional(),
  maximumStockLevel: nonNegative.optional(),
  isActive: z.boolean().optional(),
};

const inventoryUpdateBody = {
  itemCode: code.optional(),
  itemName: z.string().trim().min(2).max(160).optional(),
  itemCategory: z.enum(ITEM_CATEGORIES).optional(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE).optional(),
  cylinderTypeId: objectId.nullish(),
  minimumStockLevel: nonNegative.optional(),
  maximumStockLevel: nonNegative.optional(),
  isActive: z.boolean().optional(),
};

const employeeBody = {
  employeeCode: code.optional(),
  fullName: z.string().trim().min(2).max(120),
  departmentName: z.string().trim().max(80).optional(),
  jobTitle: z.string().trim().max(80).optional(),
  phoneNumber: z.string().trim().max(40).optional(),
  emailAddress: optionalEmail,
  joiningDate: optionalDate,
  monthlySalaryAmount: nonNegative.optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
};

const accountCreateBody = {
  accountCode: code.optional(),
  accountName: z.string().trim().min(2).max(160),
  accountType: z.enum(ACCOUNT_TYPES),
  parentAccountId: objectId.nullish(),
  openingBalanceAmount: z.coerce.number().optional(),
  isActive: z.boolean().optional(),
};

const accountUpdateBody = {
  accountCode: code.optional(),
  accountName: z.string().trim().min(2).max(160).optional(),
  accountType: z.enum(ACCOUNT_TYPES).optional(),
  parentAccountId: objectId.nullish(),
  isActive: z.boolean().optional(),
};

const expenseCategoryBody = {
  categoryCode: code.optional(),
  categoryName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
};

function createUpdateSchema(bodyShape) {
  return z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(bodyShape).partial()),
  });
}

function createSchema(bodyShape) {
  return z.object({ body: z.object(bodyShape) });
}

const customer = {
  create: createSchema(customerBody),
  update: createUpdateSchema(customerBody),
  list: listMasterQuery(),
  idParam: idParamSchema,
};

const supplier = {
  create: createSchema(supplierBody),
  update: createUpdateSchema(supplierBody),
  list: listMasterQuery(),
  idParam: idParamSchema,
};

const cylinderType = {
  create: createSchema(cylinderTypeBody),
  update: createUpdateSchema(cylinderTypeBody),
  list: listMasterQuery(),
  idParam: idParamSchema,
};

const storageTank = {
  create: createSchema(storageTankCreateBody),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(storageTankUpdateBody)),
  }),
  list: listMasterQuery({ tankStatus: z.enum(TANK_STATUSES).optional() }),
  idParam: idParamSchema,
};

const inventoryItem = {
  create: createSchema(inventoryCreateBody),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(inventoryUpdateBody)),
  }),
  list: listMasterQuery({
    itemCategory: z.enum(ITEM_CATEGORIES).optional(),
    cylinderTypeId: objectId.optional(),
  }),
  idParam: idParamSchema,
};

const employee = {
  create: createSchema(employeeBody),
  update: createUpdateSchema(employeeBody),
  list: listMasterQuery({ employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional() }),
  idParam: idParamSchema,
};

const account = {
  create: createSchema(accountCreateBody),
  update: z.object({
    params: z.object({ id: objectId }),
    body: atLeastOneField(z.object(accountUpdateBody)),
  }),
  list: listMasterQuery({ accountType: z.enum(ACCOUNT_TYPES).optional() }),
  idParam: idParamSchema,
};

const expenseCategory = {
  create: createSchema(expenseCategoryBody),
  update: createUpdateSchema(expenseCategoryBody),
  list: listMasterQuery(),
  idParam: idParamSchema,
};

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
