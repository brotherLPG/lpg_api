const TANK_STATUSES = ['operational', 'maintenance', 'decommissioned'];
const ACCOUNT_TYPES = ['cash', 'bank', 'receivable', 'payable', 'income', 'expense', 'equity'];
const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'];
const ITEM_CATEGORIES = ['filled-cylinder', 'empty-cylinder', 'lpg', 'spare', 'other'];
const UNITS_OF_MEASURE = ['KG', 'PCS', 'LTR'];
const SALE_STATUSES = ['confirmed', 'partially-returned', 'returned', 'cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refund-due'];
const PAYMENT_TYPES = ['receive', 'pay', 'refund'];
const PAYMENT_METHODS = ['cash', 'bank', 'cheque', 'online'];
const ASSET_CATEGORIES = ['plant', 'vehicle', 'filling-machine', 'compressor', 'tank', 'building', 'furniture', 'other'];
const MAINTENANCE_ASSET_STATUSES = ['operational', 'maintenance', 'breakdown', 'retired'];
const MAINTENANCE_TYPES = ['preventive', 'corrective', 'inspection', 'emergency'];
const ASSET_STATUSES = ['in-use', 'idle', 'under-maintenance', 'disposed'];
const DEPRECIATION_METHODS = ['straight-line', 'reducing-balance', 'none'];
const PAYMENT_TERM_DAYS = [0, 7, 15, 30, 45, 60, 90];
const PAYMENT_TERMS = PAYMENT_TERM_DAYS.map((days) => ({
  value: days,
  label: days === 0 ? 'Due on Receipt' : `Net ${days} Days`,
}));
const ACTIVE_STATUSES = [
  { value: true, label: 'Active' },
  { value: false, label: 'Inactive' },
];

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
  ASSET_CATEGORIES,
  MAINTENANCE_ASSET_STATUSES,
  MAINTENANCE_TYPES,
  ASSET_STATUSES,
  DEPRECIATION_METHODS,
  PAYMENT_TERM_DAYS,
  PAYMENT_TERMS,
  ACTIVE_STATUSES,
};
