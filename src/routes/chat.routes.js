const express = require('express');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { chatRequestSchema } = require('../validations/chat.validation');
const chatController = require('../controllers/chat.controller');

const router = express.Router();

router.post('/', authenticate, validate(chatRequestSchema), chatController.chat);

module.exports = router;
