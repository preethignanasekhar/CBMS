const Income = require('../models/Income');
const FinancialYear = require('../models/FinancialYear');
const { recordAuditLog } = require('../utils/auditService');

// @desc    Get all income records
// @route   GET /api/income
// @access  Private (All authenticated users can view)
const getIncomes = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            financialYear,
            source,
            category,
            status,
            search
        } = req.query;

        const query = {};

        if (financialYear) query.financialYear = financialYear;
        if (source) query.source = source;
        if (category) query.category = category;
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { referenceNumber: { $regex: search, $options: 'i' } },
                { remarks: { $regex: search, $options: 'i' } }
            ];
        }

        const incomes = await Income.find(query)
            .populate('createdBy', 'name email')
            .populate('verifiedBy', 'name email')
            .populate('lastModifiedBy', 'name email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Income.countDocuments(query);

        res.json({
            success: true,
            data: {
                incomes,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get incomes error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching incomes',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get income by ID
// @route   GET /api/income/:id
// @access  Private
const getIncomeById = async (req, res) => {
    try {
        const income = await Income.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('verifiedBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }

        res.json({
            success: true,
            data: { income }
        });
    } catch (error) {
        console.error('Get income by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching income',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Create new income record
// @route   POST /api/income
// @access  Private (Office/Admin only)
const createIncome = async (req, res) => {
    try {
        const {
            financialYear,
            source,
            category,
            amount,
            receivedDate,
            expectedDate,
            status,
            referenceNumber,
            description,
            remarks
        } = req.body;

        // Validate required fields
        if (!financialYear || !source || !category || !amount || !description) {
            return res.status(400).json({
                success: false,
                message: 'Financial year, source, category, amount, and description are required'
            });
        }

        // Validate financial year exists
        const fy = await FinancialYear.findOne({ year: financialYear });
        if (!fy) {
            return res.status(400).json({
                success: false,
                message: `Financial year ${financialYear} not found. Please create it first.`
            });
        }

        if (fy.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: `Cannot add income to closed financial year: ${financialYear}`
            });
        }

        const income = await Income.create({
            financialYear,
            source,
            category,
            amount: parseFloat(amount),
            receivedDate: receivedDate ? new Date(receivedDate) : null,
            expectedDate: expectedDate ? new Date(expectedDate) : null,
            status: status || 'expected',
            referenceNumber,
            description,
            remarks,
            createdBy: req.user._id
        });

        // Update FinancialYear totals
        if (status === 'expected') {
            await FinancialYear.findByIdAndUpdate(fy._id, {
                $inc: { totalIncomeExpected: parseFloat(amount) }
            });
        } else if (status === 'received') {
            await FinancialYear.findByIdAndUpdate(fy._id, {
                $inc: {
                    totalIncomeExpected: parseFloat(amount),
                    totalIncomeReceived: parseFloat(amount)
                }
            });
        }

        await recordAuditLog({
            eventType: 'income_created',
            req,
            targetEntity: 'Income',
            targetId: income._id,
            details: {
                financialYear,
                source,
                amount: parseFloat(amount),
                status
            },
            newValues: income
        });

        const populatedIncome = await Income.findById(income._id)
            .populate('createdBy', 'name email');

        res.status(201).json({
            success: true,
            message: 'Income record created successfully',
            data: { income: populatedIncome }
        });
    } catch (error) {
        console.error('Create income error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating income',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update income record
// @route   PUT /api/income/:id
// @access  Private (Office/Admin only)
const updateIncome = async (req, res) => {
    try {
        const { amount, status, receivedDate, expectedDate, remarks, referenceNumber, description } = req.body;
        const incomeId = req.params.id;

        const income = await Income.findById(incomeId);
        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }

        // Don't allow updates to verified income without special permission
        if (income.status === 'verified' && !['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Verified income can only be modified by Admin or Principal'
            });
        }

        const previousValues = { ...income.toObject() };
        const previousAmount = income.amount;
        const previousStatus = income.status;

        // Update fields
        if (amount !== undefined) income.amount = parseFloat(amount);
        if (status !== undefined) income.status = status;
        if (receivedDate !== undefined) income.receivedDate = receivedDate ? new Date(receivedDate) : null;
        if (expectedDate !== undefined) income.expectedDate = expectedDate ? new Date(expectedDate) : null;
        if (remarks !== undefined) income.remarks = remarks;
        if (referenceNumber !== undefined) income.referenceNumber = referenceNumber;
        if (description !== undefined) income.description = description;
        income.lastModifiedBy = req.user._id;

        await income.save();

        // Update FinancialYear totals if amount or status changed
        if (amount !== undefined || status !== undefined) {
            const fy = await FinancialYear.findOne({ year: income.financialYear });
            if (fy) {
                // Reverse previous impact
                if (previousStatus === 'expected') {
                    fy.totalIncomeExpected -= previousAmount;
                } else if (previousStatus === 'received') {
                    fy.totalIncomeExpected -= previousAmount;
                    fy.totalIncomeReceived -= previousAmount;
                }

                // Apply new impact
                if (income.status === 'expected') {
                    fy.totalIncomeExpected += income.amount;
                } else if (income.status === 'received' || income.status === 'verified') {
                    fy.totalIncomeExpected += income.amount;
                    fy.totalIncomeReceived += income.amount;
                }

                await fy.save();
            }
        }

        await recordAuditLog({
            eventType: 'income_updated',
            req,
            targetEntity: 'Income',
            targetId: incomeId,
            details: {
                updatedFields: Object.keys(req.body)
            },
            previousValues,
            newValues: income
        });

        const populatedIncome = await Income.findById(incomeId)
            .populate('createdBy', 'name email')
            .populate('verifiedBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        res.json({
            success: true,
            message: 'Income updated successfully',
            data: { income: populatedIncome }
        });
    } catch (error) {
        console.error('Update income error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating income',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Verify income record
// @route   PUT /api/income/:id/verify
// @access  Private (Principal/Admin only)
const verifyIncome = async (req, res) => {
    try {
        const { remarks } = req.body;
        const incomeId = req.params.id;

        const income = await Income.findById(incomeId);
        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }

        if (income.status !== 'received') {
            return res.status(400).json({
                success: false,
                message: 'Only received income can be verified'
            });
        }

        income.status = 'verified';
        income.verifiedBy = req.user._id;
        income.verifiedAt = new Date();
        if (remarks) income.remarks = remarks;

        await income.save();

        await recordAuditLog({
            eventType: 'income_verified',
            req,
            targetEntity: 'Income',
            targetId: incomeId,
            details: {
                amount: income.amount,
                source: income.source,
                remarks
            }
        });

        const populatedIncome = await Income.findById(incomeId)
            .populate('createdBy', 'name email')
            .populate('verifiedBy', 'name email');

        res.json({
            success: true,
            message: 'Income verified successfully',
            data: { income: populatedIncome }
        });
    } catch (error) {
        console.error('Verify income error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while verifying income',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Delete income record
// @route   DELETE /api/income/:id
// @access  Private (Admin only)
const deleteIncome = async (req, res) => {
    try {
        const incomeId = req.params.id;

        const income = await Income.findById(incomeId);
        if (!income) {
            return res.status(404).json({
                success: false,
                message: 'Income record not found'
            });
        }

        // Don't allow deletion of verified income
        if (income.status === 'verified') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete verified income. Contact system administrator.'
            });
        }

        // Update FinancialYear totals
        const fy = await FinancialYear.findOne({ year: income.financialYear });
        if (fy) {
            if (income.status === 'expected') {
                fy.totalIncomeExpected -= income.amount;
            } else if (income.status === 'received') {
                fy.totalIncomeExpected -= income.amount;
                fy.totalIncomeReceived -= income.amount;
            }
            await fy.save();
        }

        await income.deleteOne();

        await recordAuditLog({
            eventType: 'income_deleted',
            req,
            targetEntity: 'Income',
            targetId: incomeId,
            details: {
                financialYear: income.financialYear,
                amount: income.amount,
                source: income.source
            }
        });

        res.json({
            success: true,
            message: 'Income deleted successfully'
        });
    } catch (error) {
        console.error('Delete income error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting income',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get income statistics
// @route   GET /api/income/stats
// @access  Private
const getIncomeStats = async (req, res) => {
    try {
        const { financialYear } = req.query;

        const query = {};
        if (financialYear) query.financialYear = financialYear;

        const stats = await Income.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalExpected: {
                        $sum: { $cond: [{ $in: ['$status', ['expected', 'received', 'verified']] }, '$amount', 0] }
                    },
                    totalReceived: {
                        $sum: { $cond: [{ $in: ['$status', ['received', 'verified']] }, '$amount', 0] }
                    },
                    totalVerified: {
                        $sum: { $cond: [{ $eq: ['$status', 'verified'] }, '$amount', 0] }
                    },
                    totalRecords: { $sum: 1 }
                }
            }
        ]);

        // By source breakdown
        const bySource = await Income.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$source',
                    totalExpected: {
                        $sum: { $cond: [{ $in: ['$status', ['expected', 'received', 'verified']] }, '$amount', 0] }
                    },
                    totalReceived: {
                        $sum: { $cond: [{ $in: ['$status', ['received', 'verified']] }, '$amount', 0] }
                    }
                }
            },
            { $sort: { totalReceived: -1 } }
        ]);

        // By category breakdown
        const byCategory = await Income.aggregate([
            { $match: query },
            {
                $group: {
                    _id: '$category',
                    totalExpected: {
                        $sum: { $cond: [{ $in: ['$status', ['expected', 'received', 'verified']] }, '$amount', 0] }
                    },
                    totalReceived: {
                        $sum: { $cond: [{ $in: ['$status', ['received', 'verified']] }, '$amount', 0] }
                    }
                }
            }
        ]);

        const result = stats[0] || {
            totalExpected: 0,
            totalReceived: 0,
            totalVerified: 0,
            totalRecords: 0
        };

        result.pending = result.totalExpected - result.totalReceived;
        result.receptionRate = result.totalExpected > 0
            ? Math.round((result.totalReceived / result.totalExpected) * 100)
            : 0;

        //  Get available financial years
        const financialYears = await Income.distinct('financialYear');

        res.json({
            success: true,
            data: {
                summary: result,
                bySource,
                byCategory,
                financialYears: financialYears.sort().reverse()
            }
        });
    } catch (error) {
        console.error('Get income stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching income statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getIncomes,
    getIncomeById,
    createIncome,
    updateIncome,
    verifyIncome,
    deleteIncome,
    getIncomeStats
};
