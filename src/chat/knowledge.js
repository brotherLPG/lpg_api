/**
 * ERP Route Map and Workflow Knowledge Base for Brother LPG In-App Instructor.
 *
 * Contains:
 * 1. ERP_PAGES: Complete staff-facing React page registry mapped from
 *    PageRouter.jsx and Sidebar.jsx with route paths, permissions, and ID requirements.
 * 2. ERP_WORKFLOWS: Action-level instructions with 5-part complete walkthroughs,
 *    linked page routes, exact screen labels, buttons, required fields, and outcomes.
 * 3. COVERAGE_CHECKLIST: Verification status of every staff-facing screen and workflow.
 * 4. Helper resolvers for page links, follow-u]\p intent detection, and multilingual scoring.
 */

// --- 1. ERP PAGES REGISTRY ---
const ERP_PAGES = [
    // Dashboard
    {
        id: 'dashboard',
        name: 'Dashboard',
        route: '/Dashboard',
        sidebarLabel: 'Dashboard',
        requiredPermission: 'dashboard.read',
        requiresId: false,
        module: 'dashboard',
        status: 'verified',
    },

    // Customers
    {
        id: 'customers_list',
        name: 'Customers Directory',
        route: '/customers',
        sidebarLabel: 'Customers',
        requiredPermission: 'customers.read',
        requiresId: false,
        module: 'customers',
        status: 'verified',
    },
    {
        id: 'customers_add',
        name: 'Add Customer',
        route: '/customers/add',
        sidebarLabel: 'Customers',
        requiredPermission: 'customers.create',
        requiresId: false,
        module: 'customers',
        status: 'verified',
    },
    {
        id: 'customers_view',
        name: 'Customer Details & Ledger',
        route: '/customers/view/:id',
        sidebarLabel: 'Customers',
        requiredPermission: 'customers.read',
        requiresId: true,
        module: 'customers',
        status: 'verified',
    },
    {
        id: 'customers_edit',
        name: 'Update Customer',
        route: '/customers/edit/:id',
        sidebarLabel: 'Customers',
        requiredPermission: 'customers.update',
        requiresId: true,
        module: 'customers',
        status: 'verified',
    },

    // Suppliers
    {
        id: 'suppliers_list',
        name: 'Suppliers Directory',
        route: '/suppliers',
        sidebarLabel: 'Suppliers',
        requiredPermission: 'suppliers.read',
        requiresId: false,
        module: 'suppliers',
        status: 'verified',
    },
    {
        id: 'suppliers_add',
        name: 'Add Supplier',
        route: '/suppliers/add',
        sidebarLabel: 'Suppliers',
        requiredPermission: 'suppliers.create',
        requiresId: false,
        module: 'suppliers',
        status: 'verified',
    },
    {
        id: 'suppliers_view',
        name: 'Supplier Details',
        route: '/suppliers/view/:id',
        sidebarLabel: 'Suppliers',
        requiredPermission: 'suppliers.read',
        requiresId: true,
        module: 'suppliers',
        status: 'verified',
    },
    {
        id: 'suppliers_edit',
        name: 'Update Supplier',
        route: '/suppliers/edit/:id',
        sidebarLabel: 'Suppliers',
        requiredPermission: 'suppliers.update',
        requiresId: true,
        module: 'suppliers',
        status: 'verified',
    },

    // Storage Tanks
    {
        id: 'storage_tanks_dashboard',
        name: 'Storage Tanks Dashboard',
        route: '/storage-tanks',
        sidebarLabel: 'Storage Tanks',
        requiredPermission: 'storage-tanks.read',
        requiresId: false,
        module: 'storage-tanks',
        status: 'verified',
    },

    // Accounting / Accounts
    {
        id: 'accounts_list',
        name: 'Accounting & Chart of Accounts',
        route: '/accounting',
        sidebarLabel: 'Accounting',
        requiredPermission: 'accounts.read',
        requiresId: false,
        module: 'accounts',
        status: 'verified',
    },
    {
        id: 'accounts_add',
        name: 'Add Account',
        route: '/accounting/add',
        sidebarLabel: 'Accounting',
        requiredPermission: 'accounts.create',
        requiresId: false,
        module: 'accounts',
        status: 'verified',
    },
    {
        id: 'accounts_view',
        name: 'View Account',
        route: '/accounting/view/:id',
        sidebarLabel: 'Accounting',
        requiredPermission: 'accounts.read',
        requiresId: true,
        module: 'accounts',
        status: 'verified',
    },
    {
        id: 'accounts_details',
        name: 'Account Transaction Ledger',
        route: '/accounting/details/:id',
        sidebarLabel: 'Accounting',
        requiredPermission: 'accounts.read',
        requiresId: true,
        module: 'accounts',
        status: 'verified',
    },
    {
        id: 'accounts_edit',
        name: 'Update Account',
        route: '/accounting/edit/:id',
        sidebarLabel: 'Accounting',
        requiredPermission: 'accounts.update',
        requiresId: true,
        module: 'accounts',
        status: 'verified',
    },

    // Sales
    {
        id: 'sales_list',
        name: 'Sales Invoices',
        route: '/sales',
        sidebarLabel: 'Sales',
        requiredPermission: 'sales.read',
        requiresId: false,
        module: 'sales',
        status: 'verified',
    },
    {
        id: 'sales_add',
        name: 'Add Sale Invoice',
        route: '/sales/add',
        sidebarLabel: 'Sales',
        requiredPermission: 'sales.create',
        requiresId: false,
        module: 'sales',
        status: 'verified',
    },
    {
        id: 'sales_view',
        name: 'View Sale Invoice',
        route: '/sales/view/:id',
        sidebarLabel: 'Sales',
        requiredPermission: 'sales.read',
        requiresId: true,
        module: 'sales',
        status: 'verified',
    },
    {
        id: 'sales_edit',
        name: 'Update Sale Invoice',
        route: '/sales/edit/:id',
        sidebarLabel: 'Sales',
        requiredPermission: 'sales.update',
        requiresId: true,
        module: 'sales',
        status: 'verified',
    },
    {
        id: 'sales_return',
        name: 'Record Sale Return',
        route: '/sales/return',
        sidebarLabel: 'Sales',
        requiredPermission: 'sales-returns.create',
        requiresId: false,
        module: 'sales-returns',
        status: 'verified',
    },
    {
        id: 'invoices_page',
        name: 'Invoices Overview',
        route: '/invoices',
        sidebarLabel: 'Sales',
        requiredPermission: 'sales.read',
        requiresId: false,
        module: 'sales',
        status: 'verified',
    },

    // Payments
    {
        id: 'payments_list',
        name: 'Payments Ledger',
        route: '/payments',
        sidebarLabel: 'Payments',
        requiredPermission: 'payments.read',
        requiresId: false,
        module: 'payments',
        status: 'verified',
    },
    {
        id: 'payments_add',
        name: 'Add Payment Voucher',
        route: '/payments/add',
        sidebarLabel: 'Payments',
        requiredPermission: 'payments.create',
        requiresId: false,
        module: 'payments',
        status: 'verified',
    },
    {
        id: 'payments_view',
        name: 'Payment Details',
        route: '/payments/view/:id',
        sidebarLabel: 'Payments',
        requiredPermission: 'payments.read',
        requiresId: true,
        module: 'payments',
        status: 'verified',
    },

    // Filling Batches
    {
        id: 'filling_batches_list',
        name: 'Filling Batches',
        route: '/filling-batches',
        sidebarLabel: 'Filling Batches',
        requiredPermission: 'filling-batches.read',
        requiresId: false,
        module: 'filling-batches',
        status: 'verified',
    },
    {
        id: 'filling_batches_create',
        name: 'Create Filling Batch',
        route: '/filling-batches/create',
        sidebarLabel: 'Filling Batches',
        requiredPermission: 'filling-batches.create',
        requiresId: false,
        module: 'filling-batches',
        status: 'verified',
    },
    {
        id: 'filling_batches_view',
        name: 'Filling Batch Details',
        route: '/filling-batches/view/:id',
        sidebarLabel: 'Filling Batches',
        requiredPermission: 'filling-batches.read',
        requiresId: true,
        module: 'filling-batches',
        status: 'verified',
    },
    {
        id: 'filling_batches_edit',
        name: 'Update Filling Batch',
        route: '/filling-batches/edit/:id',
        sidebarLabel: 'Filling Batches',
        requiredPermission: 'filling-batches.update',
        requiresId: true,
        module: 'filling-batches',
        status: 'verified',
    },

    // Cylinder Types
    {
        id: 'cylinder_types_list',
        name: 'Cylinder Types',
        route: '/cylinder-types',
        sidebarLabel: 'Cylinder Types',
        requiredPermission: 'cylinder-types.read',
        requiresId: false,
        module: 'cylinder-types',
        status: 'verified',
    },
    {
        id: 'cylinder_types_add',
        name: 'Add Cylinder Type',
        route: '/cylinders/add-type',
        sidebarLabel: 'Cylinder Types',
        requiredPermission: 'cylinder-types.create',
        requiresId: false,
        module: 'cylinder-types',
        status: 'verified',
    },
    {
        id: 'cylinder_types_view',
        name: 'View Cylinder Type',
        route: '/cylinders/view-type/:id',
        sidebarLabel: 'Cylinder Types',
        requiredPermission: 'cylinder-types.read',
        requiresId: true,
        module: 'cylinder-types',
        status: 'verified',
    },
    {
        id: 'cylinder_types_edit',
        name: 'Update Cylinder Type',
        route: '/cylinders/edit-type/:id',
        sidebarLabel: 'Cylinder Types',
        requiredPermission: 'cylinder-types.update',
        requiresId: true,
        module: 'cylinder-types',
        status: 'verified',
    },

    // Inventory
    {
        id: 'inventory_list',
        name: 'Inventory Items',
        route: '/inventory',
        sidebarLabel: 'Inventory',
        requiredPermission: 'inventory-items.read',
        requiresId: false,
        module: 'inventory-items',
        status: 'verified',
    },
    {
        id: 'inventory_add',
        name: 'Add Inventory Item',
        route: '/inventory/add',
        sidebarLabel: 'Inventory',
        requiredPermission: 'inventory-items.create',
        requiresId: false,
        module: 'inventory-items',
        status: 'verified',
    },
    {
        id: 'inventory_view',
        name: 'View Inventory Item',
        route: '/inventory/view/:id',
        sidebarLabel: 'Inventory',
        requiredPermission: 'inventory-items.read',
        requiresId: true,
        module: 'inventory-items',
        status: 'verified',
    },
    {
        id: 'inventory_edit',
        name: 'Update Inventory Item',
        route: '/inventory/edit/:id',
        sidebarLabel: 'Inventory',
        requiredPermission: 'inventory-items.update',
        requiresId: true,
        module: 'inventory-items',
        status: 'verified',
    },

    // LPG Receipts
    {
        id: 'lpg_receipts_list',
        name: 'LPG Receipts',
        route: '/lpg-receipts',
        sidebarLabel: 'LPG Receipts',
        requiredPermission: 'lpg-receipts.read',
        requiresId: false,
        module: 'lpg-receipts',
        status: 'verified',
    },
    {
        id: 'lpg_receipts_receive',
        name: 'Receive LPG (Bowser Inward)',
        route: '/lpg-receipts/receive',
        sidebarLabel: 'LPG Receipts',
        requiredPermission: 'lpg-receipts.create',
        requiresId: false,
        module: 'lpg-receipts',
        status: 'verified',
    },
    {
        id: 'lpg_receipts_view',
        name: 'LPG Receipt Details',
        route: '/lpg-receipts/view/:id',
        sidebarLabel: 'LPG Receipts',
        requiredPermission: 'lpg-receipts.read',
        requiresId: true,
        module: 'lpg-receipts',
        status: 'verified',
    },
    {
        id: 'lpg_receipts_edit',
        name: 'Update LPG Receipt',
        route: '/lpg-receipts/edit/:id',
        sidebarLabel: 'LPG Receipts',
        requiredPermission: 'lpg-receipts.update',
        requiresId: true,
        module: 'lpg-receipts',
        status: 'verified',
    },

    // Employees
    {
        id: 'employees_list',
        name: 'Employees Directory',
        route: '/employees',
        sidebarLabel: 'Employees',
        requiredPermission: 'employees.read',
        requiresId: false,
        module: 'employees',
        status: 'verified',
    },
    {
        id: 'employees_add',
        name: 'Add Employee',
        route: '/employees/add',
        sidebarLabel: 'Employees',
        requiredPermission: 'employees.create',
        requiresId: false,
        module: 'employees',
        status: 'verified',
    },
    {
        id: 'employees_view',
        name: 'Employee Details',
        route: '/employees/view/:id',
        sidebarLabel: 'Employees',
        requiredPermission: 'employees.read',
        requiresId: true,
        module: 'employees',
        status: 'verified',
    },
    {
        id: 'employees_edit',
        name: 'Update Employee',
        route: '/employees/edit/:id',
        sidebarLabel: 'Employees',
        requiredPermission: 'employees.update',
        requiresId: true,
        module: 'employees',
        status: 'verified',
    },

    // Fixed Assets & Maintenance
    {
        id: 'assets_list',
        name: 'Fixed Assets',
        route: '/assets',
        sidebarLabel: 'Fixed Assets',
        requiredPermission: 'assets.read',
        requiresId: false,
        module: 'assets',
        status: 'verified',
    },
    {
        id: 'assets_add',
        name: 'Add Asset',
        route: '/assets/add',
        sidebarLabel: 'Fixed Assets',
        requiredPermission: 'assets.create',
        requiresId: false,
        module: 'assets',
        status: 'verified',
    },
    {
        id: 'maintenance_add',
        name: 'Log Maintenance Record',
        route: '/maintenance-records/add',
        sidebarLabel: 'Fixed Assets',
        requiredPermission: 'assets.create',
        requiresId: false,
        module: 'assets',
        status: 'verified',
    },

    // Expenses
    {
        id: 'expenses_list',
        name: 'Expenses',
        route: '/expenses',
        sidebarLabel: 'Expenses',
        requiredPermission: 'expenses.read',
        requiresId: false,
        module: 'expenses',
        status: 'verified',
    },
    {
        id: 'expenses_add',
        name: 'Add Expense',
        route: '/expenses/add',
        sidebarLabel: 'Expenses',
        requiredPermission: 'expenses.create',
        requiresId: false,
        module: 'expenses',
        status: 'verified',
    },

    // Users & Roles
    {
        id: 'users_roles_list',
        name: 'Users & Roles',
        route: '/users-roles',
        sidebarLabel: 'Users & Roles',
        requiredPermission: 'users.read',
        requiresId: false,
        module: 'users',
        status: 'verified',
    },
    {
        id: 'users_add',
        name: 'Add User',
        route: '/users-roles/add-user',
        sidebarLabel: 'Users & Roles',
        requiredPermission: 'users.create',
        requiresId: false,
        module: 'users',
        status: 'verified',
    },
    {
        id: 'roles_add',
        name: 'Add Role',
        route: '/users-roles/add-role',
        sidebarLabel: 'Users & Roles',
        requiredPermission: 'roles.create',
        requiresId: false,
        module: 'roles',
        status: 'verified',
    },
    {
        id: 'roles_permissions',
        name: 'Role Permissions Matrix',
        route: '/users-roles/Permissions',
        sidebarLabel: 'Users & Roles',
        requiredPermission: 'roles.update',
        requiresId: false,
        module: 'roles',
        status: 'verified',
    },

    // System Logs & Reports (Incomplete / View-only)
    {
        id: 'audit_logs',
        name: 'Audit Logs',
        route: '/audit-logs',
        sidebarLabel: 'Audit Logs',
        requiredPermission: 'audit-logs.read',
        requiresId: false,
        module: 'audit-logs',
        status: 'verified',
    },
    {
        id: 'server_logs',
        name: 'Server Logs',
        route: '/server-logs',
        sidebarLabel: 'Server Logs',
        requiredPermission: 'audit-logs.read',
        requiresId: false,
        module: 'audit-logs',
        status: 'verified',
    },
    {
        id: 'reports',
        name: 'Reports',
        route: '/reports',
        sidebarLabel: 'Reports',
        requiredPermission: 'reports.read',
        requiresId: false,
        module: 'reports',
        status: 'incomplete', // Identified as incomplete/view-only in audit
    },
];

// --- 2. ERP WORKFLOWS REGISTRY (5-PART ORDERED WALKTHROUGHS) ---
const ERP_WORKFLOWS = [
    // ==================== PAYMENTS ====================
    {
        id: 'make_supplier_payment',
        module: 'payments',
        title: 'Record Supplier Payment (Outward)',
        pageRoute: '/payments/add',
        listRoute: '/payments',
        requiresId: false,
        requiredPermission: 'payments.create',
        viewPermission: 'payments.create',
        screenLabel: 'Payments',
        sidebarMenu: 'Payments',
        buttonLabel: 'Add Payment',
        direction: 'Supplier Payment (Outward)',
        submitButton: 'Record Voucher Payment',
        status: 'verified',
        searchPhrases: [
            'supplier payment',
            'record supplier payment',
            'pay supplier',
            'supplier ko paise dene hain',
            'supplier bill pay',
            'vendor payment',
            'pay for gas',
            'how do i record a supplier payment',
            'how to pay supplier',
            'how do i pay a supplier',
            'supplier payment kaise karein',
            'supplier payment record karna hai',
        ],
        requiredFields: [
            'Payment Direction: "Supplier Payment (Outward)"',
            'Supplier (select from dropdown)',
            'Payment Amount (Rs.)',
            'Payment Method ("Cash", "Bank Transfer", "Cheque", or "Online")',
            'Account (e.g. "Cash on Hand" or designated Bank Account)',
        ],
        optionalFields: [
            'Payment Date (defaults to today)',
            'Reference # (cheque or bank transfer reference)',
            'Invoice Allocation Mode ("Automatic" or "Manual")',
        ],
        reviewItems: [
            'Verify Supplier Name and outstanding payable balance.',
            'Check Payment Amount against the bowser gas receipt.',
            'Confirm the paying Account has sufficient funds balance.',
            'Verify invoice allocation amounts if paying specific LPG receipts.',
        ],
        goal: 'Disburse funds to an LPG gas supplier and settle outstanding purchase payables.',
        steps: [
            'Open the "Payments" screen from the sidebar menu, or click the "Open Add Payment" button below.',
            'Click the "Add Payment" button at the top right of the payments table to open the voucher form.',
            'Under Payment Direction, select "Supplier Payment (Outward)". In the form, select the "Supplier", enter the "Payment Amount", choose the "Payment Method" (Cash/Bank), and select the paying "Account" (Cash on Hand or Bank Account).',
            'Under Invoice Allocation, review the unpaid LPG supplier invoices. Keep "Automatic" to allocate to the oldest invoice or select "Manual" to allocate to specific receipts.',
            'Click "Record Voucher Payment". The payment voucher is recorded, company cash/bank balance decreases, and the supplier payable balance is automatically reduced.',
        ],
        outcome: 'Supplier payable balance is credited, cash/bank account balance decreases, and linked LPG receipts are marked as settled.',
        followUpAnswers: {
            account: 'For supplier payments, select "Cash on Hand" if paying cash directly, or select your company bank account (e.g. "Meezan Bank" or "HBL") if transferring online or issuing a cheque.',
            method: 'Select "Cash" for on-site cash payments, "Bank Transfer" for IBFT/online transfers, or "Cheque" if providing a physical bank cheque.',
            allocation: 'Choose "Automatic" to automatically apply the amount to the oldest outstanding LPG receipts, or choose "Manual" to check off specific invoices.',
            next_steps: 'After recording, you can view the transaction voucher under the "Payments" ledger or review the supplier statement under "Suppliers".',
        },
    },

    {
        id: 'receive_customer_payment',
        module: 'payments',
        title: 'Receive Customer Payment (Collections)',
        pageRoute: '/payments/add',
        listRoute: '/payments',
        requiresId: false,
        requiredPermission: 'payments.create',
        viewPermission: 'payments.create',
        screenLabel: 'Payments',
        sidebarMenu: 'Payments',
        buttonLabel: 'Add Payment',
        direction: 'Customer Receipt (Inward)',
        submitButton: 'Record Voucher Payment',
        status: 'verified',
        searchPhrases: [
            'customer payment',
            'receive customer payment',
            'receive payment',
            'customer se paise aye hain',
            'collect payment',
            'customer payment record',
            'sale payment',
            'customer recovery',
            'receive cash',
            'how do i record customer payment',
            'customer receipt',
            'customer payment kaise lein',
        ],
        requiredFields: [
            'Payment Direction: "Customer Receipt (Inward)"',
            'Customer (select from dropdown)',
            'Payment Amount (Rs.)',
            'Payment Method ("Cash", "Bank Transfer", "Cheque", or "Online")',
            'Account (receiving account, e.g. "Cash on Hand" or Bank)',
        ],
        optionalFields: [
            'Payment Date (defaults to today)',
            'Reference # (cheque or bank deposit slip number)',
            'Invoice Allocation Mode ("Automatic" or "Manual")',
        ],
        reviewItems: [
            'Verify Customer Name and current ledger receivable balance.',
            'Check Received Amount matches the cash received or deposit slip.',
            'Confirm the receiving Cash/Bank Account is accurate.',
            'Review invoice allocations so the right sales invoices are cleared.',
        ],
        goal: 'Collect cash or bank payment from a customer to clear outstanding sales invoices.',
        steps: [
            'Open the "Payments" screen from the sidebar menu, or click the "Open Add Payment" button below.',
            'Click the "Add Payment" button at the top right of the payments table.',
            'Under Payment Direction, select "Customer Receipt (Inward)". Select the "Customer", enter the "Payment Amount", select the "Payment Method" (Cash, Bank, Cheque), and choose the receiving "Account" (e.g. "Cash on Hand" or Bank).',
            'Review the customer\'s unpaid sales invoices table. Keep "Automatic" to clear oldest dues first or switch to "Manual" to check specific invoices.',
            'Click "Record Voucher Payment". The customer receivable balance is reduced and the receiving cash/bank account balance increases immediately.',
        ],
        outcome: 'Customer receivable ledger is credited, company cash/bank balance increases, and linked sales invoices are marked as paid.',
        followUpAnswers: {
            account: 'Select "Cash on Hand" if the customer paid in cash, or select your receiving bank account (e.g. "Meezan Bank") if they paid via bank transfer or cheque deposit.',
            method: 'Choose "Cash" for currency notes, "Bank Transfer" for direct bank payments, or "Cheque" for physical cheques.',
            allocation: 'With "Automatic", the payment applies sequentially to the oldest outstanding invoices. With "Manual", you check off the exact invoices being settled.',
        },
    },

    {
        id: 'customer_refund',
        module: 'payments',
        title: 'Process Customer Refund',
        pageRoute: '/payments/add',
        listRoute: '/payments',
        requiresId: false,
        requiredPermission: 'payments.create',
        viewPermission: 'payments.create',
        screenLabel: 'Payments',
        sidebarMenu: 'Payments',
        buttonLabel: 'Add Payment',
        direction: 'Customer Refund (Outward)',
        submitButton: 'Record Refund Payment',
        status: 'verified',
        searchPhrases: [
            'customer refund',
            'refund payment',
            'issue refund',
            'customer ko refund dena hai',
            'paise wapis karne hain',
            'refund process',
            'how do i refund customer',
        ],
        requiredFields: [
            'Payment Direction: "Customer Refund (Outward)"',
            'Customer (select customer with refund due)',
            'Payment Amount (Rs.)',
            'Payment Method',
            'Account (paying cash or bank account)',
        ],
        optionalFields: ['Payment Date', 'Reference #'],
        reviewItems: ['Ensure customer has an approved sales return credit note or refund due.'],
        goal: 'Disburse cash or bank refund to a customer following an approved sale return or overpayment.',
        steps: [
            'Open the "Payments" screen from the sidebar menu.',
            'Click "Add Payment" to open the payment voucher form.',
            'Under Payment Direction, select "Customer Refund (Outward)". Select the "Customer", enter the "Payment Amount", and select the disbursing "Account" (Cash on Hand or Bank).',
            'Review the credit balance or sales return invoice linked to the refund.',
            'Click "Record Refund Payment". The refund voucher is created and the company cash/bank balance decreases.',
        ],
        outcome: 'Customer credit balance is settled and plant cash/bank funds decrease.',
    },

    {
        id: 'view_payments',
        module: 'payments',
        title: 'View Payments Ledger',
        pageRoute: '/payments',
        listRoute: '/payments',
        requiresId: false,
        requiredPermission: 'payments.read',
        viewPermission: 'payments.read',
        screenLabel: 'Payments',
        sidebarMenu: 'Payments',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view payments',
            'payment history',
            'payments list',
            'payment voucher list',
            'payments dekhna hai',
            'take me to payments',
            'open payments',
            'where is payments',
        ],
        requiredFields: [],
        optionalFields: ['Date filter', 'Payment direction filter (Inward/Outward)', 'Search party'],
        reviewItems: ['Review payment vouchers, party names, accounts, and amounts.'],
        goal: 'Review all payment vouchers, customer receipts, and supplier disbursement records.',
        steps: [
            'Click "Payments" in the sidebar menu.',
            'Review the table showing Voucher #, Date, Direction, Party Name, Amount, Method, and Account.',
            'Click the "Eye" view icon on any row to inspect complete voucher details and invoice allocations.',
        ],
        outcome: 'Displays historical payment records and allows filtering by date and party.',
    },

    // ==================== SALES ====================
    {
        id: 'create_sale',
        module: 'sales',
        title: 'Create Sales Invoice',
        pageRoute: '/sales/add',
        listRoute: '/sales',
        requiresId: false,
        requiredPermission: 'sales.create',
        viewPermission: 'sales.create',
        screenLabel: 'Sales',
        sidebarMenu: 'Sales',
        buttonLabel: 'New Sale',
        submitButton: 'Create Invoice',
        status: 'verified',
        searchPhrases: [
            'create sale',
            'new sale',
            'add sale',
            'sale invoice',
            'bill banana hai',
            'sale kaise karein',
            'cylinder bechna hai',
            'generate invoice',
            'sell cylinders',
            'how do i create a sale',
            'how do i make an invoice',
            'cash sale',
            'credit sale',
        ],
        requiredFields: [
            'Customer (select from dropdown)',
            'Line Items: Product / Cylinder Type, Quantity, and Unit Price',
            'Payment Settlement: Receiving Account (if Amount Paid > 0)',
        ],
        optionalFields: [
            'Invoice Date (defaults to today)',
            'Payment Terms (Immediate, Net 15, Net 30)',
            'Line Item Discount',
            'Amount Paid (leave 0 for pure credit sale)',
            'Reference Number',
            'Internal Remarks',
        ],
        reviewItems: [
            'Check customer credit limit and existing ledger balance.',
            'Confirm cylinder quantities and selling rate per unit.',
            'Review Subtotal, total payable, and Amount Paid.',
            'Check remaining amount due and payment status (Paid, Partially Paid, or Unpaid).',
        ],
        goal: 'Create a commercial or domestic cylinder sales invoice for cash or credit customers.',
        steps: [
            'Open the "Sales" screen from the sidebar, or click the "Open Add Sale Invoice" button below.',
            'Click the "New Sale" button at the top right of the sales list.',
            'Under Customer & Invoice Details, select the "Customer" and verify "Invoice Date". Under Line Items, click "+ Add Item", select the "Cylinder Type", enter the "Quantity", and verify the "Unit Price".',
            'Under Payment Settlement, enter the "Amount Paid" (or 0 for credit sale). If payment is received, select the receiving "Account" (defaults to "Cash on Hand"). Review the Remaining Due amount.',
            'Click "Create Invoice" (or "Save as Draft" if unconfirmed). The invoice is generated, filled cylinder inventory decreases, and customer receivable is updated.',
        ],
        outcome: 'Sales invoice is created, filled cylinder stock decrements, and customer receivable increases.',
        followUpAnswers: {
            account: 'Select "Cash on Hand" for cash receipts, or select your designated Bank Account if the customer paid via online transfer at the time of sale.',
            credit: 'To make a credit sale, enter 0 in "Amount Paid". The entire invoice total will become an outstanding balance on the customer\'s ledger.',
            draft: 'Click "Save as Draft" if you want to prepare the invoice before loading cylinders onto the customer\'s vehicle, then click "Create Invoice" once dispatched.',
        },
    },

    {
        id: 'sale_returns',
        module: 'sales-returns',
        title: 'Record Sale Return',
        pageRoute: '/sales/return',
        listRoute: '/sales',
        requiresId: false,
        requiredPermission: 'sales-returns.create',
        viewPermission: 'sales-returns.create',
        screenLabel: 'Sales Returns',
        sidebarMenu: 'Sales',
        buttonLabel: 'Create Return',
        submitButton: 'Process Return (Issue Credit)',
        status: 'verified',
        searchPhrases: [
            'sale return',
            'return cylinder',
            'cylinder wapis aya hai',
            'defective valve',
            'damaged cylinder return',
            'cylinder exchange',
            'return invoice',
            'how do i record a return',
            'create return',
            'how do i process a sale return',
        ],
        requiredFields: [
            'Customer (select from dropdown)',
            'Sale Invoice (select the original sale invoice)',
            'Return Reason (e.g. "Defective Valve", "Damaged in Transit", "Customer Request")',
            'Return Quantity on affected items (must be <= original sold quantity)',
            'Payment / Credit Account',
        ],
        optionalFields: ['Return Date (defaults to today)', 'Refund Method (Cash/Bank)', 'Inspection Notes'],
        reviewItems: [
            'Confirm the selected Sales Invoice belongs to this customer.',
            'Ensure return quantity does not exceed original invoice count.',
            'Review total Return Value calculated.',
        ],
        goal: 'Process returned cylinders from customers due to defects, leakage, or order adjustments.',
        steps: [
            'Open the "Sales" screen from the sidebar, then switch to the "Sales Returns" tab or click the "Open Record Sale Return" button below.',
            'Click the "Create Return" button.',
            'Select the "Customer", then select the original "Sale Invoice". Choose the "Return Reason" from the dropdown.',
            'In the returned items table, enter the "Return Qty" for each returned cylinder item. Under Financial Settlement, verify the refund/credit account and enter any quality control findings in "Inspection Notes".',
            'Click "Process Return (Issue Credit)". The return is registered, inventory stock is replenished, and customer ledger is credited.',
        ],
        outcome: 'Sale return is booked, cylinder inventory is updated, and a customer credit note is generated.',
    },

    {
        id: 'view_sales',
        module: 'sales',
        title: 'View Sales Invoices',
        pageRoute: '/sales',
        listRoute: '/sales',
        requiresId: false,
        requiredPermission: 'sales.read',
        viewPermission: 'sales.read',
        screenLabel: 'Sales',
        sidebarMenu: 'Sales',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view sales',
            'sales list',
            'all sales',
            'sales dekhna hai',
            'invoices list',
            'take me to sales',
            'where is sales',
            'open sales',
        ],
        requiredFields: [],
        optionalFields: ['Status filter', 'Customer filter', 'Date range'],
        reviewItems: ['Inspect invoice status: Paid, Partially Paid, Unpaid, or Draft.'],
        goal: 'Review sales orders, billing records, payment statuses, and customer delivery invoices.',
        steps: [
            'Click "Sales" in the sidebar menu.',
            'Browse through all sales invoices showing Invoice #, Customer, Date, Total Amount, Paid Amount, and Status.',
            'Click the "View" eye icon on any invoice row to view the full printable invoice and item breakdown.',
        ],
        outcome: 'Displays sales records with customer balances and payment statuses.',
    },

    // ==================== CUSTOMERS ====================
    {
        id: 'add_customer',
        module: 'customers',
        title: 'Add New Customer',
        pageRoute: '/customers/add',
        listRoute: '/customers',
        requiresId: false,
        requiredPermission: 'customers.create',
        viewPermission: 'customers.create',
        screenLabel: 'Customers',
        sidebarMenu: 'Customers',
        buttonLabel: 'Add Customer',
        submitButton: 'Save Profile',
        status: 'verified',
        searchPhrases: [
            'add customer',
            'register a new customer',
            'customer kaise add karun',
            'naya customer add karna hai',
            'create customer',
            'new customer',
            'register customer',
            'customer banana hai',
            'add client',
            'how do i add a customer',
            'how do i register customer',
        ],
        requiredFields: [
            'Customer Name',
            'Contact Person',
            'Phone Number (Pakistani mobile format 03XX-XXXXXXX)',
            'Billing Address',
        ],
        optionalFields: [
            'Email Address',
            'NTN / Tax Registration #',
            'Credit Limit Amount (Rs.)',
            'Payment Terms (Net 15, Net 30, COD)',
            'Opening Balance Amount (Rs.)',
        ],
        reviewItems: [
            'Verify Customer Name and mobile number accuracy.',
            'Set an appropriate Credit Limit (e.g. 50,000 PKR) or leave 0 for cash-only customers.',
            'Ensure Opening Balance is 0 for new customers or reflects prior balance if transitioning.',
        ],
        goal: 'Register a new customer profile with credit terms and opening balance.',
        steps: [
            'Open the "Customers" screen from the sidebar, or click the "Open Add Customer" button below.',
            'Click the "Add Customer" button at the top right of the customer directory table.',
            'Fill in the required fields: "Customer Name", "Contact Person", "Phone Number", and "Billing Address".',
            'Under Credit & Financial Terms, enter the "Credit Limit Amount" (in PKR), select "Payment Terms", and specify "Opening Balance" if any.',
            'Click "Save Profile" (or "Save Customer"). The customer is saved and immediately available for sales invoices and payment vouchers.',
        ],
        outcome: 'New customer profile is registered and ready for sales, billing, and payment processing.',
        followUpAnswers: {
            credit: 'If the customer is cash-on-delivery only, set Credit Limit to 0 and Payment Terms to "Cash on Delivery". For commercial clients, enter their agreed credit limit (e.g. 100,000 PKR).',
            phone: 'Enter standard 11-digit mobile format: 03XX-XXXXXXX.',
        },
    },

    {
        id: 'view_customers',
        module: 'customers',
        title: 'View Customers Directory',
        pageRoute: '/customers',
        listRoute: '/customers',
        requiresId: false,
        requiredPermission: 'customers.read',
        viewPermission: 'customers.read',
        screenLabel: 'Customers',
        sidebarMenu: 'Customers',
        buttonLabel: 'Search / Filter',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view customers',
            'customers list',
            'customer list',
            'customer directory',
            'customer dekhna hai',
            'customers kahan hain',
            'check customer balance',
            'find customer',
            'search customer',
            'customer ledger',
            'take me to customers',
            'open customers',
            'where is customers',
        ],
        requiredFields: [],
        optionalFields: ['Search query (Name, Phone, or Code)'],
        reviewItems: ['Check customer current outstanding balances and status.'],
        goal: 'View customer directory, contact details, and outstanding balances.',
        steps: [
            'Click "Customers" in the sidebar menu.',
            'Use the search bar at the top to find a customer by Name, Phone Number, or Code.',
            'Click the "Ledger" or "View" icon on any customer row to inspect their full transaction history and aging balance.',
        ],
        outcome: 'Displays active customer accounts with current receivable balances.',
    },

    // ==================== LPG RECEIPTS (GAS INTAKE) ====================
    {
        id: 'record_lpg_receipt',
        module: 'lpg-receipts',
        title: 'Record LPG Bulk Gas Receipt (Bowser Inward)',
        pageRoute: '/lpg-receipts/receive',
        listRoute: '/lpg-receipts',
        requiresId: false,
        requiredPermission: 'lpg-receipts.create',
        viewPermission: 'lpg-receipts.create',
        screenLabel: 'LPG Receipts',
        sidebarMenu: 'LPG Receipts',
        buttonLabel: 'Receive LPG',
        submitButton: 'Confirm & Receive LPG',
        status: 'verified',
        searchPhrases: [
            'new lpg receipt',
            'record lpg receipt',
            'receive lpg',
            'gas aai hai',
            'bowser entry',
            'tank mein gas dalna',
            'lpg receive karna',
            'bulk gas intake',
            'purchase gas',
            'add gas to tank',
            'how do i receive lpg',
            'how do i record a bowser receipt',
        ],
        requiredFields: [
            'Supplier (select from dropdown)',
            'Received Quantity (KG) (must be > 0)',
            'Truck / Bowser Registration # (min 3 chars, e.g. "LES-1234")',
            'Supplier Invoice # (min 2 chars, e.g. "INV-9821")',
        ],
        optionalFields: [
            'Decanting Rate / KG (purchase rate in PKR)',
            'Received Date & Time (defaults to current time)',
            'Received By (select employee)',
            'Remarks / Inspection Notes',
        ],
        reviewItems: [
            'Verify received weight in KG against the weighbridge slip.',
            'Check the decanting rate per KG and total purchase cost calculation.',
            'Verify the destination storage tank capacity is not exceeded.',
        ],
        goal: 'Record bulk LPG gas delivered by a supplier bowser into plant storage tanks.',
        steps: [
            'Open the "LPG Receipts" screen from the sidebar, or click the "Open Receive LPG" button below.',
            'Click the "Receive LPG" button at the top right of the receipts table.',
            'Select the "Supplier", enter the "Received Quantity (KG)", and specify the "Decanting Rate / KG". Enter the "Truck / Bowser Registration #" and "Supplier Invoice #".',
            'Review the LPG Transaction Summary card showing total purchase cost and updated storage tank fill level.',
            'Click "Confirm & Receive LPG". The receipt is confirmed, destination storage tank stock increases, and supplier payable is recorded.',
        ],
        outcome: 'Storage tank bulk LPG stock increases by received KG and accounts payable to supplier is created.',
    },

    {
        id: 'view_lpg_receipts',
        module: 'lpg-receipts',
        title: 'View LPG Receipts',
        pageRoute: '/lpg-receipts',
        listRoute: '/lpg-receipts',
        requiresId: false,
        requiredPermission: 'lpg-receipts.read',
        viewPermission: 'lpg-receipts.read',
        screenLabel: 'LPG Receipts',
        sidebarMenu: 'LPG Receipts',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view lpg receipts',
            'gas intake list',
            'lpg receipt dekhna hai',
            'bowser history',
            'purchased gas history',
            'take me to lpg receipts',
            'open lpg receipts',
        ],
        requiredFields: [],
        optionalFields: ['Supplier filter', 'Date filter'],
        reviewItems: ['Review bowser numbers, decanting rates, and net weight delivered.'],
        goal: 'Review historical bulk LPG deliveries and bowser decanting records.',
        steps: [
            'Click "LPG Receipts" in the sidebar menu.',
            'Review the receipts table with Receipt #, Supplier, Bowser #, Quantity (KG), and Total Cost.',
            'Click the view icon on any receipt row to see decanting details.',
        ],
        outcome: 'Displays historical bulk LPG intake logs.',
    },

    // ==================== FILLING BATCHES (PRODUCTION) ====================
    {
        id: 'create_filling_batch',
        module: 'filling-batches',
        title: 'Create Cylinder Refilling Batch',
        pageRoute: '/filling-batches/create',
        listRoute: '/filling-batches',
        requiresId: false,
        requiredPermission: 'filling-batches.create',
        viewPermission: 'filling-batches.create',
        screenLabel: 'Filling Batches',
        sidebarMenu: 'Filling Batches',
        buttonLabel: 'Create Batch',
        submitButton: 'Create Filling Batch',
        status: 'verified',
        searchPhrases: [
            'create filling batch',
            'new filling batch',
            'cylinder bharna hai',
            'refilling batch kaise banayein',
            'cylinder filling',
            'plant production',
            'fill cylinders',
            'refill 11.8kg',
            'refill commercial',
            'how do i create a batch',
            'how do i fill cylinders',
        ],
        requiredFields: [
            'Select Storage Tank (source tank, e.g. "TNK-001")',
            'Plant Operator (select employee in charge of decanting scale)',
            'Production Line: Cylinder Type (e.g. 11.8 KG, 45.4 KG)',
            'Number of Cylinders (quantity to fill, integer > 0)',
        ],
        optionalFields: [
            'Filling Date (defaults to today)',
            'Batch Status ("completed" or "in-progress")',
            'Residual LPG Recovered (KG) (if recovering leftover gas from customer shells)',
            'Batch Remarks / Operating Conditions',
        ],
        reviewItems: [
            'Review Expected Consumption (KG) calculated from cylinder count × target weight.',
            'Ensure source Storage Tank has sufficient available stock above minimum safe level.',
            'Review Tank Level After Filling preview in the right summary card.',
        ],
        goal: 'Decant bulk LPG gas from a storage tank to fill empty cylinders for sales distribution.',
        steps: [
            'Open the "Filling Batches" screen from the sidebar, or click the "Open Create Batch" button below.',
            'Click the "Create Batch" button at the top right of the batch history table.',
            'Under Batch Configuration, select the source "Storage Tank" and select the "Plant Operator". Under Production Lines, select the "Cylinder Type" and enter the "Number of Cylinders" to fill.',
            'Check the live summary card on the right to verify Expected Fill (KG) and ensure the tank level will remain within safe operating thresholds.',
            'Click "Create Filling Batch". Bulk storage tank gas decreases, empty cylinder count decreases, and filled cylinder inventory increases.',
        ],
        outcome: 'Source tank LPG stock decreases by total KG decanted and filled cylinder inventory increments.',
    },

    {
        id: 'view_filling_batches',
        module: 'filling-batches',
        title: 'View Filling Batches',
        pageRoute: '/filling-batches',
        listRoute: '/filling-batches',
        requiresId: false,
        requiredPermission: 'filling-batches.read',
        viewPermission: 'filling-batches.read',
        screenLabel: 'Filling Batches',
        sidebarMenu: 'Filling Batches',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view filling batches',
            'production history',
            'refilling list',
            'batch dekhna hai',
            'filling history',
            'take me to filling batches',
            'open filling batches',
        ],
        requiredFields: [],
        optionalFields: ['Operator filter', 'Date filter'],
        reviewItems: ['Inspect completed cylinder batches and total KG decanted.'],
        goal: 'Review cylinder refilling operations and plant production logs.',
        steps: [
            'Click "Filling Batches" in the sidebar menu.',
            'Browse past production runs showing Batch #, Date, Tank, Total Cylinders, and Total KG Filled.',
            'Click the details icon on any row to view breakdown across domestic and commercial cylinder types.',
        ],
        outcome: 'Displays plant filling batch records.',
    },

    // ==================== STORAGE TANKS ====================
    {
        id: 'view_storage_tanks',
        module: 'storage-tanks',
        title: 'View Storage Tanks Dashboard',
        pageRoute: '/storage-tanks',
        listRoute: '/storage-tanks',
        requiresId: false,
        requiredPermission: 'storage-tanks.read',
        viewPermission: 'storage-tanks.read',
        screenLabel: 'Storage Tanks',
        sidebarMenu: 'Storage Tanks',
        buttonLabel: 'Tank Level / Parameters',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'storage tank',
            'tank level',
            'kitni gas baki hai',
            'tank status',
            'gas stock',
            'check tank',
            'lpg volume',
            'tank dashboard',
            'take me to storage tanks',
            'open storage tanks',
        ],
        requiredFields: [],
        optionalFields: [],
        reviewItems: ['Inspect tank fill %, current KG, minimum safe quantity, and safety alerts.'],
        goal: 'Monitor bulk LPG stock, fill percentage, and safety parameters in plant storage tanks.',
        steps: [
            'Click "Storage Tanks" in the sidebar menu.',
            'Review the live gauge showing Current Stock (KG), Fill Percentage, and Stock Safety Alert.',
            'Inspect the Tank Parameters card for Minimum Safe Quantity (e.g. 5,000 KG) and Maximum Safe Capacity (e.g. 42,500 KG).',
            'Review recent bowser intake receipts and recent filling batches linked to the tank.',
        ],
        outcome: 'Displays real-time bulk LPG tank levels, safety thresholds, and recent throughput.',
    },

    // ==================== SUPPLIERS ====================
    {
        id: 'add_supplier',
        module: 'suppliers',
        title: 'Add New Supplier',
        pageRoute: '/suppliers/add',
        listRoute: '/suppliers',
        requiresId: false,
        requiredPermission: 'suppliers.create',
        viewPermission: 'suppliers.create',
        screenLabel: 'Suppliers',
        sidebarMenu: 'Suppliers',
        buttonLabel: 'Add Supplier',
        submitButton: 'Save Supplier',
        status: 'verified',
        searchPhrases: [
            'add supplier',
            'new supplier',
            'create supplier',
            'supplier kaise add karein',
            'naya supplier banana hai',
            'register supplier',
            'lpg supplier entry',
            'how do i add a supplier',
        ],
        requiredFields: [
            'Supplier Name',
            'Contact Person',
            'Phone Number',
            'Payment Terms (e.g. Net 15, Net 30, COD)',
        ],
        optionalFields: [
            'Email Address',
            'Business Address',
            'City / Province',
            'NTN / Tax Registration #',
            'Credit Limit (Rs.)',
            'Opening Balance (Rs.)',
            'Bank Details (Bank Name, Account Number, Pakistan IBAN)',
        ],
        reviewItems: [
            'Verify Supplier Company Name and billing address.',
            'If entering an IBAN, ensure valid Pakistan format: PK followed by 22 alphanumeric characters.',
        ],
        goal: 'Register an LPG gas exploration, marketing, or transport supplier.',
        steps: [
            'Open the "Suppliers" screen from the sidebar, or click the "Open Add Supplier" button below.',
            'Click the "Add Supplier" button at the top right of the table.',
            'Enter the "Supplier Name", "Contact Person", "Phone Number", and choose "Payment Terms".',
            'Optionally fill in NTN, City, Credit Limit, and Banking / Pakistan IBAN details.',
            'Click "Save Supplier". The supplier is saved and available for bowser LPG receipt decanting.',
        ],
        outcome: 'New supplier record is registered and ready for bulk gas purchases.',
    },

    {
        id: 'view_suppliers',
        module: 'suppliers',
        title: 'View Suppliers Directory',
        pageRoute: '/suppliers',
        listRoute: '/suppliers',
        requiresId: false,
        requiredPermission: 'suppliers.read',
        viewPermission: 'suppliers.read',
        screenLabel: 'Suppliers',
        sidebarMenu: 'Suppliers',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view suppliers',
            'suppliers list',
            'supplier dekhna hai',
            'all suppliers',
            'vendor list',
            'take me to suppliers',
            'open suppliers',
        ],
        requiredFields: [],
        optionalFields: ['Search query'],
        reviewItems: ['Check supplier payables and active delivery status.'],
        goal: 'Review supplier contact records, gas rates, and outstanding payables.',
        steps: [
            'Click "Suppliers" in the sidebar menu.',
            'Search or filter suppliers by name or phone.',
            'Click on any supplier row to inspect past bowser deliveries and payment history.',
        ],
        outcome: 'Displays active LPG suppliers and their outstanding account balances.',
    },

    // ==================== INVENTORY ====================
    {
        id: 'add_inventory_item',
        module: 'inventory-items',
        title: 'Add Inventory Item (SKU)',
        pageRoute: '/inventory/add',
        listRoute: '/inventory',
        requiresId: false,
        requiredPermission: 'inventory-items.create',
        viewPermission: 'inventory-items.create',
        screenLabel: 'Inventory',
        sidebarMenu: 'Inventory',
        buttonLabel: 'Add Item',
        submitButton: 'Save Item',
        status: 'verified',
        searchPhrases: [
            'add inventory item',
            'new inventory item',
            'add item to inventory',
            'create inventory item',
            'item kaise add karein',
            'inventory entry',
            'add product',
            'how do i add inventory',
        ],
        requiredFields: [
            'Item Name (min 2 characters)',
            'Item Category ("filled-cylinder", "empty-cylinder", "accessory", "spare-part", "consumable", or "general")',
            'Unit of Measure ("pcs", "kg", "cylinder", or "unit")',
            'Current Quantity (defaults to 0, cannot be negative)',
            'Minimum Stock Level (reorder alert threshold)',
        ],
        optionalFields: [
            'Cylinder Type (required if category is cylinder)',
            'Unit Purchase Price (Rs.)',
            'Unit Selling Price (Rs.)',
            'Reorder Quantity',
            'Warehouse / Storage Area',
            'Rack / Bay Number',
        ],
        reviewItems: [
            'Ensure category matches physical stock type.',
            'If cylinder item, verify link to matching Cylinder Type.',
            'Check stock threshold numbers.',
        ],
        goal: 'Add an inventory item SKU (filled/empty cylinder or spare part) into warehouse tracking.',
        steps: [
            'Open the "Inventory" screen from the sidebar, or click the "Open Add Inventory Item" button below.',
            'Click the "Add Item" button at the top right of the inventory table.',
            'Enter the "Item Name", select the "Item Category", and choose the "Unit of Measure".',
            'Set the "Current Quantity", "Minimum Stock Level", and enter purchase and selling prices.',
            'Click "Save Item". The inventory SKU is cataloged and tracked across sales and purchases.',
        ],
        outcome: 'Item is added to the stock register and monitored for reorder alerts.',
    },

    {
        id: 'view_inventory',
        module: 'inventory-items',
        title: 'View Inventory Items',
        pageRoute: '/inventory',
        listRoute: '/inventory',
        requiresId: false,
        requiredPermission: 'inventory-items.read',
        viewPermission: 'inventory-items.read',
        screenLabel: 'Inventory',
        sidebarMenu: 'Inventory',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view inventory',
            'inventory list',
            'stock dekhna hai',
            'cylinder stock',
            'cylinder count',
            'warehouse stock',
            'take me to inventory',
            'open inventory',
        ],
        requiredFields: [],
        optionalFields: ['Category filter', 'Search item'],
        reviewItems: ['Review current quantities, available filled cylinders, and empty cylinders.'],
        goal: 'Inspect warehouse stock counts for filled cylinders, empty shells, and accessories.',
        steps: [
            'Click "Inventory" in the sidebar menu.',
            'Inspect the stock table showing Item Code, Name, Category, In Stock Quantity, and Valuation.',
            'Filter by category (e.g. "filled-cylinder" or "empty-cylinder") to check available dispatch stock.',
        ],
        outcome: 'Displays current warehouse stock counts and alert levels.',
    },

    // ==================== ACCOUNTING / ACCOUNTS ====================
    {
        id: 'add_account',
        module: 'accounts',
        title: 'Add Ledger Account',
        pageRoute: '/accounting/add',
        listRoute: '/accounting',
        requiresId: false,
        requiredPermission: 'accounts.create',
        viewPermission: 'accounts.create',
        screenLabel: 'Accounting',
        sidebarMenu: 'Accounting',
        buttonLabel: 'Add Account',
        submitButton: 'Save Account',
        status: 'verified',
        searchPhrases: [
            'add account',
            'create account',
            'new account',
            'bank account add karna',
            'chart of accounts entry',
            'naya account kaise banayein',
            'how do i add an account',
        ],
        requiredFields: [
            'Account Name (e.g. "Meezan Bank - Plant Collection")',
            'Account Type ("asset", "liability", "equity", "revenue", or "expense")',
            'Account Category ("current-asset", "cash", "bank", "accounts-receivable", or "accounts-payable")',
        ],
        optionalFields: [
            'Bank Name & Branch Name',
            'Account Number & IBAN / SWIFT',
            'Opening Balance (Rs.)',
            'Primary Account toggle',
            'Description',
        ],
        reviewItems: [
            'Verify account type and category matching double-entry accounting rules.',
            'Check opening balance matches bank statement.',
        ],
        goal: 'Create a new cash, bank, or ledger account in the chart of accounts.',
        steps: [
            'Open the "Accounting" screen from the sidebar, or click the "Open Add Account" button below.',
            'Click the "Add Account" button at the top right of the chart of accounts.',
            'Enter the "Account Name", select the "Account Type" (e.g. Asset), and choose the "Account Category" (e.g. Bank or Cash).',
            'If bank account, enter the Bank Name, Account Number, and Opening Balance amount.',
            'Click "Save Account". The account is added to the Chart of Accounts and available across all payment forms.',
        ],
        outcome: 'New ledger account is created and usable for payment receipts and disbursements.',
        followUpAnswers: {
            account: 'When setting up bank accounts, choose Account Type "Asset" and Category "Bank". For cash registers, choose Type "Asset" and Category "Cash".',
        },
    },

    {
        id: 'view_accounts',
        module: 'accounts',
        title: 'View Chart of Accounts',
        pageRoute: '/accounting',
        listRoute: '/accounting',
        requiresId: false,
        requiredPermission: 'accounts.read',
        viewPermission: 'accounts.read',
        screenLabel: 'Accounting',
        sidebarMenu: 'Accounting',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view accounts',
            'chart of accounts',
            'account balance',
            'bank balance',
            'cash balance',
            'accounting dekhna hai',
            'take me to accounting',
            'open accounting',
        ],
        requiredFields: [],
        optionalFields: ['Category filter'],
        reviewItems: ['Review cash on hand, bank balances, receivables, and payables.'],
        goal: 'Review financial accounts, cash positions, and general ledger balances.',
        steps: [
            'Click "Accounting" in the sidebar menu.',
            'Review the Chart of Accounts showing Account Code, Name, Type, and Current Balance.',
            'Click on any account row to open its detailed debit/credit transaction ledger.',
        ],
        outcome: 'Displays company financial accounts and real-time ledger balances.',
    },

    // ==================== EXPENSES ====================
    {
        id: 'record_expense',
        module: 'expenses',
        title: 'Record Plant Expense',
        pageRoute: '/expenses/add',
        listRoute: '/expenses',
        requiresId: false,
        requiredPermission: 'expenses.create',
        viewPermission: 'expenses.create',
        screenLabel: 'Expenses',
        sidebarMenu: 'Expenses',
        buttonLabel: 'Add Expense',
        submitButton: 'Record Expense',
        status: 'verified',
        searchPhrases: [
            'record expense',
            'add expense',
            'kharcha add karna',
            'plant expense',
            'generator fuel',
            'electricity bill',
            'office expense',
            'expense voucher',
            'how do i record an expense',
        ],
        requiredFields: [
            'Expense Category (e.g. Fuel, Utilities, Maintenance, Office Supplies)',
            'Expense Date (defaults to today)',
            'Expense Amount (Rs., must be > 0)',
            'Payment Method ("Cash", "Bank Transfer", "Cheque", or "Online")',
            'Source Account (select cash/bank account funds are drawn from)',
        ],
        optionalFields: ['Vendor / Payee Name', 'Expense Description', 'Reference #', 'Remarks'],
        reviewItems: [
            'Check Expense Category and Amount.',
            'Ensure source account has sufficient balance to cover the expense.',
        ],
        goal: 'Record operating overhead, utility bills, fuel, or plant maintenance expenses.',
        steps: [
            'Open the "Expenses" screen from the sidebar, or click the "Open Add Expense" button below.',
            'Click the "Add Expense" button at the top right of the expense list.',
            'Select the "Expense Category", verify the "Expense Date", and enter the "Expense Amount".',
            'Select the "Payment Method" and choose the source "Account" (e.g. "Cash on Hand" or Bank). Enter "Vendor / Payee Name" and description.',
            'Click "Record Expense". The expense voucher is recorded and funds are deducted from the designated account.',
        ],
        outcome: 'Expense is booked into plant overhead and cash/bank balance decreases.',
    },

    {
        id: 'view_expenses',
        module: 'expenses',
        title: 'View Expenses Ledger',
        pageRoute: '/expenses',
        listRoute: '/expenses',
        requiresId: false,
        requiredPermission: 'expenses.read',
        viewPermission: 'expenses.read',
        screenLabel: 'Expenses',
        sidebarMenu: 'Expenses',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view expenses',
            'expense list',
            'expenses dekhna hai',
            'overheads list',
            'take me to expenses',
            'open expenses',
        ],
        requiredFields: [],
        optionalFields: ['Category filter', 'Date range'],
        reviewItems: ['Inspect monthly operating expenditures.'],
        goal: 'Review operational overheads, utility payments, and expense vouchers.',
        steps: [
            'Click "Expenses" in the sidebar menu.',
            'Browse recorded expenses with Expense #, Category, Vendor, Amount, and Paying Account.',
        ],
        outcome: 'Displays historical expense transactions.',
    },

    // ==================== EMPLOYEES ====================
    {
        id: 'add_employee',
        module: 'employees',
        title: 'Add New Employee',
        pageRoute: '/employees/add',
        listRoute: '/employees',
        requiresId: false,
        requiredPermission: 'employees.create',
        viewPermission: 'employees.create',
        screenLabel: 'Employees',
        sidebarMenu: 'Employees',
        buttonLabel: 'Add Employee',
        submitButton: 'Save Employee',
        status: 'verified',
        searchPhrases: [
            'add employee',
            'new employee',
            'staff entry',
            'mulazim add karna',
            'register employee',
            'how do i add an employee',
        ],
        requiredFields: [
            'Full Name (min 2 characters)',
            'CNIC Number (13 digits: 35201-1234567-9)',
            'Phone Number (03XX-XXXXXXX)',
        ],
        optionalFields: [
            'Father / Husband Name',
            'Department (Plant, Operations, Sales, Accounts, Security)',
            'Job Title / Designation',
            'Monthly Salary Amount (Rs.)',
            'Joining Date',
            'Emergency Contact Name & Phone',
            'Home Address',
        ],
        reviewItems: ['Ensure CNIC number format is valid (13 digits) and phone number is 11 digits.'],
        goal: 'Register a plant staff member or operator profile in the employee directory.',
        steps: [
            'Open the "Employees" screen from the sidebar, or click the "Open Add Employee" button below.',
            'Click the "Add Employee" button at the top right of the employee directory.',
            'Enter the "Full Name", valid 13-digit "CNIC Number", and "Phone Number".',
            'Optionally assign "Department", "Job Title", "Monthly Salary", and "Joining Date".',
            'Click "Save Employee". The employee profile is registered and ready for operator assignments.',
        ],
        outcome: 'New staff profile is saved and can be assigned to plant filling batches or user accounts.',
    },

    {
        id: 'view_employees',
        module: 'employees',
        title: 'View Employees Directory',
        pageRoute: '/employees',
        listRoute: '/employees',
        requiresId: false,
        requiredPermission: 'employees.read',
        viewPermission: 'employees.read',
        screenLabel: 'Employees',
        sidebarMenu: 'Employees',
        buttonLabel: 'Filter / Search',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view employees',
            'employee list',
            'staff directory',
            'mulazmeen dekhna hai',
            'take me to employees',
            'open employees',
        ],
        requiredFields: [],
        optionalFields: ['Department filter', 'Search employee'],
        reviewItems: ['Check active vs inactive employment statuses.'],
        goal: 'View company staff directory, designations, and contact numbers.',
        steps: [
            'Click "Employees" in the sidebar menu.',
            'Browse through employee profiles showing Name, Designation, Department, and Phone.',
        ],
        outcome: 'Displays staff contact cards and employment records.',
    },

    // ==================== CYLINDER TYPES ====================
    {
        id: 'add_cylinder_type',
        module: 'cylinder-types',
        title: 'Add Cylinder Type',
        pageRoute: '/cylinders/add-type',
        listRoute: '/cylinder-types',
        requiresId: false,
        requiredPermission: 'cylinder-types.create',
        viewPermission: 'cylinder-types.create',
        screenLabel: 'Cylinder Types',
        sidebarMenu: 'Cylinder Types',
        buttonLabel: 'Add Cylinder Type',
        submitButton: 'Save Cylinder Type',
        status: 'verified',
        searchPhrases: [
            'add cylinder type',
            'new cylinder type',
            'cylinder type add karna',
            'cylinder specification',
            'define cylinder',
            'how do i add cylinder type',
        ],
        requiredFields: [
            'Type Name (e.g. "11.8 KG Domestic")',
            'Category ("domestic", "commercial", or "industrial")',
            'LPG Capacity (KG) (must be > 0)',
            'Empty Tare Weight (KG) (must be > 0)',
            'Default Selling Price (Rs.) (must be > 0)',
        ],
        optionalFields: ['Refill Price (Rs.)', 'Valve Type', 'Color Code', 'Safety Certification #'],
        reviewItems: ['Verify capacity KG matches tare and decanting scale targets.'],
        goal: 'Define a new cylinder packaging type (e.g. 11.8 KG, 15 KG, 45.4 KG).',
        steps: [
            'Open the "Cylinder Types" screen from the sidebar, or click the "Open Add Cylinder Type" button below.',
            'Click the "Add Cylinder Type" button.',
            'Enter the "Type Name", select the "Category", and specify the "LPG Capacity (KG)" and "Tare Weight (KG)".',
            'Enter the default "Selling Price" and optional "Refill Price".',
            'Click "Save Cylinder Type". The specification is created and linked to filling batches and sales.',
        ],
        outcome: 'Cylinder type is added to the plant catalog for batch decanting and billing.',
    },

    {
        id: 'view_cylinder_types',
        module: 'cylinder-types',
        title: 'View Cylinder Types',
        pageRoute: '/cylinder-types',
        listRoute: '/cylinder-types',
        requiresId: false,
        requiredPermission: 'cylinder-types.read',
        viewPermission: 'cylinder-types.read',
        screenLabel: 'Cylinder Types',
        sidebarMenu: 'Cylinder Types',
        buttonLabel: 'Search / View',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view cylinder types',
            'cylinder types list',
            'cylinder specifications',
            'take me to cylinder types',
            'open cylinder types',
        ],
        requiredFields: [],
        optionalFields: [],
        reviewItems: ['Inspect rated capacities and current selling prices.'],
        goal: 'Review cylinder specifications, empty shell weights, and standard retail prices.',
        steps: [
            'Click "Cylinder Types" in the sidebar menu.',
            'Review types showing Code, Name, Capacity (KG), Tare Weight, and Default Price.',
        ],
        outcome: 'Displays cylinder product configurations.',
    },

    // ==================== FIXED ASSETS ====================
    {
        id: 'add_asset',
        module: 'assets',
        title: 'Add Fixed Asset',
        pageRoute: '/assets/add',
        listRoute: '/assets',
        requiresId: false,
        requiredPermission: 'assets.create',
        viewPermission: 'assets.create',
        screenLabel: 'Fixed Assets',
        sidebarMenu: 'Fixed Assets',
        buttonLabel: 'Add Asset',
        submitButton: 'Save Asset',
        status: 'verified',
        searchPhrases: [
            'add asset',
            'new asset',
            'plant machinery',
            'generator add karna',
            'bowser asset',
            'fixed asset entry',
        ],
        requiredFields: ['Asset Name', 'Asset Category', 'Purchase Cost (Rs.)', 'Purchase Date'],
        optionalFields: ['Location Description', 'Depreciation Rate', 'Funding Account'],
        reviewItems: ['Verify asset purchase value and funding account.'],
        goal: 'Register physical plant infrastructure, bowsers, generators, or decanting machines.',
        steps: [
            'Open the "Fixed Assets" screen from the sidebar, or click the "Open Add Asset" button below.',
            'Click "Add Asset".',
            'Enter "Asset Name", "Category", "Purchase Cost", and "Purchase Date".',
            'Select funding account and enter location details.',
            'Click "Save Asset".',
        ],
        outcome: 'Asset is logged into the fixed assets register.',
    },

    {
        id: 'log_maintenance',
        module: 'assets',
        title: 'Log Equipment Maintenance',
        pageRoute: '/maintenance-records/add',
        listRoute: '/assets',
        requiresId: false,
        requiredPermission: 'assets.create',
        viewPermission: 'assets.create',
        screenLabel: 'Fixed Assets',
        sidebarMenu: 'Fixed Assets',
        buttonLabel: 'Log Maintenance',
        submitButton: 'Save Maintenance Record',
        status: 'verified',
        searchPhrases: [
            'log maintenance',
            'machinery repair',
            'tank inspection',
            'generator service',
            'maintenance record',
            'how do i log maintenance',
        ],
        requiredFields: ['Asset (select asset)', 'Maintenance Date', 'Maintenance Type', 'Cost Amount'],
        optionalFields: ['Service Vendor', 'Notes / Findings'],
        reviewItems: ['Ensure maintenance cost and vendor details are verified.'],
        goal: 'Record preventive maintenance, calibration, or emergency repair on plant assets.',
        steps: [
            'Open "Fixed Assets" from the sidebar menu, then click the "Log Maintenance" button.',
            'Select the "Asset" and enter "Maintenance Date" and "Maintenance Type".',
            'Enter the "Cost Amount" and service description.',
            'Click "Save Maintenance Record".',
        ],
        outcome: 'Maintenance log is stored against the asset history.',
    },

    // ==================== USERS & ROLES ====================
    {
        id: 'create_user',
        module: 'users',
        title: 'Create System User',
        pageRoute: '/users-roles/add-user',
        listRoute: '/users-roles',
        requiresId: false,
        requiredPermission: 'users.create',
        viewPermission: 'users.create',
        screenLabel: 'Users & Roles',
        sidebarMenu: 'Users & Roles',
        buttonLabel: 'Add User',
        submitButton: 'Save User',
        status: 'verified',
        searchPhrases: [
            'create user',
            'add user',
            'new user login',
            'user kaise banayein',
            'staff login account',
            'create login',
        ],
        requiredFields: ['Username', 'Email Address', 'Password (min 8 characters)', 'Role (select role)'],
        optionalFields: ['Linked Employee Profile'],
        reviewItems: ['Ensure selected role aligns with staff member duties.'],
        goal: 'Create login credentials and assign security roles for plant staff.',
        steps: [
            'Open the "Users & Roles" screen from the sidebar, or click the "Open Add User" button below.',
            'Click the "Add User" button.',
            'Enter the "Username", "Email Address", initial "Password", and select the "Role".',
            'Optionally link to an existing Employee profile.',
            'Click "Save User". The login account is created.',
        ],
        outcome: 'System login account is established with role-based permissions.',
    },

    {
        id: 'create_role',
        module: 'roles',
        title: 'Create Security Role & Permissions',
        pageRoute: '/users-roles/add-role',
        listRoute: '/users-roles',
        requiresId: false,
        requiredPermission: 'roles.create',
        viewPermission: 'roles.create',
        screenLabel: 'Users & Roles',
        sidebarMenu: 'Users & Roles',
        buttonLabel: 'Add Role',
        submitButton: 'Save Role',
        status: 'verified',
        searchPhrases: [
            'create role',
            'add role',
            'new role',
            'permissions set karna',
            'define permissions',
            'role management',
        ],
        requiredFields: ['Role Name', 'Description'],
        optionalFields: ['Module Permissions Matrix'],
        reviewItems: ['Ensure minimal necessary permissions are granted.'],
        goal: 'Define a custom staff role and configure read/write permissions per module.',
        steps: [
            'Open the "Users & Roles" screen from the sidebar, or click the "Open Add Role" button below.',
            'Click the "Add Role" button.',
            'Enter the "Role Name" and description.',
            'Toggle permissions per module across Sales, Payments, Inventory, Filling, etc.',
            'Click "Save Role".',
        ],
        outcome: 'Security role is defined and can be assigned to system users.',
    },

    // ==================== DASHBOARD ====================
    {
        id: 'view_dashboard',
        module: 'dashboard',
        title: 'View Operations Dashboard',
        pageRoute: '/Dashboard',
        listRoute: '/Dashboard',
        requiresId: false,
        requiredPermission: 'dashboard.read',
        viewPermission: null, // Accessible to all authenticated users
        screenLabel: 'Dashboard',
        sidebarMenu: 'Dashboard',
        buttonLabel: 'Dashboard',
        submitButton: null,
        status: 'verified',
        searchPhrases: [
            'view dashboard',
            'dashboard dekhna hai',
            'kpi summary',
            'plant status',
            'main screen',
            'home screen',
            'take me to dashboard',
            'open dashboard',
        ],
        requiredFields: [],
        optionalFields: [],
        reviewItems: ['Review daily sales, LPG stock levels, and finance KPIs.'],
        goal: 'View high-level overview of plant operations, stock, and financial summaries.',
        steps: [
            'Click "Dashboard" at the top of the sidebar menu.',
            'Review key summary KPI cards: Total LPG Stock (KG), Tank Fill %, Filled vs Empty Cylinders, and Today\'s Sales.',
        ],
        outcome: 'Displays plant operational KPIs and quick business metrics.',
    },
];

// --- 3. COVERAGE CHECKLIST ---
const COVERAGE_CHECKLIST = {
    summary: {
        totalActiveModules: 14,
        verifiedModules: 13,
        incompleteModules: 1, // Reports
        totalMappedPages: ERP_PAGES.length,
        totalMappedWorkflows: ERP_WORKFLOWS.length,
    },
    modules: [{
            module: 'Customers',
            status: 'verified',
            routes: ['/customers', '/customers/add', '/customers/view/:id', '/customers/edit/:id']
        },
        {
            module: 'Sales',
            status: 'verified',
            routes: ['/sales', '/sales/add', '/sales/view/:id', '/sales/edit/:id', '/invoices']
        },
        {
            module: 'Sales Returns',
            status: 'verified',
            routes: ['/sales/return']
        },
        {
            module: 'Payments',
            status: 'verified',
            routes: ['/payments', '/payments/add', '/payments/view/:id']
        },
        {
            module: 'Suppliers',
            status: 'verified',
            routes: ['/suppliers', '/suppliers/add', '/suppliers/view/:id', '/suppliers/edit/:id']
        },
        {
            module: 'LPG Receipts',
            status: 'verified',
            routes: ['/lpg-receipts', '/lpg-receipts/receive', '/lpg-receipts/view/:id']
        },
        {
            module: 'Filling Batches',
            status: 'verified',
            routes: ['/filling-batches', '/filling-batches/create', '/filling-batches/view/:id']
        },
        {
            module: 'Storage Tanks',
            status: 'verified',
            routes: ['/storage-tanks']
        },
        {
            module: 'Cylinder Types',
            status: 'verified',
            routes: ['/cylinder-types', '/cylinders/add-type', '/cylinders/view-type/:id']
        },
        {
            module: 'Inventory',
            status: 'verified',
            routes: ['/inventory', '/inventory/add', '/inventory/view/:id', '/inventory/edit/:id']
        },
        {
            module: 'Accounting',
            status: 'verified',
            routes: ['/accounting', '/accounting/add', '/accounting/view/:id', '/accounting/details/:id']
        },
        {
            module: 'Expenses',
            status: 'verified',
            routes: ['/expenses', '/expenses/add']
        },
        {
            module: 'Employees',
            status: 'verified',
            routes: ['/employees', '/employees/add', '/employees/view/:id']
        },
        {
            module: 'Fixed Assets',
            status: 'verified',
            routes: ['/assets', '/assets/add', '/maintenance-records/add']
        },
        {
            module: 'Users & Roles',
            status: 'verified',
            routes: ['/users-roles', '/users-roles/add-user', '/users-roles/add-role', '/users-roles/Permissions']
        },
        {
            module: 'Reports',
            status: 'incomplete',
            routes: ['/reports'],
            note: 'Reporting interface currently placeholder/unverified'
        },
        {
            module: 'System Logs',
            status: 'verified',
            routes: ['/audit-logs', '/server-logs']
        },
    ],
};

// --- 4. RECOGNITION & LINK RESOLUTION HELPERS ---

const STOP_WORDS = new Set([
    'how', 'do', 'i', 'to', 'a', 'an', 'the', 'is', 'in', 'on', 'for', 'of', 'my', 'me',
    'please', 'can', 'we', 'you', 'are', 'what', 'where', 'which', 'who', 'when', 'why',
    'hai', 'kaise', 'karen', 'karna', 'karo', 'ko', 'se', 'mein', 'par', 'aur', 'ye', 'wo',
]);

function tokenize(text = '') {
    return text
        .toLowerCase()
        .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * Resolves an approved page link for a workflow given the user's permissions.
 *
 * @param {Object} workflow - ERP workflow definition
 * @param {string[]} userPermissions - Effective permissions of the user
 * @returns {{ label: string, route: string, note?: string }|null}
 */
function resolvePageLink(workflow, userPermissions = []) {
    if (!workflow || !workflow.pageRoute) return null;

    const permSet = new Set(userPermissions);

    // If user lacks the action permission and the view permission, do not render a link
    if (workflow.viewPermission && !permSet.has(workflow.viewPermission) && !permSet.has(workflow.requiredPermission)) {
        return null;
    }

    // If the target page requires a record ID (e.g. /customers/view/:id), guide user to the list page
    if (workflow.requiresId && workflow.listRoute) {
        return {
            label: `Open ${workflow.screenLabel} List`,
            route: workflow.listRoute,
            note: 'Open the list and click the record row to view/edit details.',
        };
    }

    return {
        label: `Open ${workflow.buttonLabel || workflow.title}`,
        route: workflow.pageRoute,
    };
}

/**
 * Checks if a question is a contextual follow-up to the last authorized workflow.
 *
 * @param {string} question - Cleaned question text
 * @param {string|null} lastWorkflowId - ID of previous authorized workflow
 * @returns {boolean}
 */
function isFollowUpQuestion(question = '', lastWorkflowId = null) {
    if (!lastWorkflowId) return false;

    const qLower = question.toLowerCase();

    const followUpTriggers = [
        'which account',
        'which bank',
        'konsa account',
        'konsa bank',
        'what account',
        'what do i do next',
        'what next',
        'what is next',
        'what should i enter',
        'what should i do next',
        'ab kya karun',
        'iske baad kya karna hai',
        'what does this field mean',
        'can i save as draft',
        'where is the button',
        'which button',
        'which option',
    ];

    return followUpTriggers.some((trigger) => qLower.includes(trigger));
}

/**
 * Scores a workflow against a question string.
 */
function scoreWorkflow(entry, questionLower) {
    const qTokens = tokenize(questionLower).filter((t) => !STOP_WORDS.has(t));
    let bestPhraseScore = 0;

    for (const phrase of entry.searchPhrases) {
        const phraseLower = phrase.toLowerCase();
        let pScore = 0;

        // Direct phrase match
        if (questionLower.includes(phraseLower)) {
            pScore += 25 + phraseLower.length;
        } else if (phraseLower.includes(questionLower)) {
            pScore += 15 + questionLower.length;
        }

        // Meaningful token overlap (excluding stop words)
        const pTokens = tokenize(phraseLower).filter((t) => !STOP_WORDS.has(t));
        const overlap = pTokens.filter((t) => qTokens.includes(t));
        pScore += overlap.length * 10;

        if (overlap.length > 0 && overlap.length === pTokens.length) {
            pScore += 15; // Full coverage of phrase key concepts
        }

        if (pScore > bestPhraseScore) {
            bestPhraseScore = pScore;
        }
    }

    // Bonus for title/module match
    if (questionLower.includes(entry.module)) bestPhraseScore += 5;

    return bestPhraseScore;
}

/**
 * Match the most relevant workflow entries for a given question.
 *
 * @param {string} question - Raw or normalized question
 * @param {string[]} userPermissions - Effective permissions of the user
 * @param {string|null} lastWorkflowId - ID of previous workflow for contextual follow-ups
 * @returns {{
 *   matchedWorkflows: Array,
 *   bestMatch: Object|null,
 *   isTopUnauthorized: boolean,
 *   unauthorizedMatch: Object|null,
 *   isAmbiguous: boolean,
 *   ambiguousMatches: Array,
 *   isFollowUp: boolean,
 *   pageLink: Object|null
 * }}
 */
function matchWorkflows(question = '', userPermissions = [], lastWorkflowId = null) {
    const qLower = question.toLowerCase().trim();
    const permSet = new Set(userPermissions);

    // 1. Contextual Follow-up Check: If this is a follow-up ("Which account do I choose?"), resolve within last workflow
    if (lastWorkflowId && isFollowUpQuestion(qLower, lastWorkflowId)) {
        const priorWorkflow = ERP_WORKFLOWS.find((w) => w.id === lastWorkflowId);
        if (priorWorkflow && (permSet.has(priorWorkflow.requiredPermission) || !priorWorkflow.requiredPermission)) {
            return {
                matchedWorkflows: [priorWorkflow],
                bestMatch: priorWorkflow,
                isTopUnauthorized: false,
                unauthorizedMatch: null,
                isAmbiguous: false,
                ambiguousMatches: [],
                isFollowUp: true,
                pageLink: resolvePageLink(priorWorkflow, userPermissions),
            };
        }
    }

    // 2. Score all workflows
    const scored = ERP_WORKFLOWS.map((entry) => ({
        entry,
        score: scoreWorkflow(entry, qLower),
        hasPermission: !entry.requiredPermission || permSet.has(entry.requiredPermission),
    })).filter((item) => item.score > 0);

    scored.sort((a, b) => b.score - a.score);

    const topOverall = scored.length > 0 ? scored[0] : null;
    const authorized = scored.filter((s) => s.hasPermission);

    // Top unauthorized check: user asked for an action requiring permission they lack
    const isTopUnauthorized =
        topOverall &&
        !topOverall.hasPermission &&
        topOverall.score >= 15 &&
        (authorized.length === 0 || topOverall.score > (authorized[0]?.score || 0) + 5);

    // Check ambiguity (e.g. user says "how to record payment" matching customer receipt and supplier payment equally)
    const isAmbiguous =
        authorized.length >= 2 &&
        authorized[0].score >= 15 &&
        authorized[1].score >= 15 &&
        Math.abs(authorized[0].score - authorized[1].score) <= 5 &&
        authorized[0].entry.module === authorized[1].entry.module &&
        authorized[0].entry.id !== authorized[1].entry.id;

    const bestMatch = authorized.length > 0 && authorized[0].score >= 8 ? authorized[0].entry : null;
    const pageLink = bestMatch ? resolvePageLink(bestMatch, userPermissions) : null;

    return {
        matchedWorkflows: authorized.slice(0, 3).map((s) => s.entry),
        isTopUnauthorized,
        unauthorizedMatch: isTopUnauthorized ? topOverall.entry : null,
        bestMatch,
        isAmbiguous,
        ambiguousMatches: isAmbiguous ? [authorized[0].entry, authorized[1].entry] : [],
        isFollowUp: false,
        pageLink,
    };
}

/**
 * Format workflow entries for the AI instructor prompt.
 */
function formatKnowledgeForPrompt(workflows = []) {
    if (!workflows || workflows.length === 0) {
        return 'No verified ERP workflow guide is available for this request.';
    }

    return workflows
        .map((wf) => {
            const stepLines = wf.steps.map((step, idx) => `  ${idx + 1}. ${step}`).join('\n');
            return [
                `### Task [${wf.id}]: ${wf.title}`,
                `Screen: "${wf.screenLabel}" (Route: ${wf.pageRoute})`,
                `Required Permission: ${wf.requiredPermission || 'None'}`,
                `Button to Click: "${wf.buttonLabel}"`,
                `Direction / Mode: ${wf.direction || 'None'}`,
                `Goal: ${wf.goal}`,
                `Required Fields: ${wf.requiredFields ? wf.requiredFields.join(', ') : 'None'}`,
                `Optional Fields: ${wf.optionalFields ? wf.optionalFields.join(', ') : 'None'}`,
                `What to Review: ${wf.reviewItems ? wf.reviewItems.join(' ') : 'None'}`,
                `Steps:\n${stepLines}`,
                `Submit Button: "${wf.submitButton || 'Save'}"`,
                `Outcome: ${wf.outcome || ''}`,
            ].join('\n');
        })
        .join('\n\n');
}

module.exports = {
    ERP_PAGES,
    ERP_WORKFLOWS,
    ERP_WORKFLOW_ACTIONS: ERP_WORKFLOWS, // Backward compatibility alias
    COVERAGE_CHECKLIST,
    resolvePageLink,
    isFollowUpQuestion,
    matchWorkflows,
    formatKnowledgeForPrompt,
};