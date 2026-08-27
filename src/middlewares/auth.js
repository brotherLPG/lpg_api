const { User, Role, Permission } = require('../models');
const cache = require('../config/cache');
const { verifyAccessToken } = require('../utils/tokens');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

async function loadPermissionCodes(roleId) {
  return cache.getOrSet(`role:${roleId}:permissions`, async () => {
    const role = await Role.findById(roleId).select('permissionIds isActive').lean();
    if (!role || !role.isActive) {
      return [];
    }
    const permissions = await Permission.find({ _id: { $in: role.permissionIds } })
      .select('permissionCode')
      .lean();
    return permissions.map((item) => item.permissionCode);
  });
}

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    throw new ApiError(401, 'Access token is required');
  }

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub).populate('roleId', 'roleName isActive');

  if (!user) {
    throw new ApiError(401, 'User not found');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is inactive');
  }

  if (!user.roleId || !user.roleId.isActive) {
    throw new ApiError(403, 'Role is inactive');
  }

  req.user = user;
  req.permissionCodes = await loadPermissionCodes(user.roleId._id);
  next();
});

module.exports = { authenticate, loadPermissionCodes };
