const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const auditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    enum: [
      'user_login',
      'user_logout',
      'user_created',
      'user_updated',
      'user_deleted',
      'department_created',
      'department_updated',
      'department_deleted',
      'budget_head_created',
      'budget_head_updated',
      'budget_head_deleted',
      'allocation_created',
      'allocation_updated',
      'allocation_deleted',
      'expenditure_submitted',
      'expenditure_verified',
      'expenditure_approved',
      'expenditure_rejected',
      'expenditure_resubmitted',
      'file_uploaded',
      'file_deleted',
      'report_generated',
      'settings_updated',
      'file_upload_blocked',
      'file_upload_scanned',
      'approval_reminder',
      'budget_proposal_created',
      'budget_proposal_updated',
      'budget_proposal_submitted',
      'budget_proposal_approved',
      'budget_proposal_rejected',
      'budget_proposal_deleted',
      'password_reset',
      'income_created',
      'income_updated',
      'income_verified',
      'income_deleted',
      'financial_year_created',
      'financial_year_locked',
      'financial_year_closed',
      'allocation_amendment_requested',
      'allocation_amendment_approved',
      'allocation_amendment_rejected',
      'budget_override_requested',
      'budget_override_approved',
      'budget_override_rejected'
    ]
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  actorRole: {
    type: String,
    required: true
  },
  targetEntity: {
    type: String,
    enum: ['User', 'Department', 'BudgetHead', 'Allocation', 'Expenditure', 'File', 'Report', 'System', 'BudgetProposal']
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  previousValues: {
    type: mongoose.Schema.Types.Mixed
  },
  newValues: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  sessionId: {
    type: String
  }
}, {
  timestamps: true
});

// Index for better query performance
auditLogSchema.index({ eventType: 1 });
auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ targetEntity: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

// Compound index for common queries
auditLogSchema.index({ eventType: 1, createdAt: -1 });
auditLogSchema.index({ targetEntity: 1, targetId: 1 });

// TTL index to automatically delete logs older than 7 years (compliance requirement)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 220752000 }); // 7 years

// Pre-save hook to encrypt sensitive fields
auditLogSchema.pre('save', function (next) {
  // Only encrypt if modified
  if (this.isModified('details')) {
    this.details = encrypt(this.details);
  }
  if (this.isModified('previousValues')) {
    this.previousValues = encrypt(this.previousValues);
  }
  if (this.isModified('newValues')) {
    this.newValues = encrypt(this.newValues);
  }
  next();
});

// Post-init hook to decrypt sensitive fields when fetching from DB
auditLogSchema.post('init', function (doc) {
  if (doc.details) {
    doc.details = decrypt(doc.details);
  }
  if (doc.previousValues) {
    doc.previousValues = decrypt(doc.previousValues);
  }
  if (doc.newValues) {
    doc.newValues = decrypt(doc.newValues);
  }
});

// Also handle findByIdAndUpdate which bypasses 'save' hooks sometimes, 
// but since we usually create AuditLogs (immutable), this is less of a concern.
// However, ensure 'create' triggers 'save'.

module.exports = mongoose.model('AuditLog', auditLogSchema);
