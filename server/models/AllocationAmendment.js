const mongoose = require('mongoose');

const allocationAmendmentSchema = new mongoose.Schema({
    allocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Allocation',
        required: [true, 'Allocation reference is required'],
        index: true
    },
    originalAmount: {
        type: Number,
        required: [true, 'Original amount is required'],
        min: 0
    },
    requestedAmount: {
        type: Number,
        required: [true, 'Requested amount is required'],
        min: 0
    },
    changeAmount: {
        type: Number,
        required: true
    },
    changePercent: {
        type: Number,
        required: true
    },
    changeReason: {
        type: String,
        required: [true, 'Change reason/justification is required'],
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
allocationAmendmentSchema.index({ allocation: 1, status: 1 });
allocationAmendmentSchema.index({ requestedBy: 1 });
allocationAmendmentSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate change amount and percentage
allocationAmendmentSchema.pre('save', function (next) {
    if (this.isModified('requestedAmount') || this.isModified('originalAmount')) {
        this.changeAmount = this.requestedAmount - this.originalAmount;
        this.changePercent = this.originalAmount > 0
            ? Math.round((this.changeAmount / this.originalAmount) * 100)
            : 0;
    }

    // Set timestamps for approval/rejection
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

module.exports = mongoose.model('AllocationAmendment', allocationAmendmentSchema);
