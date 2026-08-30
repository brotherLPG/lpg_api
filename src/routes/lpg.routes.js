const { createMasterRouter } = require('./master.router');
const { receiptController, fillingController } = require('../controllers/lpg.controller');
const { lpgReceipt, fillingBatch } = require('../validations/lpg.validation');

const lpgReceipts = createMasterRouter({
  moduleName: 'lpg-receipts',
  controller: receiptController,
  schemas: lpgReceipt,
  allowDelete: false,
});

const fillingBatches = createMasterRouter({
  moduleName: 'filling-batches',
  controller: fillingController,
  schemas: fillingBatch,
  allowDelete: false,
});

module.exports = { lpgReceipts, fillingBatches };
