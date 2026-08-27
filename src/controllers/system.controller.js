const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const systemService = require('../services/system.service');
const notificationService = require('../services/notification.service');

exports.listSettings = asyncHandler(async (req, res) => {
  const data = await systemService.listSettings();
  send(res, 200, 'Settings fetched', data);
});

exports.getSetting = asyncHandler(async (req, res) => {
  const data = await systemService.getSetting(req.params.settingKey);
  send(res, 200, 'Setting fetched', data);
});

exports.createSetting = asyncHandler(async (req, res) => {
  const data = await systemService.createSetting(req.body, req);
  send(res, 201, 'Setting created', data);
});

exports.updateSetting = asyncHandler(async (req, res) => {
  const data = await systemService.updateSetting(req.params.settingKey, req.body, req);
  send(res, 200, 'Setting updated', data);
});

exports.listAuditLogs = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await systemService.listAuditLogs(query);
  send(res, 200, 'Audit logs fetched', data);
});

exports.listNotifications = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await notificationService.listMyNotifications(req.user._id, query);
  send(res, 200, 'Notifications fetched', data);
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markRead(req.user._id, req.params.id);
  send(res, 200, 'Notification marked as read', data);
});

exports.markAllNotificationsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user._id);
  send(res, 200, 'All notifications marked as read', data);
});
