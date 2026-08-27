const { z } = require('zod');
const { objectId } = require('./common.validation');

const createSettingSchema = z.object({
  body: z.object({
    settingKey: z.string().trim().min(2).max(80),
    settingValue: z.string().trim().min(1).max(2000),
    settingDescription: z.string().trim().max(300).optional(),
  }),
});

const updateSettingSchema = z.object({
  params: z.object({ settingKey: z.string().trim().min(1) }),
  body: z.object({
    settingValue: z.string().trim().min(1).max(2000),
    settingDescription: z.string().trim().max(300).optional(),
  }),
});

const settingKeyParamSchema = z.object({
  params: z.object({ settingKey: z.string().trim().min(1) }),
});

const listNotificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    isRead: z.enum(['true', 'false']).optional(),
  }),
});

const notificationIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

const listAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().trim().optional(),
    moduleName: z.string().optional(),
    entityName: z.string().optional(),
    userId: objectId.optional(),
    actionName: z.string().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  }),
});

module.exports = {
  createSettingSchema,
  updateSettingSchema,
  settingKeyParamSchema,
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  listAuditLogsQuerySchema,
};
