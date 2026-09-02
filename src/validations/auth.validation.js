const { z } = require('zod');
const {
  emailAddress,
  username,
  phoneNumber,
  cnicNumber,
  optionalLinkedId,
  password,
  objectId,
} = require('./common.validation');

const loginSchema = z.object({
  body: z
    .object({
      emailAddress: z.string().trim().optional(),
      username: z.string().trim().optional(),
      password: z.string().min(1, 'Password is required'),
    })
    .refine((data) => data.emailAddress || data.username, {
      message: 'emailAddress or username is required',
    }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: password,
  }),
});

const createUserSchema = z.object({
  body: z
    .object({
      fullName: z.string().trim().min(2).max(120),
      emailAddress,
      phoneNumber,
      cnicNumber,
      username,
      password,
      confirmPassword: z.string().optional(),
      roleId: objectId,
      employeeId: optionalLinkedId,
      isActive: z.boolean().optional(),
    })
    .refine((data) => !data.confirmPassword || data.confirmPassword === data.password, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
});

const updateUserSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      fullName: z.string().trim().min(2).max(120).optional(),
      emailAddress: emailAddress.optional(),
      phoneNumber: phoneNumber.optional(),
      cnicNumber: cnicNumber.optional(),
      username: username.optional(),
      roleId: objectId.optional(),
      employeeId: optionalLinkedId.optional(),
      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
});

const formOptionsQuerySchema = z.object({
  query: z.object({
    userId: objectId.optional(),
  }),
});

const userIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

const resetPasswordSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    newPassword: password,
  }),
});

const listUsersQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    search: z.string().optional(),
    roleId: objectId.optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});

module.exports = {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  resetPasswordSchema,
  listUsersQuerySchema,
  formOptionsQuerySchema,
};
