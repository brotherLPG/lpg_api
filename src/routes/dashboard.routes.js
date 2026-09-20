const express = require('express');
const { authenticate } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const {
  operationsOverviewQuerySchema,
  inventoryAlertsQuerySchema,
} = require('../validations/dashboard.validation');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(authenticate);

router.get(
  '/operations',
  authorize('reports.read'),
  validate(operationsOverviewQuerySchema),
  dashboardController.getOperationsOverview
);

router.get(
  '/inventory-alerts',
  authorize('reports.read'),
  validate(inventoryAlertsQuerySchema),
  dashboardController.getInventoryAlerts
);

module.exports = router;
