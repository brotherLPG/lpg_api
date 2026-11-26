const asyncHandler = require('../utils/asyncHandler');
const chatService = require('../services/chat.service');

const chat = asyncHandler(async (req, res) => {
  // Always prevent caching of chatbot responses
  res.setHeader('Cache-Control', 'no-store');

  const { requestId, question } = req.body;
  const user = req.user;
  const permissionCodes = req.permissionCodes || [];

  try {
    const result = await chatService.processChatRequest({
      user,
      permissionCodes,
      requestId,
      question,
    });

    if (result.status === 'pending') {
      res.setHeader('Retry-After', result.retryAfter || 2);
      res.locals.activityMessage = 'chat: concurrent (pending)';
      return res.status(202).json({
        success: true,
        message: 'Question is currently being processed. Please retry shortly.',
        data: {
          status: 'pending',
          requestId: result.requestId,
          retryAfter: result.retryAfter || 2,
        },
      });
    }

    res.locals.activityMessage =
      result.source === 'cache' ? 'chat: reused (cache)' : 'chat: generated';

    return res.status(200).json({
      success: true,
      message: 'Response retrieved successfully',
      data: {
        status: 'completed',
        requestId: result.requestId,
        answer: result.answer,
        source: result.source,
        workflowId: result.workflowId || null,
        pageLink: result.pageLink || null,
        steps: result.steps || [],
        coverageStatus: result.coverageStatus || null,
      },
    });
  } catch (err) {
    if (err.statusCode === 429) {
      res.setHeader('Retry-After', err.retryAfter || 60);
      res.locals.activityMessage = 'chat: rate-limited';
    }
    throw err;
  }
});

module.exports = {
  chat,
};
