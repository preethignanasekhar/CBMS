const mongoose = require('mongoose');

const expenseItemSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true
  },
  billNumber: {
    type: String,
    required: true,
    trim: true
  },
  billDate: {
    type: Date,
    required: true
  },
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  },
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  description: {
    type: String,
    trim: true
  }
});

const approvalStepSchema = new mongoose.Schema({
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
    enum: ['approve', 'reject', 'verify', 'finalize'],
    required: true
  },
  remarks: {
    type: String,
    required: function () {
      return this.decision === 'reject';
    },
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const expenditureSchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: [true, 'Department is required']
  },
  budgetHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetHead',
    required: [true, 'Budget head is required']
  },
  eventName: {
    type: String,
    required: [true, 'Event name is required'],
    trim: true
  },
  eventType: {
    type: String,
    required: [true, 'Event type is required'],
    enum: ['Seminar', 'Workshop', 'Association', 'Research', 'Other']
  },
  eventDate: {
    type: Date,
    required: [true, 'Event date is required']
  },
  description: {
    type: String,
    trim: true
  },
  expenseItems: [expenseItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'approved', 'finalized', 'rejected'],
    default: 'pending'
  },
  approvalSteps: [approvalStepSchema],
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  financialYear: {
    type: String,
    required: true
  },
  isResubmission: {
    type: Boolean,
    default: false
  },
  originalExpenditureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expenditure'
  }
}, {
  timestamps: true
});

// Index for better query performance
expenditureSchema.index({ department: 1 });
expenditureSchema.index({ budgetHead: 1 });
expenditureSchema.index({ status: 1 });
expenditureSchema.index({ submittedBy: 1 });
expenditureSchema.index({ financialYear: 1 });
expenditureSchema.index({ eventDate: 1 });

// Compound index for department submissions
expenditureSchema.index({ department: 1, status: 1 });
expenditureSchema.index({ department: 1, financialYear: 1 });

// Pre-save middleware to set financial year based on event date
expenditureSchema.pre('save', function (next) {
  if (this.eventDate && !this.financialYear) {
    const year = this.eventDate.getFullYear();
    const month = this.eventDate.getMonth() + 1; // 0-indexed

    // Financial year runs from April to March
    if (month >= 4) {
      this.financialYear = `${year}-${year + 1}`;
    } else {
      this.financialYear = `${year - 1}-${year}`;
    }
  }

  // Calculate total amount if expenseItems changed
  if (this.isModified('expenseItems')) {
    this.totalAmount = this.expenseItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }

  next();
});

module.exports = mongoose.model('Expenditure', expenditureSchema);
