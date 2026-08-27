const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const rbacService = require('../services/rbac.service');

exports.createRole = asyncHandler(async (req, res) => {
  const data = await rbacService.createRole(req.body, req);
  send(res, 201, 'Role created', data);
});

exports.listRoles = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await rbacService.listRoles(query);
  send(res, 200, 'Roles fetched', data);
});

exports.getRole = asyncHandler(async (req, res) => {
  const data = await rbacService.getRoleById(req.params.id);
  send(res, 200, 'Role fetched', data);
});

exports.updateRole = asyncHandler(async (req, res) => {
  const data = await rbacService.updateRole(req.params.id, req.body, req);
  send(res, 200, 'Role updated', data);
});

exports.deleteRole = asyncHandler(async (req, res) => {
  await rbacService.deleteRole(req.params.id, req);
  send(res, 200, 'Role deleted');
});

exports.listPermissions = asyncHandler(async (req, res) => {
  const data = await rbacService.listPermissions();
  send(res, 200, 'Permissions fetched', data);
});

exports.createPermission = asyncHandler(async (req, res) => {
  const data = await rbacService.createPermission(req.body, req);
  send(res, 201, 'Permission created', data);
});

exports.updatePermission = asyncHandler(async (req, res) => {
  const data = await rbacService.updatePermission(req.params.id, req.body, req);
  send(res, 200, 'Permission updated', data);
});

exports.deletePermission = asyncHandler(async (req, res) => {
  await rbacService.deletePermission(req.params.id, req);
  send(res, 200, 'Permission deleted');
});
