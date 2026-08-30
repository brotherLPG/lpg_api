const TANK_STATUSES = ['operational', 'maintenance', 'decommissioned'];
const ACCOUNT_TYPES = ['cash', 'bank', 'receivable', 'payable', 'income', 'expense', 'equity'];
const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'];
const ITEM_CATEGORIES = ['filled-cylinder', 'empty-cylinder', 'lpg', 'spare', 'other'];
const UNITS_OF_MEASURE = ['KG', 'PCS', 'LTR'];
const SALE_STATUSES = ['confirmed', 'partially-returned', 'returned', 'cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refund-due'];
const PAYMENT_TYPES = ['receive', 'pay', 'refund'];
const PAYMENT_METHODS = ['cash', 'bank', 'cheque', 'online'];

module.exports = {
  TANK_STATUSES,
  ACCOUNT_TYPES,
  EMPLOYMENT_STATUSES,
  ITEM_CATEGORIES,
  UNITS_OF_MEASURE,
  SALE_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
};
