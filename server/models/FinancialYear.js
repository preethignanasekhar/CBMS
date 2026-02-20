const mongoose = require('mongoose');

const financialYearSchema = new mongoose.Schema({
    year: {
        type: String,
        unique: true,
        required: [true, 'Financial year is required'],
        match: [/^\d{4}-\d{4}$/, 'Financial year must be in format YYYY-YYYY']
    },
    startDate: {
        type: Date,
        required: [true, 'Start date is required']
    },
    endDate: {
        type: Date,
        required: [true, 'End date is required']
    },
    status: {
        type: String,
        enum: ['planning', 'active', 'locked', 'closed'],
        default: 'planning',
        index: true
    },
    // Summary fields (calculated/cached)
    totalIncomeExpected: {
        type: Number,
        default: 0,
        min: 0
    },
    totalIncomeReceived: {
        type: Number,
        default: 0,
        min: 0
    },
    totalAllocated: {
        type: Number,
        default: 0,
        min: 0
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    },
    // Locking information
    lockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    lockedAt: {
        type: Date,
        default: null
    },
    lockRemarks: {
        type: String,
        trim: true
    },
    // Closure information
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    closedAt: {
        type: Date,
        default: null
    },
    closureRemarks: {
        type: String,
        trim: true
    },
    // Year-end summary
    carryforwardAmount: {
        type: Number,
        default: 0
    },
    carryforwardAllowed: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
financialYearSchema.index({ year: 1 }, { unique: true });
financialYearSchema.index({ status: 1 });
financialYearSchema.index({ startDate: 1, endDate: 1 });

// Virtuals
financialYearSchema.virtual('isLocked').get(function () {
    return ['locked', 'closed'].includes(this.status);
});

financialYearSchema.virtual('isClosed').get(function () {
    return this.status === 'closed';
});

financialYearSchema.virtual('totalUnspent').get(function () {
    return this.totalAllocated - this.totalSpent;
});

financialYearSchema.virtual('utilizationPercentage').get(function () {
    return this.totalAllocated > 0
        ? Math.round((this.totalSpent / this.totalAllocated) * 100)
        : 0;
});

// Ensure virtual fields are serialized
financialYearSchema.set('toJSON', { virtuals: true });

// Validation: endDate must be after startDate
financialYearSchema.pre('save', function (next) {
    if (this.startDate && this.endDate && this.endDate <= this.startDate) {
        const error = new Error('End date must be after start date');
        return next(error);
    }

    // Set locked/closed timestamps
    if (this.isModified('status')) {
        if (this.status === 'locked' && !this.lockedAt) {
            this.lockedAt = new Date();
        }
        if (this.status === 'closed' && !this.closedAt) {
            this.closedAt = new Date();
        }
    }

    next();
});

// Static method to get active financial year
financialYearSchema.statics.getActive = async function () {
    return await this.findOne({ status: 'active' });
};

// Static method to get current FY based on today's date
financialYearSchema.statics.getCurrentYear = function () {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    if (month >= 4) {
        return `${year}-${year + 1}`;
    } else {
        return `${year - 1}-${year}`;
    }
};

module.exports = mongoose.model('FinancialYear', financialYearSchema);
