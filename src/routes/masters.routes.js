const { createMasterController } = require('../controllers/master.controller');
const { createMasterRouter } = require('./master.router');
const masters = require('../services/masters.service');
const schemas = require('../validations/master.validation');

const customers = createMasterRouter({
  moduleName: 'customers',
  controller: createMasterController(masters.customer, { singular: 'Customer', plural: 'Customers' }),
  schemas: schemas.customer,
});

const suppliers = createMasterRouter({
  moduleName: 'suppliers',
  controller: createMasterController(masters.supplier, { singular: 'Supplier', plural: 'Suppliers' }),
  schemas: schemas.supplier,
});

const cylinderTypes = createMasterRouter({
  moduleName: 'cylinder-types',
  controller: createMasterController(masters.cylinderType, { singular: 'Cylinder type', plural: 'Cylinder types' }),
  schemas: schemas.cylinderType,
});

const storageTanks = createMasterRouter({
  moduleName: 'storage-tanks',
  controller: createMasterController(masters.storageTank, { singular: 'Storage tank', plural: 'Storage tanks' }),
  schemas: schemas.storageTank,
});

const inventoryItems = createMasterRouter({
  moduleName: 'inventory-items',
  controller: createMasterController(masters.inventoryItem, { singular: 'Inventory item', plural: 'Inventory items' }),
  schemas: schemas.inventoryItem,
});

const employees = createMasterRouter({
  moduleName: 'employees',
  controller: createMasterController(masters.employee, { singular: 'Employee', plural: 'Employees' }),
  schemas: schemas.employee,
});

const accounts = createMasterRouter({
  moduleName: 'accounts',
  controller: createMasterController(masters.account, { singular: 'Account', plural: 'Accounts' }),
  schemas: schemas.account,
  allowDelete: false,
});

const expenseCategories = createMasterRouter({
  moduleName: 'expense-categories',
  controller: createMasterController(masters.expenseCategory, { singular: 'Expense category', plural: 'Expense categories' }),
  schemas: schemas.expenseCategory,
});

module.exports = {
  customers,
  suppliers,
  cylinderTypes,
  storageTanks,
  inventoryItems,
  employees,
  accounts,
  expenseCategories,
};
