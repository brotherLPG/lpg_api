const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const emailAddress = z.string().trim().email().toLowerCase();
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(40)
  .regex(
    /^[a-z][a-z0-9._]*$/,
    'Username must start with a letter and contain only letters, numbers, dots or underscores'
  );

function normalizePakistaniPhone(value) {
  const digits = String(value).replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('92') && local.length === 12) {
    local = `0${local.slice(2)}`;
  }
  if (local.length === 11 && local.startsWith('03')) {
    return `${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return String(value).trim();
}

function normalizeCnic(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 13) {
    return String(value).trim();
  }
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

const phoneNumber = z
  .string()
  .trim()
  .min(1, 'phoneNumber is required')
  .transform(normalizePakistaniPhone)
  .refine((value) => /^03\d{2}-\d{7}$/.test(value), {
    message: 'Phone must be a Pakistani mobile number (e.g. 0321-5678901)',
  });

const cnicNumber = z
  .string()
  .trim()
  .min(1, 'cnicNumber is required')
  .transform(normalizeCnic)
  .refine((value) => /^\d{5}-\d{7}-\d$/.test(value), {
    message: 'CNIC must be 13 digits (e.g. 35201-1234567-9)',
  });

const optionalLinkedId = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  objectId.nullable()
);
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
  username,
  phoneNumber,
  cnicNumber,
  optionalLinkedId,
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

