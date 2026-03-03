const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const auditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: [true, 'Event type is required']
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
