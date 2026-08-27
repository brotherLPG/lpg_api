const { z } = require('zod');
const { objectId, paginationQuery } = require('./common.validation');

const createRoleSchema = z.object({
  body: z.object({
    roleName: z.string().trim().min(2).max(80),
    roleDescription: z.string().trim().max(300).optional(),
    permissionIds: z.array(objectId).default([]),
    isActive: z.boolean().optional(),
  }),
});

const updateRoleSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      roleName: z.string().trim().min(2).max(80).optional(),
      roleDescription: z.string().trim().max(300).optional(),
      permissionIds: z.array(objectId).optional(),
      isActive: z.boolean().optional(),
      resetToDefault: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
});

const listRolesQuerySchema = z.object({
  query: paginationQuery.extend({
    dropdown: z.enum(['true', 'false']).optional(),
  }),
});

const roleIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

const createPermissionSchema = z.object({
  body: z.object({
    permissionCode: z.string().trim().min(3).max(80).toLowerCase(),
    permissionName: z.string().trim().min(2).max(120),
    moduleName: z.string().trim().min(2).max(80),
    actionName: z.string().trim().min(2).max(40),
  }),
});

const updatePermissionSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      permissionName: z.string().trim().min(2).max(120).optional(),
      moduleName: z.string().trim().min(2).max(80).optional(),
      actionName: z.string().trim().min(2).max(40).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field is required',
    }),
});

const permissionIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

module.exports = {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  listRolesQuerySchema,
  createPermissionSchema,
  updatePermissionSchema,
  permissionIdParamSchema,
};
