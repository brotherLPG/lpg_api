const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const env = require('../config/env');
const cache = require('../config/cache');
const ApiError = require('../utils/ApiError');
const { issueTokenPair, verifyRefreshToken, hashToken } = require('../utils/tokens');
const { loadPermissionCodes } = require('../middlewares/auth');
const { writeAudit, clientMeta } = require('./audit.service');

function toUserResponse(user, permissionCodes = []) {
  const roleDoc = user.roleId && user.roleId.roleName ? user.roleId : null;
  const role = roleDoc
    ? {
        _id: roleDoc._id,
        roleName: roleDoc.roleName,
        roleDescription: roleDoc.roleDescription || '',
        isActive: roleDoc.isActive,
      }
    : user.roleId;

  const employeeDoc = user.employeeId && user.employeeId.fullName ? user.employeeId : null;

  return {
    _id: user._id,
    fullName: user.fullName,
    emailAddress: user.emailAddress,
    username: user.username || '',
    phoneNumber: user.phoneNumber || '',
    cnicNumber: user.cnicNumber || '',
    roleId: user.roleId?._id || user.roleId,
    role,
    employeeId: employeeDoc
      ? {
          _id: employeeDoc._id,
          employeeCode: employeeDoc.employeeCode,
          fullName: employeeDoc.fullName,
          jobTitle: employeeDoc.jobTitle,
          employmentStatus: employeeDoc.employmentStatus,
        }
      : user.employeeId || null,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    permissionCodes,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function refreshExpiryDate() {
  const decodedDummy = jwt.decode(
    jwt.sign({ expProbe: true }, env.jwtRefreshSecret, { expiresIn: env.jwtRefreshExpire })
  );
  return decodedDummy?.exp ? new Date(decodedDummy.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

async function storeRefreshToken(user, refreshToken, req) {
  const meta = clientMeta(req);
  const tokenHash = hashToken(refreshToken);
  user.refreshTokens = (user.refreshTokens || []).filter((item) => item.expiresAt > new Date());
  user.refreshTokens.push({
    tokenHash,
    expiresAt: refreshExpiryDate(),
    userAgent: meta.userAgent,
    ipAddress: meta.ipAddress,
  });
  if (user.refreshTokens.length > 10) {
    user.refreshTokens = user.refreshTokens.slice(-10);
  }
  await user.save();
}

async function login(body, req) {
  const loginValue = (body.emailAddress || body.username || '').toLowerCase().trim();
  const user = await User.findOne({
    $or: [{ emailAddress: loginValue }, { username: loginValue }],
  })
    .select('+passwordHash +refreshTokens')
    .populate('roleId', 'roleName roleDescription isActive');

  if (!user) {
    throw new ApiError(401, 'Invalid email, username or password');
  }

  const matched = await bcrypt.compare(body.password, user.passwordHash);
  if (!matched) {
    throw new ApiError(401, 'Invalid email, username or password');
  }

  if (!user.isActive) {
    throw new ApiError(403, 'Account is inactive');
  }

  if (!user.roleId || !user.roleId.isActive) {
    throw new ApiError(403, 'Role is inactive');
  }

  const tokens = issueTokenPair(user._id);
  user.lastLoginAt = new Date();
  await storeRefreshToken(user, tokens.refreshToken, req);

  const permissionCodes = await loadPermissionCodes(user.roleId._id);
  await writeAudit({
    req,
    actionName: 'login',
    moduleName: 'auth',
    entityName: 'User',
    entityId: user._id,
  });

  return {
    user: toUserResponse(user, permissionCodes),
    ...tokens,
  };
}

async function refresh(refreshToken, req) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const user = await User.findById(payload.sub)
    .select('+refreshTokens')
    .populate('roleId', 'roleName roleDescription isActive');

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const stored = (user.refreshTokens || []).find((item) => item.tokenHash === tokenHash && item.expiresAt > new Date());
  if (!stored) {
    throw new ApiError(401, 'Refresh token is not recognized');
  }

  user.refreshTokens = user.refreshTokens.filter((item) => item.tokenHash !== tokenHash);
  const tokens = issueTokenPair(user._id);
  await storeRefreshToken(user, tokens.refreshToken, req);

  const permissionCodes = await loadPermissionCodes(user.roleId._id);
  return {
    user: toUserResponse(user, permissionCodes),
    ...tokens,
  };
}

async function logout(userId, refreshToken) {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) {
    return;
  }
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    user.refreshTokens = (user.refreshTokens || []).filter((item) => item.tokenHash !== tokenHash);
  } else {
    user.refreshTokens = [];
  }
  await user.save();
  cache.del(`role:${user.roleId}:permissions`);
}

async function me(user) {
  const permissionCodes = await loadPermissionCodes(user.roleId._id);
  return toUserResponse(user, permissionCodes);
}

async function changePassword(userId, currentPassword, newPassword, req) {
  const user = await User.findById(userId).select('+passwordHash +refreshTokens');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  const matched = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matched) {
    throw new ApiError(400, 'Current password is incorrect');
  }
  user.passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  user.refreshTokens = [];
  await user.save();
  await writeAudit({
    req,
    actionName: 'change-password',
    moduleName: 'auth',
    entityName: 'User',
    entityId: user._id,
  });
}

module.exports = {
  toUserResponse,
  login,
  refresh,
  logout,
  me,
  changePassword,
};
