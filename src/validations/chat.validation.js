const { z } = require('zod');

// Standard UUID regex (v1, v3, v4, v5)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const chatRequestSchema = z.object({
  body: z
    .object({
      requestId: z
        .string({ required_error: 'requestId is required' })
        .trim()
        .regex(uuidRegex, 'Invalid requestId. Must be a valid UUID'),
      question: z
        .string({ required_error: 'question is required' })
        .trim()
        .min(1, 'question cannot be empty')
        .max(1200, 'question cannot exceed 1,200 characters'),
    })
    .strict({ message: 'Request body must only contain requestId and question' }),
});

module.exports = {
  chatRequestSchema,
};
