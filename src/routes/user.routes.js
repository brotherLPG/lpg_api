const express = require('express');
const { authenticate } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  resetPasswordSchema,
  listUsersQuerySchema,
} = require('../validations/auth.validation');
const userController = require('../controllers/user.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('users.create'), validate(createUserSchema), userController.createUser);
router.get('/', authorize('users.read'), validate(listUsersQuerySchema), userController.listUsers);
router.get('/:id', authorize('users.read'), validate(userIdParamSchema), userController.getUser);
router.patch('/:id', authorize('users.update'), validate(updateUserSchema), userController.updateUser);
router.patch(
  '/:id/password',
  authorize('users.update'),
  validate(resetPasswordSchema),
  userController.resetPassword
);

module.exports = router;
