const { recordRequest } = require('../services/log.service');

function requestPath(req) {
  const raw = req.originalUrl || req.url || req.path || '';
  return raw.split('?')[0];
}

function shouldSkip(req) {
  if (req.method === 'OPTIONS') return true;
  const path = requestPath(req);
  return (
    path === '/' ||
    path === '/health' ||
    path === '/favicon.ico' ||
    path === '/api/logs' ||
    path.startsWith('/api/logs/')
  );
}

function levelForStatus(statusCode) {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  return 'info';
}

function requestLog(req, res, next) {
  if (shouldSkip(req)) {
    return next();
  }

  const started = Date.now();
  const originalEnd = res.end;
  let logged = false;

  res.end = function patchedEnd(...args) {
    res.end = originalEnd;
    if (logged) {
      return originalEnd.apply(this, args);
    }
    logged = true;

    const path = requestPath(req);
    const statusCode = res.statusCode;
    const durationMs = Date.now() - started;
    const detail = res.locals.activityMessage;
    const message = detail
      ? `${req.method} ${path} ${statusCode} — ${detail}`
      : `${req.method} ${path} ${statusCode}`;

    return recordRequest({
      level: levelForStatus(statusCode),
      message,
      method: req.method,
      path,
      statusCode,
      durationMs,
      ipAddress: req.ip || '',
      userId: req.user?._id || null,
    })
      .catch((error) => {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'Failed to store request log',
            meta: { message: error.message },
          })
        );
      })
      .then(() => originalEnd.apply(this, args));
  };

  return next();
}

module.exports = requestLog;
