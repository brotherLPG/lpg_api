const ERP_MODULES = [
  { moduleName: 'users', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'roles', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'permissions', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'settings', actions: ['create', 'read', 'update'] },
  { moduleName: 'notifications', actions: ['create', 'read', 'update'] },
  { moduleName: 'audit-logs', actions: ['read'] },
  { moduleName: 'customers', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'suppliers', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'cylinder-types', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'storage-tanks', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'lpg-receipts', actions: ['create', 'read', 'update'] },
  { moduleName: 'filling-batches', actions: ['create', 'read', 'update'] },
  { moduleName: 'inventory-items', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'sales', actions: ['create', 'read', 'update'] },
  { moduleName: 'sales-returns', actions: ['create', 'read'] },
  { moduleName: 'expense-categories', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'expenses', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'payments', actions: ['create', 'read'] },
  { moduleName: 'accounts', actions: ['create', 'read', 'update'] },
  { moduleName: 'employees', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'maintenance-assets', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'maintenance-records', actions: ['create', 'read', 'update'] },
  { moduleName: 'assets', actions: ['create', 'read', 'update', 'delete'] },
  { moduleName: 'reports', actions: ['read'] },
];

function buildPermissionCatalog() {
  return ERP_MODULES.flatMap(({ moduleName, actions }) =>
    actions.map((actionName) => ({
      permissionCode: `${moduleName}.${actionName}`,
      permissionName: `${humanize(moduleName)} ${humanize(actionName)}`,
      moduleName,
      actionName,
    }))
  );
}

function humanize(value) {
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const SUPER_ADMIN_ROLE_NAME = 'Super Admin';

function accessLevel(actionSet) {
  const write = ['create', 'update', 'delete'].some((action) => actionSet.has(action));
  if (write) return 'full';
  if (actionSet.has('read')) return 'view';
  return 'none';
}

function permissionsPreview(permissions = []) {
  const byModule = new Map();
  for (const permission of permissions) {
    const moduleName = permission.moduleName;
    if (!byModule.has(moduleName)) {
      byModule.set(moduleName, new Set());
    }
    byModule.get(moduleName).add(permission.actionName);
  }

  return ERP_MODULES.map(({ moduleName }) => ({
    moduleName,
    displayName: humanize(moduleName),
    access: accessLevel(byModule.get(moduleName) || new Set()),
  }));
}

function permissionMatrix(allPermissions = [], grantedIds = []) {
  const granted = new Set(grantedIds.map((id) => String(id)));
  const byModule = new Map();

  for (const permission of allPermissions) {
    if (!byModule.has(permission.moduleName)) {
      byModule.set(permission.moduleName, {
        moduleName: permission.moduleName,
        displayName: humanize(permission.moduleName),
        actions: [],
      });
    }

    byModule.get(permission.moduleName).actions.push({
      actionName: permission.actionName,
      permissionId: permission._id,
      permissionCode: permission.permissionCode,
      granted: granted.has(String(permission._id)),
    });
  }

  return Array.from(byModule.values());
}

module.exports = {
  ERP_MODULES,
  buildPermissionCatalog,
  SUPER_ADMIN_ROLE_NAME,
  humanize,
  permissionsPreview,
  permissionMatrix,
};
