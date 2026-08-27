const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const authService = require('../services/auth.service');

exports.login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body, req);
  send(res, 200, 'Login successful', data);
});

exports.refresh = asyncHandler(async (req, res) => {
  const data = await authService.refresh(req.body.refreshToken, req);
  send(res, 200, 'Token refreshed', data);
});

exports.logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user._id, req.body?.refreshToken);
  send(res, 200, 'Logged out');
});

exports.me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user);
  send(res, 200, 'Current user', data);
});

exports.changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user._id, req.body.currentPassword, req.body.newPassword, req);
  send(res, 200, 'Password changed');
});
