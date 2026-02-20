const AuditLog = require('../models/AuditLog');

/**
 * Record an audit log entry
 * @param {Object} data - Audit log data
 * @param {string} data.eventType - Type of event
 * @param {Object} data.req - Express request object (to extract user and ip)
 * @param {string} data.targetEntity - Entity type (Expenditure, User, etc.)
 * @param {string} data.targetId - ID of the target entity
 * @param {Object} [data.details] - Additional details
 * @param {Object} [data.previousValues] - Previous state
 * @param {Object} [data.newValues] - New state
 */
const recordAuditLog = async ({
    eventType,
    req,
    targetEntity,
    targetId,
    actor = null,
    actorRole = null,
    details = {},
    previousValues = null,
    newValues = null
}) => {
    try {
        await AuditLog.create({
            eventType,
            actor: actor || (req?.user ? req.user._id : null),
            actorRole: actorRole || (req?.user ? req.user.role : 'system'),
            targetEntity,
            targetId,
            details,
            previousValues,
            newValues,
            ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || '127.0.0.1',
            userAgent: req?.headers?.['user-agent'] || 'system'
        });
    } catch (error) {
        console.error('Error recording audit log:', error);
        // Don't throw error to prevent breaking the main flow
    }
};

module.exports = {
    recordAuditLog
};
