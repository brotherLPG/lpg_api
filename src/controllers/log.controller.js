const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');
const logService = require('../services/log.service');

exports.listLogs = asyncHandler(async (req, res) => {
  const query = req.validated?.query || req.query;
  const data = await logService.listLogs(query);
  send(res, 200, 'Logs fetched', data);
});
