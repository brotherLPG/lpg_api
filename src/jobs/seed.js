require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');
const { Permission, Role, User, SystemSetting } = require('../models');
const { buildPermissionCatalog, SUPER_ADMIN_ROLE_NAME } = require('../constants/permissions');

const DEFAULT_SETTINGS = [
  { settingKey: 'companyName', settingValue: 'Brother LPG', settingDescription: 'Company display name' },
  { settingKey: 'defaultCurrency', settingValue: 'PKR', settingDescription: 'Default currency code' },
  { settingKey: 'lpgUnit', settingValue: 'KG', settingDescription: 'LPG weight unit' },
];

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

  logger.info('Phase 1 seed complete', {
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
