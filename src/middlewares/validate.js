const ApiError = require('../utils/ApiError');

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.filter((part) => part !== 'body' && part !== 'query' && part !== 'params').join('.') || issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ApiError(400, errors[0]?.message || 'Validation failed', errors));
    }

    req.validated = result.data;
    if (result.data.body) req.body = result.data.body;
    return next();
  };
}

module.exports = validate;
