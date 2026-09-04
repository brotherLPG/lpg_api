const { z } = require('zod');
const {
  objectId,
  optionalEmail,
  optionalLinkedId,
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
  STOCK_STATUS_VALUES,
  PAYMENT_TERM_DAYS,
  CYLINDER_CATEGORY_VALUES,
  CYLINDER_COLOR_VALUES,
  CYLINDER_VALVE_VALUES,
  CYLINDER_MATERIAL_VALUES,
} = require('../constants/masters');

const paymentTermDays = z.coerce
  .number()
  .int()
  .refine((value) => PAYMENT_TERM_DAYS.includes(value), {
    message: 'Invalid payment terms',
  });

const optionalIban = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value.replace(/\s+/g, '').toUpperCase() : ''))
  .refine((value) => !value || /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(value), {
    message: 'Invalid IBAN',
  });

const optionalEnum = (values) =>
  z.preprocess(
    (value) => (value === '' || value === undefined || value === null ? undefined : value),
    z.enum(values).optional()
  );
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
  contactPersonName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(7).max(40),
  emailAddress: optionalEmail,
  isActive: z.boolean().optional(),
  paymentTermDays,
  creditLimitAmount: nonNegative.optional(),
  openingBalanceAmount: z.coerce.number().optional(),
  businessAddress: z.string().trim().min(5).max(400),
  city: z.string().trim().max(80).optional(),
  stateProvince: z.string().trim().max(80).optional(),
  taxRegistrationNumber: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
  bankAccountTitle: z.string().trim().max(160).optional(),
  bankAccountNumber: z.string().trim().max(40).optional(),
  iban: optionalIban,
};

const cylinderTypeBody = {
  typeCode: code.optional(),
  typeName: z.string().trim().min(2).max(120),
  cylinderCategory: z.enum(CYLINDER_CATEGORY_VALUES),
  capacityKg: positiveKg,
  tareWeightKg: nonNegative,
  colorCode: optionalEnum(CYLINDER_COLOR_VALUES),
  isActive: z.boolean().optional(),
  sellingPricePerCylinder: nonNegative,
  purchasePriceAmount: nonNegative.optional(),
  refillPriceAmount: nonNegative.optional(),
  securityDepositAmount: nonNegative.optional(),
  description: z.string().trim().max(1000).optional(),
  valveType: optionalEnum(CYLINDER_VALVE_VALUES),
  material: optionalEnum(CYLINDER_MATERIAL_VALUES),
  safetyCertificationNumber: z.string().trim().max(80).optional(),
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
  cylinderTypeId: optionalLinkedId,
  description: z.string().trim().max(1000).optional(),
  currentQuantity: nonNegative.optional(),
  minimumStockLevel: nonNegative,
  maximumStockLevel: nonNegative.optional(),
  reorderQuantity: nonNegative.optional(),
  preferredSupplierId: optionalLinkedId,
  unitPurchasePriceAmount: nonNegative.optional(),
  unitSellingPriceAmount: nonNegative.optional(),
  lastPurchaseDate: optionalDate,
  rackBayNumber: z.string().trim().max(80).optional(),
  storageNotes: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
};

const inventoryUpdateBody = {
  itemCode: code.optional(),
  itemName: z.string().trim().min(2).max(160).optional(),
  itemCategory: z.enum(ITEM_CATEGORIES).optional(),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE).optional(),
  cylinderTypeId: optionalLinkedId.optional(),
  description: z.string().trim().max(1000).optional(),
  currentQuantity: nonNegative.optional(),
  minimumStockLevel: nonNegative.optional(),
  maximumStockLevel: nonNegative.optional(),
  reorderQuantity: nonNegative.optional(),
  preferredSupplierId: optionalLinkedId.optional(),
  unitPurchasePriceAmount: nonNegative.optional(),
  unitSellingPriceAmount: nonNegative.optional(),
  lastPurchaseDate: optionalDate,
  rackBayNumber: z.string().trim().max(80).optional(),
  storageNotes: z.string().trim().max(1000).optional(),
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
  list: listMasterQuery({
    cylinderCategory: z.enum(CYLINDER_CATEGORY_VALUES).optional(),
  }),
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
    stockStatus: z.enum(STOCK_STATUS_VALUES).optional(),
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
