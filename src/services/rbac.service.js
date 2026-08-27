const { Role, Permission, User } = require('../models');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { parsePagination, paginated } = require('../utils/pagination');
const {
  SUPER_ADMIN_ROLE_NAME,
  permissionsPreview,
  permissionMatrix,
} = require('../constants/permissions');
const { writeAudit } = require('./audit.service');

async function assertPermissionsExist(permissionIds) {
  if (!permissionIds?.length) return;
  const count = await Permission.countDocuments({ _id: { $in: permissionIds } });
  if (count !== permissionIds.length) {
    throw new ApiError(400, 'One or more permissionIds are invalid');
  }
}

function invalidateRoleCache(roleId) {
  cache.delByPrefix('roles:');
  if (roleId) {
    cache.del(`role:${roleId}:permissions`);
  } else {
    cache.delByPrefix('role:');
  }
}

async function userCountByRole() {
  const counts = await User.aggregate([{ $group: { _id: '$roleId', userCount: { $sum: 1 } } }]);
  return new Map(counts.map((row) => [String(row._id), row.userCount]));
}

async function defaultPermissionIdsForRole(roleName) {
  if (roleName === SUPER_ADMIN_ROLE_NAME) {
    const all = await Permission.find().select('_id').lean();
    return all.map((item) => item._id);
  }
  return [];
}

function toRoleResponse(role, extras = {}) {
  const plain = typeof role.toObject === 'function' ? role.toObject() : role;
  const permissions = plain.permissionIds || [];
  const response = {
    ...plain,
    userCount: extras.userCount || 0,
    permissionsPreview: permissionsPreview(permissions),
  };
  if (extras.permissionMatrix) response.permissionMatrix = extras.permissionMatrix;
  if (extras.switchRoles) response.switchRoles = extras.switchRoles;
  if ('defaultPermissionIds' in extras) response.defaultPermissionIds = extras.defaultPermissionIds;
  return response;
}

async function createRole(body, req) {
  await assertPermissionsExist(body.permissionIds);
  const role = await Role.create(body);
  invalidateRoleCache(role._id);
  await writeAudit({
    req,
    actionName: 'create',
    moduleName: 'roles',
    entityName: 'Role',
    entityId: role._id,
    newValues: body,
  });
  const populated = await Role.findById(role._id).populate('permissionIds');
  return toRoleResponse(populated);
}

async function listRoles(query) {
  const countMap = await userCountByRole();

  if (query.dropdown === 'true') {
    const items = await Role.find().populate('permissionIds').sort({ roleName: 1 });
    const mapped = items.map((role) => toRoleResponse(role, { userCount: countMap.get(String(role._id)) || 0 }));
    return paginated(mapped, mapped.length, 1, mapped.length || 1);
  }

  const { page, limit, skip } = parsePagination(query);
  const [items, total] = await Promise.all([
    Role.find().populate('permissionIds').sort({ roleName: 1 }).skip(skip).limit(limit),
    Role.countDocuments(),
  ]);
  return paginated(
    items.map((role) => toRoleResponse(role, { userCount: countMap.get(String(role._id)) || 0 })),
    total,
    page,
    limit
  );
}

async function getRoleById(id) {
  const [role, allPermissions, switchRoles, countMap] = await Promise.all([
    Role.findById(id).populate('permissionIds'),
    listPermissions(),
    Role.find().select('roleName isActive').sort({ roleName: 1 }).lean(),
    userCountByRole(),
  ]);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }

  const grantedIds = (role.permissionIds || []).map((permission) => permission._id);
  return toRoleResponse(role, {
    userCount: countMap.get(String(role._id)) || 0,
    permissionMatrix: permissionMatrix(allPermissions, grantedIds),
    switchRoles,
    defaultPermissionIds: await defaultPermissionIdsForRole(role.roleName),
  });
}

async function updateRole(id, body, req) {
  const role = await Role.findById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }
  if (role.roleName === SUPER_ADMIN_ROLE_NAME && body.roleName && body.roleName !== SUPER_ADMIN_ROLE_NAME) {
    throw new ApiError(400, 'Super Admin role name cannot be changed');
  }

  const payload = { ...body };
  if (payload.resetToDefault) {
    payload.permissionIds = await defaultPermissionIdsForRole(role.roleName);
    delete payload.resetToDefault;
  }

  if (payload.permissionIds) {
    await assertPermissionsExist(payload.permissionIds);
  }
  const oldValues = role.toObject();
  Object.assign(role, payload);
  await role.save();
  invalidateRoleCache(role._id);
  await writeAudit({
    req,
    actionName: 'update',
    moduleName: 'roles',
    entityName: 'Role',
    entityId: role._id,
    oldValues: { roleName: oldValues.roleName, permissionIds: oldValues.permissionIds, isActive: oldValues.isActive },
    newValues: payload,
  });
  return getRoleById(id);
}

async function deleteRole(id, req) {
  const role = await Role.findById(id);
  if (!role) {
    throw new ApiError(404, 'Role not found');
  }
  if (role.roleName === SUPER_ADMIN_ROLE_NAME) {
    throw new ApiError(400, 'Super Admin role cannot be deleted');
  }
  const assigned = await User.countDocuments({ roleId: id });
  if (assigned > 0) {
    throw new ApiError(400, 'Role is assigned to users and cannot be deleted');
  }
  await role.deleteOne();
  invalidateRoleCache(id);
  await writeAudit({
    req,
    actionName: 'delete',
    moduleName: 'roles',
    entityName: 'Role',
    entityId: id,
    oldValues: { roleName: role.roleName },
  });
}

async function listPermissions() {
  return cache.getOrSet('permissions:all', async () => {
    return Permission.find().sort({ moduleName: 1, actionName: 1 }).lean();
  }, 300);
}

async function createPermission(body, req) {
  const permission = await Permission.create(body);
  cache.del('permissions:all');
  await writeAudit({
    req,
    actionName: 'create',
    moduleName: 'permissions',
    entityName: 'Permission',
    entityId: permission._id,
    newValues: body,
  });
  return permission;
}

async function updatePermission(id, body, req) {
  const permission = await Permission.findById(id);
  if (!permission) {
    throw new ApiError(404, 'Permission not found');
  }
  Object.assign(permission, body);
  await permission.save();
  cache.del('permissions:all');
  cache.delByPrefix('role:');
  await writeAudit({
    req,
    actionName: 'update',
    moduleName: 'permissions',
    entityName: 'Permission',
    entityId: permission._id,
    newValues: body,
  });
  return permission;
}

async function deletePermission(id, req) {
  const permission = await Permission.findById(id);
  if (!permission) {
    throw new ApiError(404, 'Permission not found');
  }
  const inUse = await Role.countDocuments({ permissionIds: id });
  if (inUse > 0) {
    throw new ApiError(400, 'Permission is assigned to a role and cannot be deleted');
  }
  await permission.deleteOne();
  cache.del('permissions:all');
  await writeAudit({
    req,
    actionName: 'delete',
    moduleName: 'permissions',
    entityName: 'Permission',
    entityId: id,
    oldValues: { permissionCode: permission.permissionCode },
  });
}

module.exports = {
  createRole,
  listRoles,
  getRoleById,
  updateRole,
  deleteRole,
  listPermissions,
  createPermission,
  updatePermission,
  deletePermission,
};
