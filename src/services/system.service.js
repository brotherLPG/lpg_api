const mongoose = require('mongoose');
const { SystemSetting, AuditLog, User } = require('../models');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { writeAudit } = require('./audit.service');

async function listSettings() {
  return cache.getOrSet('settings:all', async () => {
    return SystemSetting.find().populate('updatedByUserId', 'fullName emailAddress').sort({ settingKey: 1 }).lean();
  });
}

async function getSetting(settingKey) {
  const setting = await SystemSetting.findOne({ settingKey }).populate('updatedByUserId', 'fullName emailAddress');
  if (!setting) {
    throw new ApiError(404, 'Setting not found');
  }
  return setting;
}

async function createSetting(body, req) {
  const exists = await SystemSetting.findOne({ settingKey: body.settingKey });
  if (exists) {
    throw new ApiError(409, 'settingKey already exists');
  }
  const setting = await SystemSetting.create({
    ...body,
    updatedByUserId: req.user._id,
  });
  cache.del('settings:all');
  await writeAudit({
    req,
    actionName: 'create',
    moduleName: 'settings',
    entityName: 'SystemSetting',
    entityId: setting._id,
    newValues: body,
  });
  return setting;
}

async function updateSetting(settingKey, body, req) {
  const setting = await SystemSetting.findOne({ settingKey });
  if (!setting) {
    throw new ApiError(404, 'Setting not found');
  }
  const oldValues = { settingValue: setting.settingValue, settingDescription: setting.settingDescription };
  setting.settingValue = body.settingValue;
  if (body.settingDescription !== undefined) {
    setting.settingDescription = body.settingDescription;
  }
  setting.updatedByUserId = req.user._id;
  await setting.save();
  cache.del('settings:all');
  cache.del(`settings:${settingKey}`);
  await writeAudit({
    req,
    actionName: 'update',
    moduleName: 'settings',
    entityName: 'SystemSetting',
    entityId: setting._id,
    oldValues,
    newValues: body,
  });
  return setting;
}

function toAuditLogResponse(log) {
  return {
    _id: log._id,
    timestamp: log.createdAt,
    user: log.userId
      ? { _id: log.userId._id, fullName: log.userId.fullName, emailAddress: log.userId.emailAddress }
      : null,
    actionName: log.actionName,
    moduleName: log.moduleName,
    entityName: log.entityName,
    entityId: log.entityId || null,
    ipAddress: log.ipAddress || '',
  };
}

async function listAuditLogs(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.moduleName) filter.moduleName = query.moduleName;
  if (query.entityName) filter.entityName = query.entityName;
  if (query.userId) filter.userId = query.userId;
  if (query.actionName) filter.actionName = query.actionName;
  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  if (query.search) {
    const search = query.search.trim();
    const matchingUsers = await User.find({
      $or: [
        { fullName: { $regex: search, $options: 'i' } },
        { emailAddress: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');
    const or = [
      { userId: { $in: matchingUsers.map((user) => user._id) } },
      { entityName: { $regex: search, $options: 'i' } },
      { actionName: { $regex: search, $options: 'i' } },
      { moduleName: { $regex: search, $options: 'i' } },
      { ipAddress: { $regex: search, $options: 'i' } },
    ];
    if (mongoose.Types.ObjectId.isValid(search)) {
      or.push({ entityId: search });
    }
    filter.$or = or;
  }

  const [items, total, modules, actions, users] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'fullName emailAddress')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
    AuditLog.distinct('moduleName'),
    AuditLog.distinct('actionName'),
    User.find().select('fullName emailAddress').sort({ fullName: 1 }).lean(),
  ]);

  return {
    ...paginated(items.map(toAuditLogResponse), total, page, limit),
    meta: {
      modules: modules.sort(),
      actions: actions.sort(),
      users: users.map((user) => ({
        _id: user._id,
        fullName: user.fullName,
        emailAddress: user.emailAddress,
      })),
    },
  };
}

module.exports = {
  listSettings,
  getSetting,
  createSetting,
  updateSetting,
  listAuditLogs,
};
