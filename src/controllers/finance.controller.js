const { createMasterController } = require('./master.controller');
const { sale, salesReturn, payment, expense } = require('../services/finance.service');

const saleController = createMasterController(sale, { singular: 'Sale', plural: 'Sales' });
const salesReturnController = createMasterController(salesReturn, {
  singular: 'Sales return',
  plural: 'Sales returns',
});
const paymentController = createMasterController(payment, { singular: 'Payment', plural: 'Payments' });
const expenseController = createMasterController(expense, { singular: 'Expense', plural: 'Expenses' });

module.exports = {
  saleController,
  salesReturnController,
  paymentController,
  expenseController,
};
