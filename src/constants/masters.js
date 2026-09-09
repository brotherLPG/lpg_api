const TANK_STATUSES = ['operational', 'maintenance', 'decommissioned'];
const ACCOUNT_TYPES = ['cash', 'bank', 'receivable', 'payable', 'income', 'expense', 'equity'];
const ACCOUNT_TYPE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'receivable', label: 'Receivable' },
  { value: 'payable', label: 'Payable' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'equity', label: 'Equity' },
];
const ACCOUNT_CATEGORIES = [
  { value: 'operating', label: 'Operating' },
  { value: 'banking', label: 'Banking' },
  { value: 'fleet', label: 'Fleet / Vehicle' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'payable', label: 'Payables' },
  { value: 'receivable', label: 'Receivables' },
  { value: 'other', label: 'Other' },
];
const ACCOUNT_CATEGORY_VALUES = ACCOUNT_CATEGORIES.map((item) => item.value);
const ACCOUNT_RECORD_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'review', label: 'Review' },
  { value: 'inactive', label: 'Inactive' },
];
const ACCOUNT_RECORD_STATUS_VALUES = ACCOUNT_RECORD_STATUSES.map((item) => item.value);
const EMPLOYMENT_STATUSES = ['active', 'inactive', 'terminated'];
const EMPLOYMENT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
];
const EMPLOYEE_DEPARTMENTS = [
  { value: 'filling', label: 'Filling' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'operations', label: 'Operations' },
  { value: 'sales', label: 'Sales' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'stores', label: 'Stores' },
  { value: 'transport', label: 'Transport' },
  { value: 'security', label: 'Security' },
  { value: 'admin', label: 'Administration' },
];
const EMPLOYEE_DEPARTMENT_VALUES = EMPLOYEE_DEPARTMENTS.map((item) => item.value);
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const GENDER_VALUES = GENDER_OPTIONS.map((item) => item.value);
const ITEM_CATEGORIES = ['filled-cylinder', 'empty-cylinder', 'lpg', 'spare', 'other'];
const ITEM_CATEGORY_OPTIONS = [
  { value: 'filled-cylinder', label: 'Filled Cylinder' },
  { value: 'empty-cylinder', label: 'Empty Cylinder' },
  { value: 'spare', label: 'Spare Parts' },
  { value: 'lpg', label: 'LPG' },
  { value: 'other', label: 'Other' },
];
const UNITS_OF_MEASURE = ['KG', 'PCS', 'LTR'];
const UNIT_OF_MEASURE_OPTIONS = [
  { value: 'PCS', label: 'Unit' },
  { value: 'KG', label: 'KG' },
  { value: 'LTR', label: 'Litre' },
];
const STOCK_STATUSES = [
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
];
const STOCK_STATUS_VALUES = STOCK_STATUSES.map((item) => item.value);
const SALE_STATUSES = ['draft', 'confirmed', 'partially-returned', 'returned', 'cancelled'];
const SALE_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
];
const SALE_TYPE_VALUES = SALE_TYPES.map((item) => item.value);
const GST_TAX_RATE = 0.17;
const RETURN_REASONS = [
  { value: 'defective-valve', label: 'Defective Cylinder (Valves Leaking)' },
  { value: 'defective-cylinder', label: 'Defective Cylinder' },
  { value: 'damaged-in-transit', label: 'Damaged in Transit' },
  { value: 'wrong-item', label: 'Wrong Item Supplied' },
  { value: 'over-supplied', label: 'Over Supplied' },
  { value: 'customer-request', label: 'Customer Request' },
  { value: 'other', label: 'Other' },
];
const RETURN_REASON_VALUES = RETURN_REASONS.map((item) => item.value);
const RETURN_ACTION_TYPE = {
  value: 'credit-customer-ledger',
  label: 'Credit to Customer Ledger Account',
};
const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid', 'refund-due'];
const PAYMENT_STATUS_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
  { value: 'refund-due', label: 'Refund Due' },
];
const SALE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'partially-returned', label: 'Partially Returned' },
  { value: 'returned', label: 'Returned' },
  { value: 'cancelled', label: 'Cancelled' },
];
const PAYMENT_TYPES = ['receive', 'pay', 'refund'];
const PAYMENT_METHODS = ['cash', 'bank', 'cheque', 'online'];
const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'online', label: 'Online' },
];
const PAYMENT_DIRECTIONS = [
  { value: 'receive', label: 'Customer Receipt' },
  { value: 'pay', label: 'Supplier Payment' },
];
const PAYMENT_DIRECTION_OPTIONS = [
  { value: 'receive', label: 'Customer Receipt (Inward)' },
  { value: 'pay', label: 'Supplier Payment (Outward)' },
];
const PAYMENT_DIRECTION_VALUES = PAYMENT_DIRECTIONS.map((item) => item.value);
const PAYMENT_VOUCHER_STATUSES = [
  { value: 'recorded', label: 'Recorded' },
  { value: 'pending', label: 'Pending' },
];
const PAYMENT_VOUCHER_STATUS_VALUES = PAYMENT_VOUCHER_STATUSES.map((item) => item.value);
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
  ACCOUNT_TYPE_OPTIONS,
  ACCOUNT_CATEGORIES,
  ACCOUNT_CATEGORY_VALUES,
  ACCOUNT_RECORD_STATUSES,
  ACCOUNT_RECORD_STATUS_VALUES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUS_OPTIONS,
  EMPLOYEE_DEPARTMENTS,
  EMPLOYEE_DEPARTMENT_VALUES,
  GENDER_OPTIONS,
  GENDER_VALUES,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_OPTIONS,
  UNITS_OF_MEASURE,
  UNIT_OF_MEASURE_OPTIONS,
  STOCK_STATUSES,
  STOCK_STATUS_VALUES,
  SALE_STATUSES,
  SALE_TYPES,
  SALE_TYPE_VALUES,
  SALE_STATUS_OPTIONS,
  GST_TAX_RATE,
  RETURN_REASONS,
  RETURN_REASON_VALUES,
  RETURN_ACTION_TYPE,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_OPTIONS,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_DIRECTIONS,
  PAYMENT_DIRECTION_OPTIONS,
  PAYMENT_DIRECTION_VALUES,
  PAYMENT_VOUCHER_STATUSES,
  PAYMENT_VOUCHER_STATUS_VALUES,
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
