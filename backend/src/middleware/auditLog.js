const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Erstellt einen Audit-Log-Eintrag
 */
const createAuditLog = async ({
  userId, projectId, entityType, entityId, action, before, after, description, req,
}) => {
  try {
    await AuditLog.create({
      userId,
      projectId,
      entityType,
      entityId,
      action,
      changes: { before, after },
      description,
      ip: req?.ip,
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    logger.error('AuditLog-Fehler:', err);
  }
};

module.exports = { createAuditLog };
