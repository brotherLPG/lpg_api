const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const { settingsRouter, notificationRouter, auditRouter } = require('./system.routes');
const masters = require('./masters.routes');
const { lpgReceipts, fillingBatches } = require('./lpg.routes');
const { sales, salesReturns, payments, expenses } = require('./finance.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/settings', settingsRouter);
router.use('/notifications', notificationRouter);
router.use('/audit-logs', auditRouter);
router.use('/customers', masters.customers);
router.use('/suppliers', masters.suppliers);
router.use('/cylinder-types', masters.cylinderTypes);
router.use('/storage-tanks', masters.storageTanks);
router.use('/inventory-items', masters.inventoryItems);
router.use('/employees', masters.employees);
router.use('/accounts', masters.accounts);
router.use('/expense-categories', masters.expenseCategories);
router.use('/lpg-receipts', lpgReceipts);
router.use('/filling-batches', fillingBatches);
router.use('/sales', sales);
router.use('/sales-returns', salesReturns);
router.use('/payments', payments);
router.use('/expenses', expenses);

module.exports = router;
