const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const emailAddress = z.string().trim().email().toLowerCase();
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((value) => (value ? value : ''))
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: 'Invalid email',
  });
const password = z.string().min(8, 'Password must be at least 8 characters');
const code = z.string().trim().min(1).max(40);
const nonNegative = z.coerce.number().min(0);
const positiveKg = z.coerce.number().gt(0);

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const idParamSchema = z.object({
  params: z.object({ id: objectId }),
});

function listMasterQuery(extra = {}) {
  return z.object({
    query: paginationQuery.extend({
      search: z.string().optional(),
      isActive: z.enum(['true', 'false']).optional(),
      ...extra,
    }),
  });
}

function atLeastOneField(schema) {
  return schema.refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });
}

module.exports = {
  objectId,
  emailAddress,
  optionalEmail,
  password,
  code,
  nonNegative,
  positiveKg,
  paginationQuery,
  idParamSchema,
  listMasterQuery,
  atLeastOneField,
};

