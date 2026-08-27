const express = require('express');
const { authenticate } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  createSettingSchema,
  updateSettingSchema,
  settingKeyParamSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  listAuditLogsQuerySchema,
} = require('../validations/system.validation');
const systemController = require('../controllers/system.controller');

const settingsRouter = express.Router();
settingsRouter.use(authenticate);
settingsRouter.get('/', authorize('settings.read'), systemController.listSettings);
settingsRouter.post('/', authorize('settings.create'), validate(createSettingSchema), systemController.createSetting);
settingsRouter.get('/:settingKey', authorize('settings.read'), validate(settingKeyParamSchema), systemController.getSetting);
settingsRouter.put('/:settingKey', authorize('settings.update'), validate(updateSettingSchema), systemController.updateSetting);

const notificationRouter = express.Router();
notificationRouter.use(authenticate);
notificationRouter.get('/', authorize('notifications.read'), validate(listNotificationsQuerySchema), systemController.listNotifications);
notificationRouter.patch('/read-all', authorize('notifications.update'), systemController.markAllNotificationsRead);
notificationRouter.patch('/:id/read', authorize('notifications.update'), validate(notificationIdParamSchema), systemController.markNotificationRead);

const auditRouter = express.Router();
auditRouter.use(authenticate);
auditRouter.get('/', authorize('audit-logs.read'), validate(listAuditLogsQuerySchema), systemController.listAuditLogs);

module.exports = {
  settingsRouter,
  notificationRouter,
  auditRouter,
};
