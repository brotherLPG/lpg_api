const ApiError = require('../utils/ApiError');

function authorize(...requiredCodes) {
  return (req, res, next) => {
    const codes = req.permissionCodes || [];
    const missing = requiredCodes.filter((code) => !codes.includes(code));
    if (missing.length) {
      return next(new ApiError(403, 'You do not have permission for this action'));
    }
    return next();
  };
}

module.exports = authorize;
