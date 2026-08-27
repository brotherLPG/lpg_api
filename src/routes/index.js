const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const roleRoutes = require('./role.routes');
const permissionRoutes = require('./permission.routes');
const { settingsRouter, notificationRouter, auditRouter } = require('./system.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/settings', settingsRouter);
router.use('/notifications', notificationRouter);
router.use('/audit-logs', auditRouter);

module.exports = router;
