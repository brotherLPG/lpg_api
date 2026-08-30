const { createMasterController } = require('./master.controller');
const { receipt, filling } = require('../services/lpg.service');

const receiptController = createMasterController(receipt, {
  singular: 'LPG receipt',
  plural: 'LPG receipts',
});

const fillingController = createMasterController(filling, {
  singular: 'Filling batch',
  plural: 'Filling batches',
});

module.exports = { receiptController, fillingController };
