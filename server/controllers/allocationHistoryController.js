const AllocationHistory = require('../models/AllocationHistory');
const { recordAuditLog } = require('../utils/auditService');
const Allocation = require('../models/Allocation');

/**
 * @desc    Get allocation history
 * @route   GET /api/allocations/:id/history
 * @access  Private/Office
 */
const getAllocationHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const history = await AllocationHistory.find({ allocationId: id })
            .populate('changedBy', 'name email role')
            .populate('snapshot.department', 'name code')
            .populate('snapshot.budgetHead', 'name code')
            .sort({ version: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await AllocationHistory.countDocuments({ allocationId: id });

        res.json({
            success: true,
            data: {
                history,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            }
        });
    } catch (error) {
        console.error('Get allocation history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching allocation history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get specific allocation version
 * @route   GET /api/allocations/:id/history/:version
 * @access  Private/Office
 */
const getAllocationVersion = async (req, res) => {
    try {
        const { id, version } = req.params;

        const historyRecord = await AllocationHistory.findOne({
            allocationId: id,
            version: parseInt(version)
        })
            .populate('changedBy', 'name email role')
            .populate('snapshot.department', 'name code')
            .populate('snapshot.budgetHead', 'name code');

        if (!historyRecord) {
            return res.status(404).json({
                success: false,
                message: 'Version not found'
            });
        }

        res.json({
            success: true,
            data: { version: historyRecord }
        });
    } catch (error) {
        console.error('Get allocation version error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching allocation version',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Rollback allocation to specific version
 * @route   POST /api/allocations/:id/rollback/:version
 * @access  Private/Admin
 */
const rollbackAllocation = async (req, res) => {
    const session = await Allocation.startSession();
    session.startTransaction();

    try {
        const { id, version } = req.params;
        const { reason } = req.body;

        // Get the version to rollback to
        const targetVersion = await AllocationHistory.findOne({
            allocationId: id,
            version: parseInt(version)
        }).session(session);

        if (!targetVersion) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Version not found'
            });
        }

        // Get current allocation
        const allocation = await Allocation.findById(id).session(session);
        if (!allocation) {
            await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: 'Allocation not found'
            });
        }

        // Check if rollback amount is valid
        if (targetVersion.snapshot.allocatedAmount < allocation.spentAmount) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: 'Cannot rollback to amount less than already spent'
            });
        }

        // Store current state
        const previousValues = {
            allocatedAmount: allocation.allocatedAmount,
            remarks: allocation.remarks
        };

        // Get next version number
        const latestHistory = await AllocationHistory.findOne({ allocationId: id })
            .sort({ version: -1 })
            .session(session);
        const newVersion = latestHistory ? latestHistory.version + 1 : 1;

        // Create history record for rollback
        await AllocationHistory.create([{
            allocationId: id,
            version: newVersion,
            changeType: 'rollback',
            snapshot: targetVersion.snapshot,
            changes: {
                allocatedAmount: {
                    old: allocation.allocatedAmount,
                    new: targetVersion.snapshot.allocatedAmount
                },
                remarks: {
                    old: allocation.remarks,
                    new: targetVersion.snapshot.remarks
                }
            },
            changeReason: reason || `Rolled back to version ${version}`,
            changedBy: req.user._id
        }], { session });

        // Update allocation
        const updatedAllocation = await Allocation.findByIdAndUpdate(
            id,
            {
                allocatedAmount: targetVersion.snapshot.allocatedAmount,
                remarks: targetVersion.snapshot.remarks,
                lastModifiedBy: req.user._id
            },
            { new: true, session }
        )
            .populate('department', 'name code')
            .populate('budgetHead', 'name category')
            .populate('createdBy', 'name email')
            .populate('lastModifiedBy', 'name email');

        // Log the rollback
        await recordAuditLog({
            eventType: 'allocation_rollback',
            req,
            targetEntity: 'Allocation',
            targetId: id,
            details: {
                rolledBackToVersion: parseInt(version),
                newVersion,
                reason
            },
            previousValues,
            newValues: updatedAllocation
        });

        await session.commitTransaction();

        res.json({
            success: true,
            message: `Allocation rolled back to version ${version}`,
            data: {
                allocation: updatedAllocation,
                version: newVersion
            }
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Rollback allocation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while rolling back allocation',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
};

module.exports = {
    getAllocationHistory,
    getAllocationVersion,
    rollbackAllocation
};
