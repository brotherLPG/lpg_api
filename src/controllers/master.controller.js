const asyncHandler = require('../utils/asyncHandler');
const { send } = require('../utils/apiResponse');

function createMasterController(service, { singular, plural }) {
  const controller = {
    create: asyncHandler(async (req, res) => {
      const data = await service.create(req.body, req);
      send(res, 201, `${singular} created`, data);
    }),
    list: asyncHandler(async (req, res) => {
      const query = req.validated?.query || req.query;
      const data = await service.list(query);
      send(res, 200, `${plural} fetched`, data);
    }),
    get: asyncHandler(async (req, res) => {
      const data = await service.getById(req.params.id);
      send(res, 200, `${singular} fetched`, data);
    }),
    update: asyncHandler(async (req, res) => {
      const data = await service.update(req.params.id, req.body, req);
      send(res, 200, `${singular} updated`, data);
    }),
    remove: asyncHandler(async (req, res) => {
      await service.remove(req.params.id, req);
      send(res, 200, `${singular} deleted`);
    }),
  };

  if (service.getFormOptions) {
    controller.getFormOptions = asyncHandler(async (req, res) => {
      const query = req.validated?.query || req.query;
      const data = await service.getFormOptions(query);
      send(res, 200, `${singular} form options fetched`, data);
    });
  }

  if (service.getDashboard) {
    controller.getDashboard = asyncHandler(async (req, res) => {
      const query = req.validated?.query || req.query;
      const data = await service.getDashboard(query);
      send(res, 200, `${singular} dashboard fetched`, data);
    });
  }

  return controller;
}

module.exports = { createMasterController };
