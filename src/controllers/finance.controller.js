const { createMasterController } = require('./master.controller');
const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const { sale, salesReturn, payment, expense, customerLedger } = require('../services/finance.service');

const saleController = createMasterController(sale, { singular: 'Sale', plural: 'Sales' });
const salesReturnController = createMasterController(salesReturn, {
  singular: 'Sales return',
  plural: 'Sales returns',
});
const paymentController = createMasterController(payment, { singular: 'Payment', plural: 'Payments' });
const expenseController = createMasterController(expense, { singular: 'Expense', plural: 'Expenses' });

const customerLedgerController = {
  getLedger: asyncHandler(async (req, res) => {
    const data = await customerLedger.getSummary(req.params.id);
    send(res, 200, 'Customer ledger fetched', data);
  }),
  salesHistory: asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;
    const data = await customerLedger.listSales(req.params.id, query);
    send(res, 200, 'Customer sales history fetched', data);
  }),
  paymentHistory: asyncHandler(async (req, res) => {
    const query = req.validated?.query || req.query;
    const data = await customerLedger.listPayments(req.params.id, query);
    send(res, 200, 'Customer payment history fetched', data);
  }),
};

module.exports = {
  saleController,
  salesReturnController,
  paymentController,
  expenseController,
  customerLedgerController,
};
