const FinancialYear = require('../models/FinancialYear');
const Income = require('../models/Income');
const Allocation = require('../models/Allocation');
const Expenditure = require('../models/Expenditure');
const { recordAuditLog } = require('../utils/auditService');

// @desc    Get all financial years
// @route   GET /api/financial-years
// @access  Private (All authenticated users)
const getFinancialYears = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const query = {};
        if (status) query.status = status;

        const financialYears = await FinancialYear.find(query)
            .populate('createdBy', 'name email')
            .populate('lockedBy', 'name email')
            .populate('closedBy', 'name email')
            .sort({ year: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await FinancialYear.countDocuments(query);

        res.json({
            success: true,
            data: {
                financialYears,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get financial years error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching financial years',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get financial year by ID
// @route   GET /api/financial-years/:id
// @access  Private
const getFinancialYearById = async (req, res) => {
    try {
        const fy = await FinancialYear.findById(req.params.id)
            .populate('createdBy', 'name email')
            .populate('lockedBy', 'name email')
            .populate('closedBy', 'name email');

        if (!fy) {
            return res.status(404).json({
                success: false,
                message: 'Financial year not found'
            });
        }

        // Get detailed statistics
        const incomeStats = await Income.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: '$status',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const allocationStats = await Allocation.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: null,
                    totalAllocated: { $sum: '$allocatedAmount' },
                    totalSpent: { $sum: '$spentAmount' }
                }
            }
        ]);

        const stats = {
            income: {
                expected: incomeStats.find(s => s._id === 'expected')?.total || 0,
                received: incomeStats.find(s => ['received', 'verified'].includes(s._id))?.total || 0,
                verified: incomeStats.find(s => s._id === 'verified')?.total || 0
            },
            allocations: allocationStats[0] || { totalAllocated: 0, totalSpent: 0 }
        };

        res.json({
            success: true,
            data: {
                financialYear: fy,
                statistics: stats
            }
        });
    } catch (error) {
        console.error('Get financial year by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching financial year',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Create new financial year
// @route   POST /api/financial-years
// @access  Private (Admin/Principal only)
const createFinancialYear = async (req, res) => {
    try {
        const {
            year,
            startDate,
            endDate,
            status,
            totalIncomeExpected,
            carryforwardAmount,
            carryforwardAllowed
        } = req.body;

        // Validate required fields
        if (!year || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Year, start date, and end date are required'
            });
        }

        // Check if year already exists
        const existingFY = await FinancialYear.findOne({ year });
        if (existingFY) {
            return res.status(400).json({
                success: false,
                message: `Financial year ${year} already exists`
            });
        }

        const fy = await FinancialYear.create({
            year,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            status: status || 'planning',
            totalIncomeExpected: totalIncomeExpected || 0,
            totalIncomeReceived: 0,
            totalAllocated: 0,
            totalSpent: 0,
            carryforwardAmount: carryforwardAmount || 0,
            carryforwardAllowed: carryforwardAllowed || false,
            createdBy: req.user._id
        });

        await recordAuditLog({
            eventType: 'financial_year_created',
            req,
            targetEntity: 'FinancialYear',
            targetId: fy._id,
            details: {
                year,
                status: fy.status,
                startDate,
                endDate
            },
            newValues: fy
        });

        const populatedFY = await FinancialYear.findById(fy._id)
            .populate('createdBy', 'name email');

        res.status(201).json({
            success: true,
            message: 'Financial year created successfully',
            data: { financialYear: populatedFY }
        });
    } catch (error) {
        console.error('Create financial year error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating financial year',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Update financial year summary totals
// @route   PUT /api/financial-years/:id/recalculate
// @access  Private (Admin/Principal only)
const recalculateTotals = async (req, res) => {
    try {
        const fy = await FinancialYear.findById(req.params.id);
        if (!fy) {
            return res.status(404).json({
                success: false,
                message: 'Financial year not found'
            });
        }

        // Recalculate income totals
        const incomeStats = await Income.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: null,
                    totalExpected: {
                        $sum: { $cond: [{ $in: ['$status', ['expected', 'received', 'verified']] }, '$amount', 0] }
                    },
                    totalReceived: {
                        $sum: { $cond: [{ $in: ['$status', ['received', 'verified']] }, '$amount', 0] }
                    }
                }
            }
        ]);

        // Recalculate allocation totals
        const allocationStats = await Allocation.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: null,
                    totalAllocated: { $sum: '$allocatedAmount' },
                    totalSpent: { $sum: '$spentAmount' }
                }
            }
        ]);

        fy.totalIncomeExpected = incomeStats[0]?.totalExpected || 0;
        fy.totalIncomeReceived = incomeStats[0]?.totalReceived || 0;
        fy.totalAllocated = allocationStats[0]?.totalAllocated || 0;
        fy.totalSpent = allocationStats[0]?.totalSpent || 0;

        await fy.save();

        res.json({
            success: true,
            message: 'Totals recalculated successfully',
            data: { financialYear: fy }
        });
    } catch (error) {
        console.error('Recalculate totals error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while recalculating totals',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Lock financial year (prevent new allocations)
// @route   PUT /api/financial-years/:id/lock
// @access  Private (Principal/Admin only)
const lockFinancialYear = async (req, res) => {
    try {
        const { remarks } = req.body;

        const fy = await FinancialYear.findById(req.params.id);
        if (!fy) {
            return res.status(404).json({
                success: false,
                message: 'Financial year not found'
            });
        }

        if (fy.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Cannot lock a closed financial year'
            });
        }

        if (fy.status === 'locked') {
            return res.status(400).json({
                success: false,
                message: 'Financial year is already locked'
            });
        }

        const previousStatus = fy.status;
        fy.status = 'locked';
        fy.lockedBy = req.user._id;
        fy.lockedAt = new Date();
        fy.lockRemarks = remarks || '';

        await fy.save();

        await recordAuditLog({
            eventType: 'financial_year_locked',
            req,
            targetEntity: 'FinancialYear',
            targetId: fy._id,
            details: {
                year: fy.year,
                previousStatus,
                remarks
            },
            previousValues: { status: previousStatus },
            newValues: { status: 'locked' }
        });

        const populatedFY = await FinancialYear.findById(fy._id)
            .populate('lockedBy', 'name email');

        res.json({
            success: true,
            message: 'Financial year locked successfully. No new allocations can be created.',
            data: { financialYear: populatedFY }
        });
    } catch (error) {
        console.error('Lock financial year error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while locking financial year',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Close financial year (make completely immutable)
// @route   PUT /api/financial-years/:id/close
// @access  Private (Principal/Admin only)
const closeFinancialYear = async (req, res) => {
    try {
        const { remarks } = req.body;

        const fy = await FinancialYear.findById(req.params.id);
        if (!fy) {
            return res.status(404).json({
                success: false,
                message: 'Financial year not found'
            });
        }

        if (fy.status === 'closed') {
            return res.status(400).json({
                success: false,
                message: 'Financial year is already closed'
            });
        }

        // Check for pending expenditures
        const pendingExpenditures = await Expenditure.countDocuments({
            financialYear: fy.year,
            status: { $in: ['pending', 'verified'] }
        });

        if (pendingExpenditures > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot close financial year. There are ${pendingExpenditures} pending expenditures that need to be approved or rejected.`
            });
        }

        // Recalculate final totals before closing
        const incomeStats = await Income.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: null,
                    totalReceived: {
                        $sum: { $cond: [{ $in: ['$status', ['received', 'verified']] }, '$amount', 0] }
                    }
                }
            }
        ]);

        const allocationStats = await Allocation.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: null,
                    totalAllocated: { $sum: '$allocatedAmount' },
                    totalSpent: { $sum: '$spentAmount' }
                }
            }
        ]);

        fy.totalIncomeReceived = incomeStats[0]?.totalReceived || 0;
        fy.totalAllocated = allocationStats[0]?.totalAllocated || 0;
        fy.totalSpent = allocationStats[0]?.totalSpent || 0;
        fy.carryforwardAmount = fy.totalIncomeReceived - fy.totalSpent;

        const previousStatus = fy.status;
        fy.status = 'closed';
        fy.closedBy = req.user._id;
        fy.closedAt = new Date();
        fy.closureRemarks = remarks || '';

        await fy.save();

        await recordAuditLog({
            eventType: 'financial_year_closed',
            req,
            targetEntity: 'FinancialYear',
            targetId: fy._id,
            details: {
                year: fy.year,
                previousStatus,
                finalTotals: {
                    income: fy.totalIncomeReceived,
                    allocated: fy.totalAllocated,
                    spent: fy.totalSpent,
                    carryforward: fy.carryforwardAmount
                },
                remarks
            },
            previousValues: { status: previousStatus },
            newValues: { status: 'closed' }
        });

        const populatedFY = await FinancialYear.findById(fy._id)
            .populate('closedBy', 'name email');

        res.json({
            success: true,
            message: 'Financial year closed successfully. All data is now immutable.',
            data: { financialYear: populatedFY }
        });
    } catch (error) {
        console.error('Close financial year error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while closing financial year',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get active financial year
// @route   GET /api/financial-years/active
// @access  Private
const getActiveFinancialYear = async (req, res) => {
    try {
        const fy = await FinancialYear.findOne({ status: 'active' })
            .populate('createdBy', 'name email');

        if (!fy) {
            return res.status(404).json({
                success: false,
                message: 'No active financial year found'
            });
        }

        res.json({
            success: true,
            data: { financialYear: fy }
        });
    } catch (error) {
        console.error('Get active financial year error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching active financial year',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Get financial year summary
// @route   GET /api/financial-years/:id/summary
// @access  Private
const getYearSummary = async (req, res) => {
    try {
        const fy = await FinancialYear.findById(req.params.id);
        if (!fy) {
            return res.status(404).json({
                success: false,
                message: 'Financial year not found'
            });
        }

        // Income breakdown by source
        const incomeBySource = await Income.aggregate([
            { $match: { financialYear: fy.year, status: { $in: ['received', 'verified'] } } },
            {
                $group: {
                    _id: '$source',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { total: -1 } }
        ]);

        // Allocation breakdown by department
        const allocationByDept = await Allocation.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $lookup: {
                    from: 'departments',
                    localField: 'department',
                    foreignField: '_id',
                    as: 'department'
                }
            },
            { $unwind: '$department' },
            {
                $group: {
                    _id: '$department._id',
                    departmentName: { $first: '$department.name' },
                    totalAllocated: { $sum: '$allocatedAmount' },
                    totalSpent: { $sum: '$spentAmount' }
                }
            },
            { $sort: { totalAllocated: -1 } }
        ]);

        // Expenditure breakdown by status
        const expenditureByStatus = await Expenditure.aggregate([
            { $match: { financialYear: fy.year } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$totalAmount' }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                financialYear: fy,
                summary: {
                    income: {
                        total: fy.totalIncomeReceived,
                        bySource: incomeBySource
                    },
                    allocations: {
                        total: fy.totalAllocated,
                        spent: fy.totalSpent,
                        remaining: fy.totalAllocated - fy.totalSpent,
                        utilizationPercent: fy.utilizationPercentage,
                        byDepartment: allocationByDept
                    },
                    expenditures: {
                        byStatus: expenditureByStatus
                    }
                }
            }
        });
    } catch (error) {
        console.error('Get year summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching year summary',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    getFinancialYears,
    getFinancialYearById,
    createFinancialYear,
    recalculateTotals,
    lockFinancialYear,
    closeFinancialYear,
    getActiveFinancialYear,
    getYearSummary
};
