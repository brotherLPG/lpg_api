const express = require('express');
const validate = require('../middlewares/validate');
const { listLogsQuerySchema } = require('../validations/log.validation');
const logController = require('../controllers/log.controller');

const router = express.Router();

router.get('/', validate(listLogsQuerySchema), logController.listLogs);

module.exports = router;
