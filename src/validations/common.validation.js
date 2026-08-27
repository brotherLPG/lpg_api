const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const emailAddress = z.string().trim().email().toLowerCase();
const password = z.string().min(8, 'Password must be at least 8 characters');

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

module.exports = {
  objectId,
  emailAddress,
  password,
  paginationQuery,
};
