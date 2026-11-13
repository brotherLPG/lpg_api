const SyncOperation = require('../models/syncOperation.model');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

const KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function operationKey(req, body) {
  const header = req?.headers?.['idempotency-key'] || req?.headers?.['x-idempotency-key'];
  const raw = header || body?.clientOperationId;
  if (raw === undefined || raw === null || raw === '') return null;
  const key = String(Array.isArray(raw) ? raw[0] : raw).trim();
  if (!KEY_PATTERN.test(key)) {
    throw new ApiError(400, 'Idempotency-Key must be a UUID');
  }
  return key;
}

async function findApplied(operationId, session) {
  if (!operationId) return null;
  let query = SyncOperation.findOne({ operationId });
  if (session) query = query.session(session);
  return query.lean();
}

async function remember(session, { operationId, entity, action, entityId }) {
  if (!operationId || !entityId) return;
  const docs = [{
    operationId,
    entity,
    action,
    entityId,
    status: 'applied',
  }];
  if (session) {
    await SyncOperation.create(docs, { session });
    return;
  }
  await SyncOperation.create(docs);
}

function isOperationConflict(error) {
  if (error?.code !== 11000) return false;
  return Boolean(
    error.keyPattern?.operationId
    || error.keyValue?.operationId
    || error.keyPattern?.clientOperationId
    || error.keyValue?.clientOperationId
  );
}

async function replayIfApplied(operationId, load) {
  const prior = await findApplied(operationId);
  if (!prior?.entityId) return null;
  logger.info('Sync operation replayed without a second write', {
    operationId,
    entity: prior.entity,
    action: prior.action,
    entityId: String(prior.entityId),
  });
  return load(prior.entityId);
}

module.exports = {
  operationKey,
  findApplied,
  remember,
  isOperationConflict,
  replayIfApplied,
};
