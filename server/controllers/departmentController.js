const Department = require('../models/Department');
const User = require('../models/User');
const { recordAuditLog } = require('../utils/auditService');

// @desc    Get all departments
// @route   GET /api/departments
// @access  Private/Admin
const getDepartments = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, isActive } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const departments = await Department.find(query)
      .populate('hod', 'name email')
      .sort({ name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Department.countDocuments(query);

    res.json({
      success: true,
      data: {
        departments,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching departments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get department by ID
// @route   GET /api/departments/:id
// @access  Private/Admin
const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('hod', 'name email role');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    res.json({
      success: true,
      data: { department }
    });
  } catch (error) {
    console.error('Get department by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new department
// @route   POST /api/departments
// @access  Private/Admin
const createDepartment = async (req, res) => {
  try {
    let { name, code, description, hod } = req.body;
    if (!hod) hod = undefined;

    // Check if department with same name or code already exists
    const existingDept = await Department.findOne({
      $or: [{ name }, { code }]
    });

    if (existingDept) {
      return res.status(400).json({
        success: false,
        message: 'Department with this name or code already exists'
      });
    }

    // Validate HOD if provided
    if (hod) {
      const hodUser = await User.findById(hod);
      if (!hodUser || hodUser.role !== 'hod') {
        return res.status(400).json({
          success: false,
          message: 'Invalid HOD user'
        });
      }
    }

    const department = await Department.create({
      name,
      code,
      description,
      hod
    });

    // Log the creation
    await recordAuditLog({
      eventType: 'department_created',
      req,
      targetEntity: 'Department',
      targetId: department._id,
      details: { name, code },
      newValues: department
    });

    const populatedDepartment = await Department.findById(department._id)
      .populate('hod', 'name email');

    res.status(201).json({
      success: true,
      message: 'Department created successfully',
      data: { department: populatedDepartment }
    });
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update department
// @route   PUT /api/departments/:id
// @access  Private/Admin
const updateDepartment = async (req, res) => {
  try {
    const { name, code, description, hod, isActive } = req.body;
    const departmentId = req.params.id;

    // Check if department exists
    const existingDept = await Department.findById(departmentId);
    if (!existingDept) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Check if name or code is already taken by another department
    if (name || code) {
      const duplicateDept = await Department.findOne({
        $or: [
          ...(name ? [{ name }] : []),
          ...(code ? [{ code }] : [])
        ],
        _id: { $ne: departmentId }
      });

      if (duplicateDept) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name or code already exists'
        });
      }
    }

    // Validate HOD if provided
    if (hod) {
      const hodUser = await User.findById(hod);
      if (!hodUser || hodUser.role !== 'hod') {
        return res.status(400).json({
          success: false,
          message: 'Invalid HOD user'
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code;
    if (description !== undefined) updateData.description = description;
    if (hod !== undefined) updateData.hod = hod || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const previousValues = existingDept.toObject();

    const department = await Department.findByIdAndUpdate(
      departmentId,
      updateData,
      { new: true, runValidators: true }
    ).populate('hod', 'name email');

    // Log the update
    await recordAuditLog({
      eventType: 'department_updated',
      req,
      targetEntity: 'Department',
      targetId: departmentId,
      details: { updatedFields: Object.keys(updateData) },
      previousValues,
      newValues: department
    });

    res.json({
      success: true,
      message: 'Department updated successfully',
      data: { department }
    });
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete department
// @route   DELETE /api/departments/:id
// @access  Private/Admin
const deleteDepartment = async (req, res) => {
  try {
    const departmentId = req.params.id;

    // Check if department has users
    const usersInDept = await User.countDocuments({ department: departmentId });
    if (usersInDept > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete department with existing users'
      });
    }

    const department = await Department.findByIdAndDelete(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Log the deletion
    await recordAuditLog({
      eventType: 'department_deleted',
      req,
      targetEntity: 'Department',
      targetId: departmentId,
      details: { name: department.name, code: department.code },
      previousValues: department
    });

    res.json({
      success: true,
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting department',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get department statistics
// @route   GET /api/departments/stats
// @access  Private/Admin
const getDepartmentStats = async (req, res) => {
  try {
    const totalDepartments = await Department.countDocuments();
    const activeDepartments = await Department.countDocuments({ isActive: true });
    // Count departments that have an HOD assigned (not null)
    const departmentsWithHOD = await Department.countDocuments({ hod: { $ne: null } });
    const departmentsWithoutHOD = totalDepartments - departmentsWithHOD;

    const userStats = await User.aggregate([
      {
        $match: { department: { $exists: true } }
      },
      {
        $group: {
          _id: '$department',
          userCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department'
        }
      },
      {
        $unwind: '$department'
      },
      {
        $project: {
          departmentName: '$department.name',
          userCount: 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        totalDepartments,
        activeDepartments,
        inactiveDepartments: totalDepartments - activeDepartments,
        departmentsWithHOD,
        departmentsWithoutHOD,
        userDistribution: userStats
      }
    });
  } catch (error) {
    console.error('Get department stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching department statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


// @desc    Get comprehensive department detail with allocations and expenditures
// @route   GET /api/departments/:id/detail
// @access  Private (Department users can view their own, others need office/admin/management roles)
const getDepartmentDetail = async (req, res) => {
  try {
    const departmentId = req.params.id;
    const { financialYear = getCurrentFinancialYear() } = req.query;

    // Check authorization: user must be from this department or have elevated privileges
    const allowedRoles = ['admin', 'office', 'vice_principal', 'principal', 'hod'];
    const isAuthorized = allowedRoles.includes(req.user.role) ||
      (req.user.role === 'department' && req.user.department.toString() === departmentId);

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this department detail'
      });
    }

    // Get department info
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found'
      });
    }

    // Get allocations for this department
    const Allocation = require('../models/Allocation');
    const allocations = await Allocation.find({
      department: departmentId,
      financialYear
    })
      .populate('budgetHead', 'name category code')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    // Get expenditures for this department
    const Expenditure = require('../models/Expenditure');
    const expenditures = await Expenditure.find({
      department: departmentId,
      financialYear
    })
      .populate('budgetHead', 'name category code')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    const totalSpent = allocations.reduce((sum, alloc) => sum + alloc.spentAmount, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const utilizationPercentage = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    // Expenditure status breakdown
    const statusBreakdown = {
      pending: expenditures.filter(e => e.status === 'pending').length,
      verified: expenditures.filter(e => e.status === 'verified').length,
      approved: expenditures.filter(e => e.status === 'approved').length,
      rejected: expenditures.filter(e => e.status === 'rejected').length
    };

    // Budget head-wise breakdown
    const budgetHeadBreakdown = {};
    allocations.forEach(alloc => {
      const headName = alloc.budgetHead.name;
      if (!budgetHeadBreakdown[headName]) {
        budgetHeadBreakdown[headName] = {
          budgetHeadId: alloc.budgetHead._id,
          budgetHeadCode: alloc.budgetHead.code,
          allocated: 0,
          spent: 0,
          remaining: 0,
          utilization: 0
        };
      }
      budgetHeadBreakdown[headName].allocated += alloc.allocatedAmount;
      budgetHeadBreakdown[headName].spent += alloc.spentAmount;
      budgetHeadBreakdown[headName].remaining += alloc.remainingAmount;
    });

    // Calculate utilization for each budget head
    Object.keys(budgetHeadBreakdown).forEach(head => {
      const data = budgetHeadBreakdown[head];
      data.utilization = data.allocated > 0 ? (data.spent / data.allocated) * 100 : 0;
    });

    // Year comparison (if requesting current year, compare with previous)
    let yearComparison = null;
    if (financialYear) {
      const previousFY = getPreviousFinancialYear(financialYear);

      // Get previous year allocations
      const prevAllocations = await Allocation.find({
        department: departmentId,
        financialYear: previousFY
      });

      // Get previous year expenditures
      const prevExpenditures = await Expenditure.find({
        department: departmentId,
        financialYear: previousFY
      });

      const prevTotalAllocated = prevAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
      const prevTotalSpent = prevAllocations.reduce((sum, alloc) => sum + alloc.spentAmount, 0);
      const prevUtilization = prevTotalAllocated > 0 ? (prevTotalSpent / prevTotalAllocated) * 100 : 0;

      // Calculate changes
      const allocatedChange = prevTotalAllocated > 0
        ? ((totalAllocated - prevTotalAllocated) / prevTotalAllocated) * 100
        : 0;
      const spentChange = prevTotalSpent > 0
        ? ((totalSpent - prevTotalSpent) / prevTotalSpent) * 100
        : 0;
      const utilizationChange = utilizationPercentage - prevUtilization;

      yearComparison = {
        previousYear: previousFY,
        currentYear: financialYear,
        previous: {
          totalAllocated: prevTotalAllocated,
          totalSpent: prevTotalSpent,
          utilization: prevUtilization,
          expenditureCount: prevExpenditures.length
        },
        current: {
          totalAllocated,
          totalSpent,
          utilization: utilizationPercentage,
          expenditureCount: expenditures.length
        },
        changes: {
          allocatedChange,
          spentChange,
          utilizationChange
        }
      };
    }

    res.json({
      success: true,
      data: {
        department: {
          _id: department._id,
          name: department.name,
          code: department.code,
          description: department.description
        },
        financialYear,
        summary: {
          totalAllocated,
          totalSpent,
          totalRemaining,
          utilizationPercentage,
          allocationCount: allocations.length,
          expenditureCount: expenditures.length
        },
        allocations,
        expenditures,
        statusBreakdown,
        budgetHeadBreakdown,
        yearComparison
      }
    });
  } catch (error) {
    console.error('Get department detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching department detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function
const getCurrentFinancialYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const getPreviousFinancialYear = (currentFY) => {
  const [startYear, endYear] = currentFY.split('-').map(Number);
  return `${startYear - 1}-${endYear - 1}`;
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,
  getDepartmentDetail
};
