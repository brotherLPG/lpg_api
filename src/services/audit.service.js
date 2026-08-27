const logger = require('../utils/logger');
const { AuditLog } = require('../models');

function clientMeta(req) {
  return {
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
    userAgent: req?.headers?.['user-agent'] || '',
  };
}

async function writeAudit({ req, actionName, moduleName, entityName, entityId, oldValues, newValues }) {
  try {
    const meta = clientMeta(req);
    await AuditLog.create({
      userId: req?.user?._id || null,
      actionName,
      moduleName,
      entityName,
      entityId: entityId || null,
      oldValues: oldValues || null,
      newValues: newValues || null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  } catch (error) {
    logger.error('Failed to write audit log', { message: error.message });
  }
}

module.exports = { writeAudit, clientMeta };
