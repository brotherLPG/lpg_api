const express = require('express');
const { authenticate } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  listRolesQuerySchema,
} = require('../validations/rbac.validation');
const rbacController = require('../controllers/rbac.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('roles.create'), validate(createRoleSchema), rbacController.createRole);
router.get('/', authorize('roles.read'), validate(listRolesQuerySchema), rbacController.listRoles);
router.get('/:id', authorize('roles.read'), validate(roleIdParamSchema), rbacController.getRole);
router.patch('/:id', authorize('roles.update'), validate(updateRoleSchema), rbacController.updateRole);
router.delete('/:id', authorize('roles.delete'), validate(roleIdParamSchema), rbacController.deleteRole);

module.exports = router;
