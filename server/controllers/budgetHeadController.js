const BudgetHead = require('../models/BudgetHead');
const { recordAuditLog } = require('../utils/auditService');

// @desc    Get all budget heads
// @route   GET /api/budget-heads
// @access  Private/Admin
const getBudgetHeads = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, category, isActive, department } = req.query;
    const conditions = [];

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      });
    }
    if (category) conditions.push({ category: category });
    if (isActive !== undefined) conditions.push({ isActive: isActive === 'true' });

    // Filter by department: show global budget heads (department=null) or department-specific ones
    if (department) {
      conditions.push({
        $or: [
          { department: null },
          { department: department }
        ]
      });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const budgetHeads = await BudgetHead.find(query)
      .populate('createdBy', 'name email')
      .populate('department', 'name code')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await BudgetHead.countDocuments(query);

    res.json({
      success: true,
      data: {
        budgetHeads,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get budget heads error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching budget heads',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get budget head by ID
// @route   GET /api/budget-heads/:id
// @access  Private/Admin
const getBudgetHeadById = async (req, res) => {
  try {
    const budgetHead = await BudgetHead.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!budgetHead) {
      return res.status(404).json({
        success: false,
        message: 'Budget head not found'
      });
    }

    res.json({
      success: true,
      data: { budgetHead }
    });
  } catch (error) {
    console.error('Get budget head by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching budget head',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new budget head
// @route   POST /api/budget-heads
// @access  Private/Admin
const createBudgetHead = async (req, res) => {
  try {
    const { name, code, description, category } = req.body;

    // Check if budget head with same name or code already exists
    const existingBudgetHead = await BudgetHead.findOne({ $or: [{ name }, { code }] });
    if (existingBudgetHead) {
      const field = existingBudgetHead.name === name ? 'name' : 'code';
      return res.status(400).json({
        success: false,
        message: `Budget head with this ${field} already exists`
      });
    }

    const budgetHead = await BudgetHead.create({
      name,
      code,
      description,
      category,
      createdBy: req.user._id
    });

    // Log the creation
    await recordAuditLog({
      eventType: 'budget_head_created',
      req,
      targetEntity: 'BudgetHead',
      targetId: budgetHead._id,
      details: { name, code, category },
      newValues: budgetHead
    });

    const populatedBudgetHead = await BudgetHead.findById(budgetHead._id)
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Budget head created successfully',
      data: { budgetHead: populatedBudgetHead }
    });
  } catch (error) {
    console.error('Create budget head error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating budget head',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update budget head
// @route   PUT /api/budget-heads/:id
// @access  Private/Admin
const updateBudgetHead = async (req, res) => {
  try {
    const { name, description, category, isActive } = req.body;
    const budgetHeadId = req.params.id;

    // Check if budget head exists
    const existingBudgetHead = await BudgetHead.findById(budgetHeadId);
    if (!existingBudgetHead) {
      return res.status(404).json({
        success: false,
        message: 'Budget head not found'
      });
    }

    // Check if name is already taken by another budget head
    if (name && name !== existingBudgetHead.name) {
      const duplicateBudgetHead = await BudgetHead.findOne({
        name,
        _id: { $ne: budgetHeadId }
      });

      if (duplicateBudgetHead) {
        return res.status(400).json({
          success: false,
          message: 'Budget head with this name already exists'
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (req.body.code) updateData.code = req.body.code;
    if (description !== undefined) updateData.description = description;
    if (category) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const previousValues = existingBudgetHead.toObject();

    const budgetHead = await BudgetHead.findByIdAndUpdate(
      budgetHeadId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    // Log the update
    await recordAuditLog({
      eventType: 'budget_head_updated',
      req,
      targetEntity: 'BudgetHead',
      targetId: budgetHeadId,
      details: { updatedFields: Object.keys(updateData) },
      previousValues,
      newValues: budgetHead
    });

    res.json({
      success: true,
      message: 'Budget head updated successfully',
      data: { budgetHead }
    });
  } catch (error) {
    console.error('Update budget head error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating budget head',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete budget head
// @route   DELETE /api/budget-heads/:id
// @access  Private/Admin
const deleteBudgetHead = async (req, res) => {
  try {
    const budgetHeadId = req.params.id;

    // Check if budget head has allocations
    const Allocation = require('../models/Allocation');
    const allocationsCount = await Allocation.countDocuments({ budgetHead: budgetHeadId });
    if (allocationsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete budget head with existing allocations'
      });
    }

    const budgetHead = await BudgetHead.findByIdAndDelete(budgetHeadId);
    if (!budgetHead) {
      return res.status(404).json({
        success: false,
        message: 'Budget head not found'
      });
    }

    // Log the deletion
    await recordAuditLog({
      eventType: 'budget_head_deleted',
      req,
      targetEntity: 'BudgetHead',
      targetId: budgetHeadId,
      details: { name: budgetHead.name, code: budgetHead.code },
      previousValues: budgetHead
    });

    res.json({
      success: true,
      message: 'Budget head deleted successfully'
    });
  } catch (error) {
    console.error('Delete budget head error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting budget head',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get budget head statistics
// @route   GET /api/budget-heads/stats
// @access  Private/Admin
const getBudgetHeadStats = async (req, res) => {
  try {
    const totalBudgetHeads = await BudgetHead.countDocuments();
    const activeBudgetHeads = await BudgetHead.countDocuments({ isActive: true });

    const categoryStats = await BudgetHead.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalBudgetHeads,
        activeBudgetHeads,
        inactiveBudgetHeads: totalBudgetHeads - activeBudgetHeads,
        byCategory: categoryStats
      }
    });
  } catch (error) {
    console.error('Get budget head stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching budget head statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getBudgetHeads,
  getBudgetHeadById,
  createBudgetHead,
  updateBudgetHead,
  deleteBudgetHead,
  getBudgetHeadStats
};
