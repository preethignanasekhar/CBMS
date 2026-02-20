const mongoose = require('mongoose');

const budgetOverrideSchema = new mongoose.Schema({
    expenditure: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Expenditure',
        required: [true, 'Expenditure reference is required'],
        index: true
    },
    allocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Allocation',
        required: [true, 'Allocation reference is required'],
        index: true
    },
    allocationAmount: {
        type: Number,
        required: true,
        min: 0
    },
    allocationSpent: {
        type: Number,
        required: true,
        min: 0
    },
    expenseAmount: {
        type: Number,
        required: true,
        min: 0
    },
    overrunAmount: {
        type: Number,
        required: true,
        min: 0
    },
    justification: {
        type: String,
        required: [true, 'Justification is mandatory for budget override'],
        trim: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    approvalRemarks: {
        type: String,
        trim: true
    },
    approvedAt: {
        type: Date,
        default: null
    },
    rejectedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
budgetOverrideSchema.index({ expenditure: 1 });
budgetOverrideSchema.index({ allocation: 1 });
budgetOverrideSchema.index({ status: 1 });
budgetOverrideSchema.index({ requestedBy: 1 });
budgetOverrideSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate overrun amount
budgetOverrideSchema.pre('save', function (next) {
    if (this.isModified('expenseAmount') || this.isModified('allocationAmount') || this.isModified('allocationSpent')) {
        const remaining = this.allocationAmount - this.allocationSpent;
        this.overrunAmount = Math.max(0, this.expenseAmount - remaining);
    }

    // Set timestamps
    if (this.isModified('status')) {
        if (this.status === 'approved' && !this.approvedAt) {
            this.approvedAt = new Date();
        }
        if (this.status === 'rejected' && !this.rejectedAt) {
            this.rejectedAt = new Date();
        }
    }

    next();
});

module.exports = mongoose.model('BudgetOverride', budgetOverrideSchema);
