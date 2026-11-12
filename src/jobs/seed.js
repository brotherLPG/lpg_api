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
  Counter,
} = require('../models');
const { buildPermissionCatalog, SUPER_ADMIN_ROLE_NAME } = require('../constants/permissions');

const DEFAULT_SETTINGS = [
  { settingKey: 'companyName', settingValue: 'Brother LPG', settingDescription: 'Company display name' },
  { settingKey: 'defaultCurrency', settingValue: 'PKR', settingDescription: 'Default currency code' },
  { settingKey: 'lpgUnit', settingValue: 'KG', settingDescription: 'LPG weight unit' },
  { settingKey: 'saleProfitPerKg', settingValue: '15', settingDescription: 'Rupees of profit added per kg on the suggested sale price' },
];

async function upsert(Model, filter, data) {
  return Model.findOneAndUpdate(filter, { $setOnInsert: data }, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });
}

const CYLINDER_TYPES = [
  { typeCode: 'CYL-11.8', typeName: '11.8 KG Cylinder', cylinderCategory: 'domestic', capacityKg: 11.8 },
  { typeCode: 'CYL-15', typeName: '15 KG Cylinder', cylinderCategory: 'domestic', capacityKg: 15 },
  { typeCode: 'CYL-35', typeName: '35 KG Cylinder', cylinderCategory: 'commercial', capacityKg: 35 },
  { typeCode: 'CYL-45.4', typeName: '45.4 KG Cylinder', cylinderCategory: 'commercial', capacityKg: 45.4 },
];

async function seedMasters({ resetCylinders = false } = {}) {
  if (resetCylinders) {
    const [inventory, cylinders] = await Promise.all([
      InventoryItem.deleteMany({}),
      CylinderType.deleteMany({}),
    ]);
    await Counter.deleteMany({
      _id: { $in: ['CylinderType:typeCode:CYL', 'InventoryItem:itemCode:ITM'] },
    });
    logger.info('Cleared inventory and cylinder types', {
      inventory: inventory.deletedCount,
      cylinderTypes: cylinders.deletedCount,
    });
  }

  for (const type of CYLINDER_TYPES) {
    const cylinderType = await upsert(CylinderType, { typeCode: type.typeCode }, {
      ...type,
      tareWeightKg: 0,
      colorCode: 'red',
      sellingPricePerCylinder: 0,
      isActive: true,
    });

    const capacityLabel = String(type.capacityKg);
    const inventoryDefaults = [
      {
        itemCode: `FILLED-CYLINDER-${capacityLabel}KG`,
        itemName: `Filled ${capacityLabel} KG Cylinder`,
        itemCategory: 'filled-cylinder',
        unitOfMeasure: 'PCS',
        cylinderTypeId: cylinderType._id,
      },
      {
        itemCode: `EMPTY-CYLINDER-${capacityLabel}KG`,
        itemName: `Empty ${capacityLabel} KG Cylinder`,
        itemCategory: 'empty-cylinder',
        unitOfMeasure: 'PCS',
        cylinderTypeId: cylinderType._id,
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
    { categoryCode: 'OFFICE', categoryName: 'Office Supplies', description: 'Stationery and office supplies' },
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

  const stalePermissions = await Permission.find({ moduleName: 'maintenance-assets' }).select('_id');
  const staleIds = stalePermissions.map((item) => item._id);
  if (staleIds.length) {
    await Permission.deleteMany({ _id: { $in: staleIds } });
    await Role.updateMany({}, { $pull: { permissionIds: { $in: staleIds } } });
    logger.info('Removed maintenance-assets permissions', { count: staleIds.length });
  }

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
      username: env.admin.username,
      passwordHash: await bcrypt.hash(env.admin.password, env.bcryptRounds),
      roleId: role._id,
      isActive: true,
    });
    logger.info('Admin user created', { emailAddress: admin.emailAddress });
  } else {
    admin.roleId = role._id;
    admin.isActive = true;
    if (!admin.username) {
      admin.username = env.admin.username;
    }
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

  const resetCylinders = process.argv.includes('--reset-cylinders');
  await seedMasters({ resetCylinders });

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
