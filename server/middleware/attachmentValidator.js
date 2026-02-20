const Settings = require('../models/Settings');

/**
 * Middleware to validate attachments based on configurable threshold
 * Checks if expenditure amount requires attachments and validates presence
 */
const validateAttachments = async (req, res, next) => {
    try {
        let { totalAmount, billAmount, attachments, expenseItems } = req.body;

        // Handle JSON string if sent via FormData
        if (typeof expenseItems === 'string') {
            try {
                expenseItems = JSON.parse(expenseItems);
            } catch (e) {
                // Ignore parsing errors here, controller will handle it
            }
        }

        const amountToValidate = totalAmount || billAmount || (Array.isArray(expenseItems) ? expenseItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0) : 0);

        // Skip validation if no amount specified
        if (!amountToValidate) {
            return next();
        }

        // Get attachment settings
        const thresholdSetting = await Settings.findOne({ key: 'attachment_required_threshold' });
        const policySetting = await Settings.findOne({ key: 'attachment_policy' });

        const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 10000;
        const policy = policySetting ? policySetting.value : 'warn';

        const amount = parseFloat(amountToValidate);

        // Check if amount exceeds threshold
        if (amount > threshold) {
            const hasAttachments = attachments && Array.isArray(attachments) && attachments.length > 0;

            if (!hasAttachments) {
                const message = `Expenditure amount ₹${amount.toLocaleString()} exceeds the threshold of ₹${threshold.toLocaleString()}. Attachments are required.`;

                if (policy === 'block') {
                    return res.status(400).json({
                        success: false,
                        message,
                        code: 'ATTACHMENTS_REQUIRED',
                        threshold,
                        amount
                    });
                } else if (policy === 'warn') {
                    // Add warning to request for logging purposes
                    req.attachmentWarning = message;
                }
            }
        }

        next();
    } catch (error) {
        console.error('Attachment validation error:', error);
        // Don't block the request on validation errors, just log and continue
        next();
    }
};

/**
 * Middleware to validate attachments during approval
 * Re-validates that required attachments are present before approval
 */
const validateAttachmentsForApproval = async (req, res, next) => {
    try {
        const expenditureId = req.params.id;
        const Expenditure = require('../models/Expenditure');

        const expenditure = await Expenditure.findById(expenditureId);
        if (!expenditure) {
            return next(); // Let the controller handle not found
        }

        // Get attachment settings
        const thresholdSetting = await Settings.findOne({ key: 'attachment_required_threshold' });
        const policySetting = await Settings.findOne({ key: 'attachment_policy' });

        const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 10000;
        const policy = policySetting ? policySetting.value : 'warn';

        const amount = expenditure.totalAmount || expenditure.billAmount;

        // Check if amount exceeds threshold
        if (amount > threshold) {
            const hasAttachments = expenditure.attachments && expenditure.attachments.length > 0;

            if (!hasAttachments) {
                const message = `Cannot approve expenditure of ₹${amount.toLocaleString()} without required attachments (threshold: ₹${threshold.toLocaleString()}).`;

                if (policy === 'block') {
                    return res.status(400).json({
                        success: false,
                        message,
                        code: 'ATTACHMENTS_REQUIRED_FOR_APPROVAL',
                        threshold,
                        amount
                    });
                } else if (policy === 'warn') {
                    // Add warning to request
                    req.attachmentWarning = message;
                }
            }
        }

        next();
    } catch (error) {
        console.error('Attachment approval validation error:', error);
        // Don't block the request on validation errors
        next();
    }
};

module.exports = {
    validateAttachments,
    validateAttachmentsForApproval
};
