const mongoose = require('mongoose');

const incomeSchema = new mongoose.Schema({
    financialYear: {
        type: String,
        required: [true, 'Financial year is required'],
        match: [/^\d{4}-\d{4}$/, 'Financial year must be in format YYYY-YYYY'],
        index: true
    },
    source: {
        type: String,
        enum: [
            'government_grant',
            'student_fees',
            'donation',
            'research_grant',
            'endowment',
            'consultancy',
            'other'
        ],
        required: [true, 'Income source is required']
    },
    category: {
        type: String,
        enum: ['recurring', 'non-recurring'],
        required: [true, 'Income category is required'],
        default: 'recurring'
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    receivedDate: {
        type: Date,
        default: null
    },
    expectedDate: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['expected', 'received', 'verified'],
        default: 'expected',
        index: true
    },
    referenceNumber: {
        type: String,
        trim: true,
        sparse: true
    },
    description: {
        type: String,
        trim: true,
        required: [true, 'Description is required']
    },
    remarks: {
        type: String,
        trim: true
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    verifiedAt: {
        type: Date,
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

// Indexes for better query performance
incomeSchema.index({ financialYear: 1, status: 1 });
incomeSchema.index({ source: 1 });
incomeSchema.index({ createdAt: -1 });

// Virtual for verification status
incomeSchema.virtual('isVerified').get(function () {
    return this.status === 'verified';
});

// Ensure virtual fields are serialized
incomeSchema.set('toJSON', { virtuals: true });

// Pre-save middleware to set financial year based on received/expected date
incomeSchema.pre('save', function (next) {
    if (!this.financialYear && (this.receivedDate || this.expectedDate)) {
        const date = this.receivedDate || this.expectedDate;
        const year = date.getFullYear();
        const month = date.getMonth() + 1; // 0-indexed

        // Financial year runs from April to March
        if (month >= 4) {
            this.financialYear = `${year}-${year + 1}`;
        } else {
            this.financialYear = `${year - 1}-${year}`;
        }
    }

    // Set receivedDate when status changes to 'received'
    if (this.isModified('status') && this.status === 'received' && !this.receivedDate) {
        this.receivedDate = new Date();
    }

    // Set verifiedAt when status changes to 'verified'
    if (this.isModified('status') && this.status === 'verified' && !this.verifiedAt) {
        this.verifiedAt = new Date();
    }

    next();
});

module.exports = mongoose.model('Income', incomeSchema);
