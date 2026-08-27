const express = require('express');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { loginSchema, refreshSchema, changePasswordSchema } = require('../validations/auth.validation');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.patch('/password', authenticate, validate(changePasswordSchema), authController.changePassword);

module.exports = router;
