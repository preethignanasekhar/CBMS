const mongoose = require('mongoose');

const bulkUploadLogSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    uploadType: {
        type: String,
        enum: ['allocation', 'expenditure', 'bank_payment'],
        required: true
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    totalRows: {
        type: Number,
        required: true
    },
    successCount: {
        type: Number,
        default: 0
    },
    failureCount: {
        type: Number,
        default: 0
    },
    errors: [{
        row: Number,
        error: String,
        data: mongoose.Schema.Types.Mixed
    }],
    status: {
        type: String,
        enum: ['processing', 'completed', 'failed'],
        default: 'processing'
    },
    processingTime: {
        type: Number // milliseconds
    },
    financialYear: String
}, {
    timestamps: true
});

// Index for querying upload history
bulkUploadLogSchema.index({ uploadedBy: 1, createdAt: -1 });
bulkUploadLogSchema.index({ uploadType: 1, createdAt: -1 });

module.exports = mongoose.model('BulkUploadLog', bulkUploadLogSchema);
