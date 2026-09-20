const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const dashboardService = require('../services/dashboard.service');

exports.getOperationsOverview = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await dashboardService.getOperationsOverview(query);
  send(res, 200, 'Operations overview fetched', data);
});

exports.getInventoryAlerts = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await dashboardService.getInventoryAlerts(query);
  send(res, 200, 'Low-stock alerts fetched', data);
});
