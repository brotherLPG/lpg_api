const bcrypt = require('bcryptjs');
const { User, Role, Employee } = require('../models');
const env = require('../config/env');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { toUserResponse } = require('./auth.service');
const { writeAudit } = require('./audit.service');
const notificationService = require('./notification.service');

const USER_SELECT = 'fullName emailAddress roleId employeeId isActive lastLoginAt createdAt updatedAt';

async function assertEmployee(employeeId) {
  if (employeeId === undefined || employeeId === null || employeeId === '') {
    return null;
  }
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new ApiError(400, 'Employee not found');
  }
  if (employee.employmentStatus === 'terminated') {
    throw new ApiError(400, 'Employee is terminated');
  }
  return employee;
}

async function assertEmployeeAvailable(employeeId, userId) {
  const employee = await assertEmployee(employeeId);
  if (!employee) return;
  const taken = await User.findOne({ employeeId, _id: { $ne: userId } }).select('_id');
  if (taken) {
    throw new ApiError(409, 'Employee is already linked to another user');
  }
}

async function assertRole(roleId) {
  const role = await Role.findById(roleId);
  if (!role) {
    throw new ApiError(400, 'Role not found');
  }
  if (!role.isActive) {
    throw new ApiError(400, 'Role is inactive');
  }
  return role;
}

async function createUser(body, req) {
  await assertRole(body.roleId);
  await assertEmployeeAvailable(body.employeeId);

  const exists = await User.findOne({ emailAddress: body.emailAddress });
  if (exists) {
    throw new ApiError(409, 'emailAddress already exists');
  }

  const passwordHash = await bcrypt.hash(body.password, env.bcryptRounds);
  const user = await User.create({
    fullName: body.fullName,
    emailAddress: body.emailAddress,
    passwordHash,
    roleId: body.roleId,
    employeeId: body.employeeId || null,
    isActive: body.isActive !== undefined ? body.isActive : true,
  });

  await writeAudit({
    req,
    actionName: 'create',
    moduleName: 'users',
    entityName: 'User',
    entityId: user._id,
    newValues: { fullName: user.fullName, emailAddress: user.emailAddress, roleId: user.roleId },
  });

  await notificationService.createNotification({
    recipientUserId: user._id,
    notificationType: 'account',
    notificationTitle: 'Account created',
    notificationMessage: 'Your Brother LPG account is ready. You can now sign in.',
    referenceType: 'User',
    referenceId: user._id,
  });

  cache.delByPrefix('users:');
  const populated = await User.findById(user._id).select(USER_SELECT).populate('roleId', 'roleName isActive').populate('employeeId', 'employeeCode fullName jobTitle employmentStatus');
  return toUserResponse(populated);
}

async function listUsers(query) {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};

  if (query.roleId) filter.roleId = query.roleId;
  if (query.isActive === 'true') filter.isActive = true;
  if (query.isActive === 'false') filter.isActive = false;
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { emailAddress: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total, roles, roleCounts] = await Promise.all([
    User.find(filter).select(USER_SELECT).populate('roleId', 'roleName isActive').populate('employeeId', 'employeeCode fullName jobTitle employmentStatus').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
    Role.find().select('roleName roleDescription isActive').sort({ roleName: 1 }).lean(),
    User.aggregate([{ $group: { _id: '$roleId', userCount: { $sum: 1 } } }]),
  ]);

  const countMap = new Map(roleCounts.map((row) => [String(row._id), row.userCount]));

  return {
    ...paginated(items.map((user) => toUserResponse(user)), total, page, limit),
    meta: {
      roles: roles.map((role) => ({
        ...role,
        userCount: countMap.get(String(role._id)) || 0,
      })),
      statuses: [
        { value: 'true', label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
  };
}

async function getUserById(id) {
  const user = await User.findById(id).select(USER_SELECT).populate('roleId', 'roleName isActive').populate('employeeId', 'employeeCode fullName jobTitle employmentStatus');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return toUserResponse(user);
}

async function updateUser(id, body, req) {
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (body.roleId) {
    await assertRole(body.roleId);
  }

  if (body.employeeId !== undefined) {
    await assertEmployeeAvailable(body.employeeId, id);
  }

  if (body.emailAddress && body.emailAddress !== user.emailAddress) {
    const exists = await User.findOne({ emailAddress: body.emailAddress, _id: { $ne: id } });
    if (exists) {
      throw new ApiError(409, 'emailAddress already exists');
    }
  }

  const oldValues = {
    fullName: user.fullName,
    emailAddress: user.emailAddress,
    roleId: user.roleId,
    isActive: user.isActive,
  };

  Object.assign(user, body);
  await user.save();

  cache.delByPrefix('users:');
  cache.del(`role:${user.roleId}:permissions`);

  await writeAudit({
    req,
    actionName: 'update',
    moduleName: 'users',
    entityName: 'User',
    entityId: user._id,
    oldValues,
    newValues: body,
  });

  const populated = await User.findById(id).select(USER_SELECT).populate('roleId', 'roleName isActive').populate('employeeId', 'employeeCode fullName jobTitle employmentStatus');
  return toUserResponse(populated);
}

async function resetPassword(id, newPassword, req) {
  const user = await User.findById(id).select('+refreshTokens');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  user.refreshTokens = [];
  await user.save();
  await writeAudit({
    req,
    actionName: 'reset-password',
    moduleName: 'users',
    entityName: 'User',
    entityId: user._id,
  });
}

module.exports = {
  createUser,
  listUsers,
  getUserById,
  updateUser,
  resetPassword,
};
