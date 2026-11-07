const mongoose = require('mongoose');
const ActivityLog = require('../models/activityLog.model');
const { parsePagination, paginated } = require('../utils/pagination');

const RETENTION_SECONDS = ActivityLog.RETENTION_SECONDS;

const RETENTION_MS = RETENTION_SECONDS * 1000;
const SECRET_KEY = /password|token|secret|authorization|cookie/i;

let cleanupStarted = false;

function cutoffDate() {
  return new Date(Date.now() - RETENTION_MS);
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const safe = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SECRET_KEY.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      safe[key] = value.slice(0, 300);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    }
  }
  return Object.keys(safe).length ? safe : null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function deleteExpired() {
  if (mongoose.connection.readyState !== 1) return;
  await ActivityLog.deleteMany({ createdAt: { $lt: cutoffDate() } });
}

function scheduleCleanup() {
  if (cleanupStarted || mongoose.connection.readyState !== 1) return;
  cleanupStarted = true;
  deleteExpired().catch((error) => {
    cleanupStarted = false;
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'Log cleanup failed',
        meta: { message: error.message },
      })
    );
  });
}

async function record(entry) {
  if (mongoose.connection.readyState !== 1) return;
  scheduleCleanup();
  await ActivityLog.create({
    level: entry.level || 'info',
    kind: entry.kind,
    message: String(entry.message || '').slice(0, 500),
    method: entry.method || '',
    path: entry.path || '',
    statusCode: entry.statusCode ?? null,
    durationMs: entry.durationMs ?? null,
    ipAddress: entry.ipAddress || '',
    userId: entry.userId || null,
    meta: sanitizeMeta(entry.meta),
  });
}

async function recordRequest(entry) {
  await record({ ...entry, kind: 'request' });
}

async function recordApp(entry) {
  await record({ ...entry, kind: 'app' });
}

function toLogResponse(log) {
  return {
    _id: log._id,
    timestamp: log.createdAt,
    level: log.level,
    kind: log.kind,
    message: log.message,
    method: log.method || '',
    path: log.path || '',
    statusCode: log.statusCode,
    durationMs: log.durationMs,
    ipAddress: log.ipAddress || '',
    userId: log.userId || null,
    meta: log.meta || null,
  };
}

async function listLogs(query) {
  await deleteExpired();
  const { page, limit, skip } = parsePagination(query);
  const filter = { createdAt: { $gte: cutoffDate() } };

  if (query.level) filter.level = query.level;
  if (query.kind) filter.kind = query.kind;
  if (query.method) filter.method = query.method.toUpperCase();
  if (query.statusCode) filter.statusCode = Number(query.statusCode);
  if (query.path) {
    filter.path = { $regex: escapeRegex(query.path.trim()), $options: 'i' };
  }

  const [items, total] = await Promise.all([
    ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityLog.countDocuments(filter),
  ]);

  return {
    ...paginated(items.map(toLogResponse), total, page, limit),
    retentionDays: 3,
  };
}

module.exports = {
  recordRequest,
  recordApp,
  listLogs,
  deleteExpired,
};
