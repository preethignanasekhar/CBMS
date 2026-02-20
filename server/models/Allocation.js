const mongoose = require('mongoose');

const allocationSchema = new mongoose.Schema({
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
  budgetHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetHead',
    required: [true, 'Budget head is required']
  },
  allocatedAmount: {
    type: Number,
    required: [true, 'Allocated amount is required'],
    min: [0, 'Allocated amount cannot be negative']
  },
  spentAmount: {
    type: Number,
    default: 0,
    min: [0, 'Spent amount cannot be negative']
  },
  remarks: {
    type: String,
    trim: true
  },
  // Governance fields
  sourceProposalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BudgetProposal',
    default: null,
    index: true
    // null = legacy allocation (created before governance enforcement)
    // non-null = created from approved proposal (required for new allocations)
  },
  status: {
    type: String,
    enum: ['active', 'amended', 'superseded'],
    default: 'active',
    index: true
  },
  amendmentRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AllocationAmendment',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Virtual for remaining amount
allocationSchema.virtual('remainingAmount').get(function () {
  return this.allocatedAmount - this.spentAmount;
});

// Ensure virtual fields are serialized
allocationSchema.set('toJSON', { virtuals: true });

// Compound index to ensure unique allocation per department/budget head/financial year
allocationSchema.index({
  financialYear: 1,
  department: 1,
  budgetHead: 1
}, { unique: true });

// Index for better query performance
allocationSchema.index({ financialYear: 1 });
allocationSchema.index({ department: 1 });
allocationSchema.index({ budgetHead: 1 });

// Pre-save middleware to validate spent amount doesn't exceed allocated amount
allocationSchema.pre('save', async function (next) {
  if (this.spentAmount > this.allocatedAmount) {
    const error = new Error('Spent amount cannot exceed allocated amount');
    return next(error);
  }

  // Governance Check 1: Financial year must not be closed
  try {
    const FinancialYear = mongoose.model('FinancialYear');
    const fy = await FinancialYear.findOne({ year: this.financialYear });

    if (fy && ['locked', 'closed'].includes(fy.status)) {
      const error = new Error(`Cannot create/modify allocations for ${fy.status} financial year: ${this.financialYear}`);
      return next(error);
    }
  } catch (err) {
    // FinancialYear model might not exist yet during migration
    // Skip this validation in that case
    if (err.name !== 'MissingSchemaError') {
      return next(err);
    }
  }

  // Governance Check 2: Total allocations cannot exceed total received income
  // DISABLED: This check was blocking allocations for departments that create budgets
  // from approved proposals without waiting for income receipts.
  // The user's workflow is: Approve Proposal → Create Allocation (no income dependency)
  // Uncomment the block below to re-enable income-based allocation limits.
  /*
  if (this.isNew || this.isModified('allocatedAmount')) {
    try {
      const Income = mongoose.model('Income');
      const Allocation = mongoose.model('Allocation');

      // Get total received income for this financial year
      const incomeResult = await Income.aggregate([
        {
          $match: {
            financialYear: this.financialYear,
            status: 'received'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);
      const totalIncome = incomeResult[0]?.total || 0;

      // Get total allocations for this financial year (excluding this allocation)
      const allocationResult = await Allocation.aggregate([
        {
          $match: {
            financialYear: this.financialYear,
            _id: { $ne: this._id }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$allocatedAmount' }
          }
        }
      ]);
      const totalAllocations = allocationResult[0]?.total || 0;

      const availableFunds = totalIncome - totalAllocations;

      if (this.allocatedAmount > availableFunds) {
        const error = new Error(
          `Insufficient funds. Available: ₹${availableFunds.toLocaleString('en-IN')}, ` +
          `Requested: ₹${this.allocatedAmount.toLocaleString('en-IN')}. ` +
          `Total Income (received): ₹${totalIncome.toLocaleString('en-IN')}, ` +
          `Already Allocated: ₹${totalAllocations.toLocaleString('en-IN')}`
        );
        return next(error);
      }
    } catch (err) {
      // Income model might not exist yet during migration
      // Skip this validation in that case
      if (err.name !== 'MissingSchemaError') {
        return next(err);
      }
    }
  }
  */

  next();
});

module.exports = mongoose.model('Allocation', allocationSchema);
