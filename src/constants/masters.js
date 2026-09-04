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
const CYLINDER_CATEGORIES = [
  { value: 'domestic', label: 'Domestic' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'camping', label: 'Camping / Picnic' },
];
const CYLINDER_CATEGORY_VALUES = CYLINDER_CATEGORIES.map((item) => item.value);
const CYLINDER_COLOR_CODES = [
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'blue', label: 'Blue' },
  { value: 'grey', label: 'Grey' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'green', label: 'Green' },
  { value: 'brown', label: 'Brown' },
  { value: 'silver', label: 'Silver' },
  { value: 'white', label: 'White' },
  { value: 'black', label: 'Black' },
];
const CYLINDER_COLOR_VALUES = CYLINDER_COLOR_CODES.map((item) => item.value);
const CYLINDER_VALVE_TYPES = [
  { value: 'pol', label: 'POL' },
  { value: 'compact', label: 'Compact' },
  { value: 'clip-on', label: 'Clip-on' },
  { value: 'acme', label: 'ACME' },
  { value: 'opd', label: 'OPD' },
  { value: 'camping', label: 'Camping Screw' },
];
const CYLINDER_VALVE_VALUES = CYLINDER_VALVE_TYPES.map((item) => item.value);
const CYLINDER_MATERIALS = [
  { value: 'steel', label: 'Steel' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'composite', label: 'Composite' },
];
const CYLINDER_MATERIAL_VALUES = CYLINDER_MATERIALS.map((item) => item.value);
const RECEIPT_STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
];
const RECEIPT_STATUS_VALUES = RECEIPT_STATUSES.map((item) => item.value);
const BATCH_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];
const BATCH_STATUS_VALUES = BATCH_STATUSES.map((item) => item.value);

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
  CYLINDER_CATEGORIES,
  CYLINDER_CATEGORY_VALUES,
  CYLINDER_COLOR_CODES,
  CYLINDER_COLOR_VALUES,
  CYLINDER_VALVE_TYPES,
  CYLINDER_VALVE_VALUES,
  CYLINDER_MATERIALS,
  CYLINDER_MATERIAL_VALUES,
  RECEIPT_STATUSES,
  RECEIPT_STATUS_VALUES,
  BATCH_STATUSES,
  BATCH_STATUS_VALUES,
};
