const mongoose = require('mongoose');

const budgetProposalSchema = new mongoose.Schema({
  financialYear: {
    type: String,
    required: [true, 'Financial year is required'],
    match: [/^\d{4}-\d{4}$/, 'Financial year must be in format YYYY-YYYY']
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  proposalItems: [{
    budgetHead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BudgetHead',
      required: [true, 'Budget head is required']
    },
    proposedAmount: {
      type: Number,
      required: [true, 'Proposed amount is required'],
      min: [0, 'Proposed amount cannot be negative']
    },
    justification: {
      type: String,
      required: [true, 'Justification is required'],
      trim: true
    },
    previousYearUtilization: {
      type: Number,
      default: 0,
      min: [0, 'Previous year utilization cannot be negative']
    }
  }],
  totalProposedAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'verified_by_hod', 'verified_by_principal', 'verified', 'approved', 'rejected', 'revised'],
    default: 'draft'
  },
  approvalSteps: [{
    approver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      required: true
    },
    decision: {
      type: String,
      enum: ['approve', 'reject', 'verify'],
      required: true
    },
    remarks: {
      type: String,
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  submittedDate: {
    type: Date,
    default: null
  },
  approvedDate: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectionReason: {
    type: String,
    trim: true,
    default: null
  },
  notes: {
    type: String,
    trim: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Pre-save middleware to calculate total proposed amount
budgetProposalSchema.pre('save', function (next) {
  if (this.proposalItems && this.proposalItems.length > 0) {
    this.totalProposedAmount = this.proposalItems.reduce((total, item) => {
      return total + item.proposedAmount;
    }, 0);
  }

  // Set submitted date when status changes to submitted
  if (this.isModified('status') && this.status === 'submitted' && !this.submittedDate) {
    this.submittedDate = new Date();
  }

  // Set approved date when status changes to approved
  if (this.isModified('status') && this.status === 'approved' && !this.approvedDate) {
    this.approvedDate = new Date();
  }

  next();
});

// Index for better query performance
budgetProposalSchema.index({ financialYear: 1, department: 1 });
budgetProposalSchema.index({ status: 1 });
budgetProposalSchema.index({ submittedDate: 1 });

module.exports = mongoose.model('BudgetProposal', budgetProposalSchema);
