const Allocation = require('../models/Allocation');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');
const BulkUploadLog = require('../models/BulkUploadLog');
const { recordAuditLog } = require('../utils/auditService');
const csv = require('csv-parser');
const { Readable } = require('stream');

/**
 * @desc    Download CSV template for bulk allocation upload
 * @route   GET /api/allocations/bulk-upload/template
 * @access  Private/Office
 */
const downloadTemplate = (req, res) => {
    const csvContent = `Department Code,Budget Head Code,Allocated Amount,Financial Year,Remarks
DEPT-001,BH-001,100000,2024-2025,Initial allocation
DEPT-002,BH-002,150000,2024-2025,Increased budget for infrastructure`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=allocation_upload_template.csv');
    res.send(csvContent);
};

/**
 * @desc    Upload bulk allocations via CSV
 * @route   POST /api/allocations/bulk-upload
 * @access  Private/Office
 */
const bulkUploadAllocations = async (req, res) => {
    const startTime = Date.now();

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No CSV file uploaded'
            });
        }

        const results = [];
        const errors = [];
        let rowNumber = 0;

        // Parse CSV from buffer
        const bufferStream = Readable.from(req.file.buffer.toString());

        // Collect all rows first
        const rows = await new Promise((resolve, reject) => {
            const data = [];
            bufferStream
                .pipe(csv())
                .on('data', (row) => data.push(row))
                .on('end', () => resolve(data))
                .on('error', (error) => reject(error));
        });

        // Create upload log
        const uploadLog = await BulkUploadLog.create({
            fileName: req.file.originalname,
            uploadType: 'allocation',
            uploadedBy: req.user._id,
            totalRows: rows.length,
            status: 'processing'
        });

        // Process each row
        for (const row of rows) {
            rowNumber++;

            try {
                // Validate required fields
                if (!row['Department Code'] || !row['Budget Head Code'] || !row['Allocated Amount'] || !row['Financial Year']) {
                    errors.push({
                        row: rowNumber,
                        error: 'Missing required fields',
                        data: row
                    });
                    continue;
                }

                // Find department by code
                const department = await Department.findOne({ code: row['Department Code'].trim() });
                if (!department) {
                    errors.push({
                        row: rowNumber,
                        error: `Department not found: ${row['Department Code']}`,
                        data: row
                    });
                    continue;
                }

                // Find budget head by code
                const budgetHead = await BudgetHead.findOne({ code: row['Budget Head Code'].trim() });
                if (!budgetHead) {
                    errors.push({
                        row: rowNumber,
                        error: `Budget head not found: ${row['Budget Head Code']}`,
                        data: row
                    });
                    continue;
                }

                // Validate amount
                const allocatedAmount = parseFloat(row['Allocated Amount']);
                if (isNaN(allocatedAmount) || allocatedAmount <= 0) {
                    errors.push({
                        row: rowNumber,
                        error: 'Invalid allocated amount',
                        data: row
                    });
                    continue;
                }

                // Check for duplicate allocation
                const existingAllocation = await Allocation.findOne({
                    department: department._id,
                    budgetHead: budgetHead._id,
                    financialYear: row['Financial Year'].trim()
                });

                if (existingAllocation) {
                    errors.push({
                        row: rowNumber,
                        error: 'Allocation already exists for this department, budget head, and financial year',
                        data: row
                    });
                    continue;
                }

                // Create allocation
                const allocation = await Allocation.create({
                    department: department._id,
                    budgetHead: budgetHead._id,
                    allocatedAmount,
                    financialYear: row['Financial Year'].trim(),
                    remarks: row['Remarks'] || '',
                    createdBy: req.user._id
                });

                results.push({
                    row: rowNumber,
                    allocation: allocation._id,
                    department: department.name,
                    budgetHead: budgetHead.name,
                    amount: allocatedAmount
                });

                // Log individual allocation creation
                await recordAuditLog({
                    eventType: 'allocation_created_bulk',
                    req,
                    targetEntity: 'Allocation',
                    targetId: allocation._id,
                    details: {
                        bulkUploadId: uploadLog._id,
                        rowNumber,
                        department: department.name,
                        budgetHead: budgetHead.name,
                        amount: allocatedAmount
                    }
                });

            } catch (error) {
                errors.push({
                    row: rowNumber,
                    error: error.message,
                    data: row
                });
            }
        }

        // Update upload log
        const processingTime = Date.now() - startTime;
        uploadLog.successCount = results.length;
        uploadLog.failureCount = errors.length;
        uploadLog.errors = errors;
        uploadLog.status = errors.length === rows.length ? 'failed' : 'completed';
        uploadLog.processingTime = processingTime;
        await uploadLog.save();

        res.status(201).json({
            success: true,
            message: `Bulk upload completed. ${results.length} allocations created, ${errors.length} errors.`,
            data: {
                uploadId: uploadLog._id,
                totalRows: rows.length,
                successCount: results.length,
                failureCount: errors.length,
                processingTime,
                results: results.slice(0, 10), // Return first 10 successes
                errors: errors.slice(0, 10) // Return first 10 errors
            }
        });

    } catch (error) {
        console.error('Bulk upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during bulk upload',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get bulk upload history
 * @route   GET /api/allocations/bulk-upload/history
 * @access  Private/Office
 */
const getUploadHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10, uploadType = 'allocation' } = req.query;

        const query = { uploadType };

        const uploads = await BulkUploadLog.find(query)
            .populate('uploadedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await BulkUploadLog.countDocuments(query);

        res.json({
            success: true,
            data: {
                uploads,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get upload history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching upload history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get upload details by ID
 * @route   GET /api/allocations/bulk-upload/:id
 * @access  Private/Office
 */
const getUploadById = async (req, res) => {
    try {
        const upload = await BulkUploadLog.findById(req.params.id)
            .populate('uploadedBy', 'name email');

        if (!upload) {
            return res.status(404).json({
                success: false,
                message: 'Upload not found'
            });
        }

        res.json({
            success: true,
            data: { upload }
        });
    } catch (error) {
        console.error('Get upload by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching upload details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    downloadTemplate,
    bulkUploadAllocations,
    getUploadHistory,
    getUploadById
};
