const env = require('../config/env');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[env.logLevel] ?? LEVELS.info;

function write(level, message, meta) {
  if ((LEVELS[level] ?? 9) > current) return;
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta && Object.keys(meta).length ? { meta } : {}),
  };
  const out = level === 'error' ? console.error : console.log;
  out(JSON.stringify(line));
}

module.exports = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  debug: (message, meta) => write('debug', message, meta),
};
