const { z } = require('zod');

const listLogsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    level: z.enum(['info', 'warn', 'error']).optional(),
    kind: z.enum(['request', 'app']).optional(),
    method: z
      .string()
      .trim()
      .toUpperCase()
      .pipe(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']))
      .optional(),
    statusCode: z.coerce.number().int().min(100).max(599).optional(),
    path: z.string().trim().max(200).optional(),
  }),
});

module.exports = { listLogsQuerySchema };
