const express = require('express');
const { authenticate } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createPermissionSchema,
  updatePermissionSchema,
  permissionIdParamSchema,
} = require('../validations/rbac.validation');
const rbacController = require('../controllers/rbac.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('permissions.read'), rbacController.listPermissions);
router.post('/', authorize('permissions.create'), validate(createPermissionSchema), rbacController.createPermission);
router.patch('/:id', authorize('permissions.update'), validate(updatePermissionSchema), rbacController.updatePermission);
router.delete('/:id', authorize('permissions.delete'), validate(permissionIdParamSchema), rbacController.deletePermission);

module.exports = router;
