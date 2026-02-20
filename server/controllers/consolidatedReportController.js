const Allocation = require('../models/Allocation');
const Expenditure = require('../models/Expenditure');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');

// @desc    Get consolidated budget report (with YoY comparison)
// @route   GET /api/reports/consolidated-budget
// @access  Private
const getConsolidatedBudgetReport = async (req, res) => {
  try {
    const { financialYear, previousYear, department } = req.query;

    if (!financialYear) {
      return res.status(400).json({
        success: false,
        message: 'Financial year is required'
      });
    }

    // Query filters
    const currentYearQuery = { financialYear };
    const previousYearQuery = { financialYear: previousYear };

    if (department) {
      currentYearQuery.department = department;
      previousYearQuery.department = department;
    }

    // Fetch allocations for both years
    const [currentAllocations, previousAllocations] = await Promise.all([
      Allocation.find(currentYearQuery)
        .populate('department', 'name code')
        .populate('budgetHead', 'name category budgetType'),
      previousYear ? Allocation.find(previousYearQuery)
        .populate('department', 'name code')
        .populate('budgetHead', 'name category budgetType') : Promise.resolve([])
    ]);

    // Build consolidated report
    const reportData = {};

    // Process current year data
    currentAllocations.forEach(allocation => {
      const deptName = allocation.department.name;
      const headName = allocation.budgetHead.name;

      if (!reportData[deptName]) {
        reportData[deptName] = {
          departmentId: allocation.department._id,
          code: allocation.department.code,
          budgetHeads: {}
        };
      }

      reportData[deptName].budgetHeads[headName] = {
        budgetHeadId: allocation.budgetHead._id,
        category: allocation.budgetHead.category,
        budgetType: allocation.budgetHead.budgetType,
        currentYear: {
          allocatedAmount: allocation.allocatedAmount,
          spentAmount: allocation.spentAmount,
          remainingAmount: allocation.allocatedAmount - allocation.spentAmount,
          utilizationPercentage: allocation.allocatedAmount > 0
            ? Math.round((allocation.spentAmount / allocation.allocatedAmount) * 100)
            : 0
        },
        previousYear: {
          allocatedAmount: 0,
          spentAmount: 0,
          remainingAmount: 0,
          utilizationPercentage: 0
        }
      };
    });

    // Process previous year data
    previousAllocations.forEach(allocation => {
      const deptName = allocation.department.name;
      const headName = allocation.budgetHead.name;

      if (reportData[deptName] && reportData[deptName].budgetHeads[headName]) {
        reportData[deptName].budgetHeads[headName].previousYear = {
          allocatedAmount: allocation.allocatedAmount,
          spentAmount: allocation.spentAmount,
          remainingAmount: allocation.allocatedAmount - allocation.spentAmount,
          utilizationPercentage: allocation.allocatedAmount > 0
            ? Math.round((allocation.spentAmount / allocation.allocatedAmount) * 100)
            : 0
        };
      }
    });

    // Calculate department totals
    const reportByDepartment = [];
    let grandTotalAllocated = 0;
    let grandTotalSpent = 0;

    Object.keys(reportData).forEach(deptName => {
      const dept = reportData[deptName];
      let deptTotalAllocated = 0;
      let deptTotalSpent = 0;
      let deptTotalUnspent = 0;
      const budgetHeadDetails = [];

      Object.keys(dept.budgetHeads).forEach(headName => {
        const head = dept.budgetHeads[headName];
        deptTotalAllocated += head.currentYear.allocatedAmount;
        deptTotalSpent += head.currentYear.spentAmount;
        deptTotalUnspent += head.currentYear.remainingAmount;

        budgetHeadDetails.push({
          budgetHeadName: headName,
          ...head
        });
      });

      const utilizationPercentage = deptTotalAllocated > 0
        ? Math.round((deptTotalSpent / deptTotalAllocated) * 100)
        : 0;

      grandTotalAllocated += deptTotalAllocated;
      grandTotalSpent += deptTotalSpent;

      reportByDepartment.push({
        departmentName: deptName,
        departmentCode: dept.code,
        departmentId: dept.departmentId,
        totalAllocated: deptTotalAllocated,
        totalSpent: deptTotalSpent,
        totalUnspent: deptTotalUnspent,
        utilizationPercentage,
        budgetHeads: budgetHeadDetails
      });
    });

    // Calculate breakdown by category
    const categoryBreakdown = {};
    const budgetTypeBreakdown = {
      recurring: { allocated: 0, spent: 0 },
      'non-recurring': { allocated: 0, spent: 0 }
    };

    Object.keys(reportData).forEach(deptName => {
      const dept = reportData[deptName];
      Object.keys(dept.budgetHeads).forEach(headName => {
        const head = dept.budgetHeads[headName];
        const category = head.category;
        const budgetType = head.budgetType || 'recurring';

        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = { allocated: 0, spent: 0, percentage: 0 };
        }

        categoryBreakdown[category].allocated += head.currentYear.allocatedAmount;
        categoryBreakdown[category].spent += head.currentYear.spentAmount;

        budgetTypeBreakdown[budgetType].allocated += head.currentYear.allocatedAmount;
        budgetTypeBreakdown[budgetType].spent += head.currentYear.spentAmount;
      });
    });

    // Calculate percentages for category breakdown
    Object.keys(categoryBreakdown).forEach(category => {
      const cat = categoryBreakdown[category];
      cat.percentage = cat.allocated > 0
        ? Math.round((cat.spent / cat.allocated) * 100)
        : 0;
    });

    // Calculate percentages for budget type breakdown
    Object.keys(budgetTypeBreakdown).forEach(type => {
      const bt = budgetTypeBreakdown[type];
      bt.percentage = bt.allocated > 0
        ? Math.round((bt.spent / bt.allocated) * 100)
        : 0;
    });

    const grandTotalUnspent = grandTotalAllocated - grandTotalSpent;
    const grandUtilizationPercentage = grandTotalAllocated > 0
      ? Math.round((grandTotalSpent / grandTotalAllocated) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        financialYear,
        previousYear: previousYear || null,
        summary: {
          grandTotalAllocated,
          grandTotalSpent,
          grandTotalUnspent,
          grandUtilizationPercentage
        },
        byDepartment: reportByDepartment,
        byCategory: categoryBreakdown,
        byBudgetType: budgetTypeBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating consolidated budget report',
      error: error.message
    });
  }
};

// @desc    Get budget utilization dashboard
// @route   GET /api/reports/budget-utilization
// @access  Private
const getBudgetUtilizationDashboard = async (req, res) => {
  try {
    const { financialYear, department } = req.query;

    if (!financialYear) {
      return res.status(400).json({
        success: false,
        message: 'Financial year is required'
      });
    }

    const query = { financialYear };
    if (department) query.department = department;

    const allocations = await Allocation.find(query)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category budgetType');

    // Get daily expenditures (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dailyExpenditures = await Expenditure.find({
      eventDate: { $gte: today, $lt: tomorrow },
      status: { $in: ['approved', 'finalized'] }
    }).populate('department', 'name code');

    const dailyTotal = dailyExpenditures.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);
    const dailyDepartmentWise = {};

    dailyExpenditures.forEach(exp => {
      const deptName = exp.department.name;
      dailyDepartmentWise[deptName] = (dailyDepartmentWise[deptName] || 0) + (exp.totalAmount || 0);
    });

    // Group by utilization ranges
    const utilizationRanges = {
      '0-25': { count: 0, totalAllocated: 0, departments: [] },
      '25-50': { count: 0, totalAllocated: 0, departments: [] },
      '50-75': { count: 0, totalAllocated: 0, departments: [] },
      '75-90': { count: 0, totalAllocated: 0, departments: [] },
      '90+': { count: 0, totalAllocated: 0, departments: [] }
    };

    allocations.forEach(allocation => {
      const percentage = allocation.allocatedAmount > 0
        ? (allocation.spentAmount / allocation.allocatedAmount) * 100
        : 0;

      let range;
      if (percentage <= 25) range = '0-25';
      else if (percentage <= 50) range = '25-50';
      else if (percentage <= 75) range = '50-75';
      else if (percentage <= 90) range = '75-90';
      else range = '90+';

      utilizationRanges[range].count++;
      utilizationRanges[range].totalAllocated += allocation.allocatedAmount;

      const deptName = allocation.department.name;
      if (!utilizationRanges[range].departments.includes(deptName)) {
        utilizationRanges[range].departments.push(deptName);
      }
    });

    // Calculate department-wise utilization
    const departmentUtilization = {};
    allocations.forEach(allocation => {
      const deptName = allocation.department.name;

      if (!departmentUtilization[deptName]) {
        departmentUtilization[deptName] = {
          departmentId: allocation.department._id,
          code: allocation.department.code,
          totalAllocated: 0,
          totalSpent: 0,
          utilizationPercentage: 0
        };
      }

      departmentUtilization[deptName].totalAllocated += allocation.allocatedAmount;
      departmentUtilization[deptName].totalSpent += allocation.spentAmount;
    });

    Object.keys(departmentUtilization).forEach(deptName => {
      const dept = departmentUtilization[deptName];
      dept.utilizationPercentage = dept.totalAllocated > 0
        ? Math.round((dept.totalSpent / dept.totalAllocated) * 100)
        : 0;
    });

    res.status(200).json({
      success: true,
      data: {
        financialYear,
        utilizationRanges,
        departmentWiseUtilization: Object.values(departmentUtilization),
        totalDepartments: Object.keys(departmentUtilization).length,
        departmentsWithHighUtilization: Object.values(departmentUtilization)
          .filter(d => d.utilizationPercentage >= 90)
          .length,
        departmentsWithLowUtilization: Object.values(departmentUtilization)
          .filter(d => d.utilizationPercentage < 50)
          .length,
        dailyTotal,
        dailyDepartmentWise
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating budget utilization dashboard',
      error: error.message
    });
  }
};

// @desc    Get fund utilization trend (monthly)
// @route   GET /api/reports/fund-utilization-trend
// @access  Private
const getFundUtilizationTrend = async (req, res) => {
  try {
    const { financialYear, department } = req.query;

    if (!financialYear) {
      return res.status(400).json({
        success: false,
        message: 'Financial year is required'
      });
    }

    const query = { financialYear };
    if (department) query.department = department;

    // Get expenditures grouped by month
    const monthlyTrend = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            month: { $month: '$eventDate' },
            year: { $year: '$eventDate' }
          },
          totalSpent: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Format trend data
    const trend = monthlyTrend.map(item => ({
      month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric'
      }),
      totalSpent: item.totalSpent,
      transactionCount: item.count
    }));

    res.status(200).json({
      success: true,
      data: {
        financialYear,
        monthlyTrend: trend,
        totalTransactions: monthlyTrend.reduce((sum, item) => sum + item.count, 0),
        totalFundUtilized: monthlyTrend.reduce((sum, item) => sum + item.totalSpent, 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating fund utilization trend',
      error: error.message
    });
  }
};

module.exports = {
  getConsolidatedBudgetReport,
  getBudgetUtilizationDashboard,
  getFundUtilizationTrend
};
