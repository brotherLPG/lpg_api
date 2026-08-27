function send(res, statusCode, message, data) {
  return res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
  });
}

module.exports = { send };
