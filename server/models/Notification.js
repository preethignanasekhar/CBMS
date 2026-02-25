const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: [
      'expenditure_submitted',
      'expenditure_verified',
      'expenditure_approved',
      'expenditure_rejected',
      'budget_allocation_created',
      'budget_allocation_updated',
      'budget_exhaustion_warning',
      'approval_reminder',
      'system_announcement',
      'proposal_submitted',
      'proposal_verified',
      'proposal_rejected',
      'attachments_missing'
    ],
    required: true
  },
  relatedEntity: {
    type: String,
    enum: ['Expenditure', 'Allocation', 'User', 'System', 'BudgetProposal']
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  actionRequired: {
    type: Boolean,
    default: false
  },
  actionUrl: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });

// TTL index to automatically delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

module.exports = mongoose.model('Notification', notificationSchema);
