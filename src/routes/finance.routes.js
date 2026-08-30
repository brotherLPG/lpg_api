const { createMasterRouter } = require('./master.router');
const {
  saleController,
  salesReturnController,
  paymentController,
  expenseController,
} = require('../controllers/finance.controller');
const { sale, salesReturn, payment, expense } = require('../validations/finance.validation');

const sales = createMasterRouter({
  moduleName: 'sales',
  controller: saleController,
  schemas: sale,
  allowDelete: false,
});

const salesReturns = createMasterRouter({
  moduleName: 'sales-returns',
  controller: salesReturnController,
  schemas: salesReturn,
  allowUpdate: false,
  allowDelete: false,
});

const payments = createMasterRouter({
  moduleName: 'payments',
  controller: paymentController,
  schemas: payment,
  allowUpdate: false,
  allowDelete: false,
});

const expenses = createMasterRouter({
  moduleName: 'expenses',
  controller: expenseController,
  schemas: expense,
});

module.exports = { sales, salesReturns, payments, expenses };
