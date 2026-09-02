const bcrypt = require('bcryptjs');
const { User, Role, Employee } = require('../models');
const env = require('../config/env');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const { permissionsPreview } = require('../constants/permissions');
const { toUserResponse } = require('./auth.service');
const { writeAudit } = require('./audit.service');
const notificationService = require('./notification.service');

const USER_SELECT =
  'fullName emailAddress username phoneNumber cnicNumber roleId employeeId isActive lastLoginAt createdAt updatedAt';
const USER_POPULATE = [
  { path: 'roleId', select: 'roleName roleDescription isActive' },
  { path: 'employeeId', select: 'employeeCode fullName jobTitle departmentName phoneNumber emailAddress employmentStatus' },
];
const STATUSES = [
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' },
];

async function findUser(id) {
  return User.findById(id).select(USER_SELECT).populate(USER_POPULATE);
}

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

async function assertUniqueIdentity({ emailAddress, username, cnicNumber }, userId) {
  const or = [];
  if (emailAddress) or.push({ emailAddress });
  if (username) or.push({ username });
  if (cnicNumber) or.push({ cnicNumber });
  if (!or.length) return;

  const exists = await User.findOne({
    $or: or,
    ...(userId ? { _id: { $ne: userId } } : {}),
  }).select('emailAddress username cnicNumber');

  if (!exists) return;
  if (emailAddress && exists.emailAddress === emailAddress) {
    throw new ApiError(409, 'emailAddress already exists');
  }
  if (username && exists.username === username) {
    throw new ApiError(409, 'username already exists');
  }
  if (cnicNumber && exists.cnicNumber === cnicNumber) {
    throw new ApiError(409, 'cnicNumber already exists');
  }
}

function toRoleOption(role) {
  const permissions = role.permissionIds || [];
  return {
    _id: role._id,
    roleName: role.roleName,
    roleDescription: role.roleDescription || '',
    isActive: role.isActive,
    permissionsPreview: permissionsPreview(permissions),
  };
}

function toEmployeeOption(employee, takenIds, currentEmployeeId) {
  const id = String(employee._id);
  const linkedToOther = takenIds.has(id) && id !== String(currentEmployeeId || '');
  return {
    _id: employee._id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    jobTitle: employee.jobTitle || '',
    departmentName: employee.departmentName || '',
    phoneNumber: employee.phoneNumber || '',
    emailAddress: employee.emailAddress || '',
    employmentStatus: employee.employmentStatus,
    available: !linkedToOther,
  };
}

async function getFormOptions(currentUserId) {
  const currentUser = currentUserId
    ? await User.findById(currentUserId).select('roleId employeeId')
    : null;

  const takenEmployeeIds = await User.find({
    employeeId: { $ne: null },
    ...(currentUserId ? { _id: { $ne: currentUserId } } : {}),
  }).distinct('employeeId');
  const takenSet = new Set(takenEmployeeIds.map((id) => String(id)));

  const roleFilter = currentUser?.roleId
    ? { $or: [{ isActive: true }, { _id: currentUser.roleId }] }
    : { isActive: true };

  const [roles, employees] = await Promise.all([
    Role.find(roleFilter).populate('permissionIds').sort({ roleName: 1 }),
    Employee.find({ employmentStatus: { $ne: 'terminated' } })
      .select('employeeCode fullName jobTitle departmentName phoneNumber emailAddress employmentStatus')
      .sort({ fullName: 1 })
      .lean(),
  ]);

  return {
    roles: roles.map(toRoleOption),
    employees: employees.map((employee) => toEmployeeOption(employee, takenSet, currentUser?.employeeId)),
    statuses: STATUSES,
  };
}

async function createUser(body, req) {
  const { confirmPassword, password, ...payload } = body;
  await assertRole(payload.roleId);
  await assertEmployeeAvailable(payload.employeeId);
  await assertUniqueIdentity(payload);

  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await User.create({
    fullName: payload.fullName,
    emailAddress: payload.emailAddress,
    username: payload.username,
    phoneNumber: payload.phoneNumber,
    cnicNumber: payload.cnicNumber,
    passwordHash,
    roleId: payload.roleId,
    employeeId: payload.employeeId || null,
    isActive: payload.isActive !== undefined ? payload.isActive : true,
  });

  await writeAudit({
    req,
    actionName: 'create',
    moduleName: 'users',
    entityName: 'User',
    entityId: user._id,
    newValues: {
      fullName: user.fullName,
      emailAddress: user.emailAddress,
      username: user.username,
      roleId: user.roleId,
    },
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
  const populated = await findUser(user._id);
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
      { username: { $regex: query.search, $options: 'i' } },
      { phoneNumber: { $regex: query.search, $options: 'i' } },
      { cnicNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total, roles, roleCounts] = await Promise.all([
    User.find(filter).select(USER_SELECT).populate(USER_POPULATE).sort({ createdAt: -1 }).skip(skip).limit(limit),
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
      statuses: STATUSES,
    },
  };
}

async function getUserById(id) {
  const [user, form] = await Promise.all([findUser(id), getFormOptions(id)]);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  return {
    ...toUserResponse(user),
    form,
  };
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

  await assertUniqueIdentity(
    {
      emailAddress: body.emailAddress,
      username: body.username,
      cnicNumber: body.cnicNumber,
    },
    id
  );

  const oldValues = {
    fullName: user.fullName,
    emailAddress: user.emailAddress,
    username: user.username,
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

  const populated = await findUser(id);
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
  getFormOptions,
  createUser,
  listUsers,
  getUserById,
  updateUser,
  resetPassword,
};
