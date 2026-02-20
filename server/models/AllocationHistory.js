const mongoose = require('mongoose');

const allocationHistorySchema = new mongoose.Schema({
    allocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Allocation',
        required: true,
        index: true
    },
    version: {
        type: Number,
        required: true
    },
    changeType: {
        type: String,
        enum: ['created', 'updated', 'deleted', 'rollback'],
        required: true
    },
    // Snapshot of allocation at this version
    snapshot: {
        department: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department'
        },
        budgetHead: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BudgetHead'
        },
        allocatedAmount: Number,
        spentAmount: Number,
        financialYear: String,
        remarks: String
    },
    // What changed
    changes: {
        allocatedAmount: {
            old: Number,
            new: Number
        },
        remarks: {
            old: String,
            new: String
        }
    },
    changeReason: {
        type: String,
        trim: true
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    changedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient version queries
allocationHistorySchema.index({ allocationId: 1, version: -1 });
allocationHistorySchema.index({ changedBy: 1, changedAt: -1 });

module.exports = mongoose.model('AllocationHistory', allocationHistorySchema);
