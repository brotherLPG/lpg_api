const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const userService = require('../services/user.service');

exports.createUser = asyncHandler(async (req, res) => {
  const data = await userService.createUser(req.body, req);
  send(res, 201, 'User created', data);
});

exports.listUsers = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await userService.listUsers(query);
  send(res, 200, 'Users fetched', data);
});

exports.getUser = asyncHandler(async (req, res) => {
  const data = await userService.getUserById(req.params.id);
  send(res, 200, 'User fetched', data);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const data = await userService.updateUser(req.params.id, req.body, req);
  send(res, 200, 'User updated', data);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  await userService.resetPassword(req.params.id, req.body.newPassword, req);
  send(res, 200, 'Password reset');
});
