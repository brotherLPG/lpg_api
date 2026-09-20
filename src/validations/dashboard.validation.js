const { z } = require('zod');

const operationsOverviewQuerySchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(90).optional(),
    alertLimit: z.coerce.number().int().min(1).max(50).optional(),
    recentLimit: z.coerce.number().int().min(1).max(20).optional(),
  }),
});

const inventoryAlertsQuerySchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    alertLimit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

module.exports = {
  operationsOverviewQuerySchema,
  inventoryAlertsQuerySchema,
};
