require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');
const {
  Permission,
  Role,
  User,
  SystemSetting,
  CylinderType,
  InventoryItem,
  Account,
  ExpenseCategory,
} = require('../models');
const { buildPermissionCatalog, SUPER_ADMIN_ROLE_NAME } = require('../constants/permissions');

const DEFAULT_SETTINGS = [
  { settingKey: 'companyName', settingValue: 'Brother LPG', settingDescription: 'Company display name' },
  { settingKey: 'defaultCurrency', settingValue: 'PKR', settingDescription: 'Default currency code' },
  { settingKey: 'lpgUnit', settingValue: 'KG', settingDescription: 'LPG weight unit' },
];

async function upsert(Model, filter, data) {
  return Model.findOneAndUpdate(filter, { $setOnInsert: data }, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

async function seedMasters() {
  const cyl11 = await upsert(CylinderType, { typeCode: 'CYL-11' }, {
    typeCode: 'CYL-11',
    typeName: '11 KG Cylinder',
    capacityKg: 11,
    tareWeightKg: 0,
    sellingPricePerCylinder: 0,
    isActive: true,
  });

  const cyl22 = await upsert(CylinderType, { typeCode: 'CYL-22' }, {
    typeCode: 'CYL-22',
    typeName: '22 KG Cylinder',
    capacityKg: 22,
    tareWeightKg: 0,
    sellingPricePerCylinder: 0,
    isActive: true,
  });

  const inventoryDefaults = [
    {
      itemCode: 'FILLED-CYLINDER-11KG',
      itemName: 'Filled 11 KG Cylinder',
      itemCategory: 'filled-cylinder',
      unitOfMeasure: 'PCS',
      cylinderTypeId: cyl11._id,
    },
    {
      itemCode: 'EMPTY-CYLINDER-11KG',
      itemName: 'Empty 11 KG Cylinder',
      itemCategory: 'empty-cylinder',
      unitOfMeasure: 'PCS',
      cylinderTypeId: cyl11._id,
    },
    {
      itemCode: 'FILLED-CYLINDER-22KG',
      itemName: 'Filled 22 KG Cylinder',
      itemCategory: 'filled-cylinder',
      unitOfMeasure: 'PCS',
      cylinderTypeId: cyl22._id,
    },
    {
      itemCode: 'EMPTY-CYLINDER-22KG',
      itemName: 'Empty 22 KG Cylinder',
      itemCategory: 'empty-cylinder',
      unitOfMeasure: 'PCS',
      cylinderTypeId: cyl22._id,
    },
  ];

  for (const item of inventoryDefaults) {
    await upsert(InventoryItem, { itemCode: item.itemCode }, {
      ...item,
      currentQuantity: 0,
      minimumStockLevel: 0,
      maximumStockLevel: 0,
      isActive: true,
    });
  }

  const accountDefaults = [
    { accountCode: 'CASH', accountName: 'Cash on Hand', accountType: 'cash' },
    { accountCode: 'BANK', accountName: 'Bank', accountType: 'bank' },
    { accountCode: 'AR', accountName: 'Accounts Receivable', accountType: 'receivable' },
    { accountCode: 'AP', accountName: 'Accounts Payable', accountType: 'payable' },
    { accountCode: 'SALES', accountName: 'Sales Income', accountType: 'income' },
    { accountCode: 'EXP', accountName: 'Operating Expense', accountType: 'expense' },
  ];

  for (const account of accountDefaults) {
    await upsert(Account, { accountCode: account.accountCode }, {
      ...account,
      openingBalanceAmount: 0,
      currentBalanceAmount: 0,
      isActive: true,
    });
  }

  const categoryDefaults = [
    { categoryCode: 'FUEL', categoryName: 'Fuel', description: 'Fuel and energy costs' },
    { categoryCode: 'MAINT', categoryName: 'Maintenance', description: 'Plant and equipment maintenance' },
    { categoryCode: 'SALARY', categoryName: 'Salary', description: 'Staff salaries' },
    { categoryCode: 'UTIL', categoryName: 'Utilities', description: 'Electricity, water and other utilities' },
    { categoryCode: 'OTHER', categoryName: 'Other', description: 'Miscellaneous expenses' },
  ];

  for (const category of categoryDefaults) {
    await upsert(ExpenseCategory, { categoryCode: category.categoryCode }, {
      ...category,
      isActive: true,
    });
  }
}

async function seed() {
  await connectDB();

  const catalog = buildPermissionCatalog();
  const permissionIds = [];

  for (const item of catalog) {
    const permission = await Permission.findOneAndUpdate(
      { permissionCode: item.permissionCode },
      { $set: item },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    permissionIds.push(permission._id);
  }

  const role = await Role.findOneAndUpdate(
    { roleName: SUPER_ADMIN_ROLE_NAME },
    {
      $set: {
        roleName: SUPER_ADMIN_ROLE_NAME,
        roleDescription: 'Full access to all ERP modules',
        permissionIds,
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let admin = await User.findOne({ emailAddress: env.admin.emailAddress }).select('+passwordHash');
  if (!admin) {
    admin = await User.create({
      fullName: env.admin.fullName,
      emailAddress: env.admin.emailAddress,
      passwordHash: await bcrypt.hash(env.admin.password, env.bcryptRounds),
      roleId: role._id,
      isActive: true,
    });
    logger.info('Admin user created', { emailAddress: admin.emailAddress });
  } else {
    admin.roleId = role._id;
    admin.isActive = true;
    await admin.save();
    logger.info('Admin user already exists — role synced', { emailAddress: admin.emailAddress });
  }

  for (const setting of DEFAULT_SETTINGS) {
    await SystemSetting.findOneAndUpdate(
      { settingKey: setting.settingKey },
      { $setOnInsert: { ...setting, updatedByUserId: admin._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await seedMasters();

  logger.info('Phase 2 seed complete', {
    permissions: permissionIds.length,
    role: role.roleName,
    adminEmail: admin.emailAddress,
  });

  await disconnectDB();
}

seed().catch(async (error) => {
  logger.error('Seed failed', { message: error.message });
  await disconnectDB().catch(() => {});
  process.exit(1);
});
