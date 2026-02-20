const Expenditure = require('../models/Expenditure');
const Allocation = require('../models/Allocation');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const BudgetProposal = require('../models/BudgetProposal');

// @desc    Get expenditure report
// @route   GET /api/reports/expenditures
// @access  Private
const getExpenditureReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      department,
      budgetHead,
      status,
      financialYear,
      format = 'json'
    } = req.query;

    // Build query
    const query = {};

    if (startDate && endDate) {
      query.eventDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (department) {
      query.department = department;
    }

    if (budgetHead) {
      query.budgetHead = budgetHead;
    }

    if (status) {
      query.status = status;
    }

    // Get expenditures with populated data
    const expenditures = await Expenditure.find(query)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role')
      .sort({ createdAt: -1 });

    // Calculate summary statistics
    const summary = {
      totalExpenditures: expenditures.length,
      totalAmount: expenditures.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0),
      byStatus: {},
      byDepartment: {},
      byBudgetHead: {},
      byMonth: {}
    };

    expenditures.forEach(exp => {
      const amount = exp.totalAmount || 0;
      // By status
      summary.byStatus[exp.status] = (summary.byStatus[exp.status] || 0) + amount;

      // By department
      const deptName = exp.department?.name || 'Unknown';
      if (!summary.byDepartment[deptName]) {
        summary.byDepartment[deptName] = { count: 0, amount: 0 };
      }
      summary.byDepartment[deptName].count++;
      summary.byDepartment[deptName].amount += amount;

      // By budget head
      const headName = exp.budgetHead?.name || 'Unknown';
      if (!summary.byBudgetHead[headName]) {
        summary.byBudgetHead[headName] = { count: 0, amount: 0 };
      }
      summary.byBudgetHead[headName].count++;
      summary.byBudgetHead[headName].amount += amount;

      // By month
      const date = exp.eventDate || exp.createdAt;
      const month = date ? new Date(date).toISOString().substring(0, 7) : 'Unknown';
      summary.byMonth[month] = (summary.byMonth[month] || 0) + amount;
    });

    if (format === 'csv') {
      const csvData = generateExpenditureCSV(expenditures);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=expenditure-report.csv');
      return res.send(csvData);
    }

    res.json({
      success: true,
      data: {
        expenditures,
        summary,
        filters: {
          startDate,
          endDate,
          department,
          budgetHead,
          status,
          financialYear
        }
      }
    });
  } catch (error) {
    console.error('Get expenditure report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating expenditure report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get budget allocation report
// @route   GET /api/reports/allocations
// @access  Private
const getAllocationReport = async (req, res) => {
  try {
    const {
      financialYear,
      department,
      budgetHead,
      format = 'json'
    } = req.query;

    // Build query
    const query = {};

    if (financialYear) {
      query.financialYear = financialYear;
    }

    if (department) {
      query.department = department;
    }

    if (budgetHead) {
      query.budgetHead = budgetHead;
    }

    // Get allocations with populated data
    const allocations = await Allocation.find(query)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('createdBy', 'name email')
      .sort({ financialYear: -1, department: 1 });

    // Calculate summary statistics
    const summary = {
      totalAllocations: allocations.length,
      totalAllocated: allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0),
      totalSpent: allocations.reduce((sum, alloc) => sum + alloc.spentAmount, 0),
      totalRemaining: allocations.reduce((sum, alloc) => sum + alloc.remainingAmount, 0),
      averageUtilization: 0,
      byDepartment: {},
      byBudgetHead: {},
      byFinancialYear: {}
    };

    allocations.forEach(alloc => {
      // By department
      const deptName = alloc.department.name;
      if (!summary.byDepartment[deptName]) {
        summary.byDepartment[deptName] = {
          allocated: 0,
          spent: 0,
          remaining: 0,
          count: 0
        };
      }
      summary.byDepartment[deptName].allocated += alloc.allocatedAmount;
      summary.byDepartment[deptName].spent += alloc.spentAmount;
      summary.byDepartment[deptName].remaining += alloc.remainingAmount;
      summary.byDepartment[deptName].count++;

      // By budget head
      const headName = alloc.budgetHead.name;
      if (!summary.byBudgetHead[headName]) {
        summary.byBudgetHead[headName] = {
          allocated: 0,
          spent: 0,
          remaining: 0,
          count: 0
        };
      }
      summary.byBudgetHead[headName].allocated += alloc.allocatedAmount;
      summary.byBudgetHead[headName].spent += alloc.spentAmount;
      summary.byBudgetHead[headName].remaining += alloc.remainingAmount;
      summary.byBudgetHead[headName].count++;

      // By financial year
      const fy = alloc.financialYear;
      if (!summary.byFinancialYear[fy]) {
        summary.byFinancialYear[fy] = {
          allocated: 0,
          spent: 0,
          remaining: 0,
          count: 0
        };
      }
      summary.byFinancialYear[fy].allocated += alloc.allocatedAmount;
      summary.byFinancialYear[fy].spent += alloc.spentAmount;
      summary.byFinancialYear[fy].remaining += alloc.remainingAmount;
      summary.byFinancialYear[fy].count++;
    });

    // Calculate average utilization
    if (summary.totalAllocated > 0) {
      summary.averageUtilization = (summary.totalSpent / summary.totalAllocated) * 100;
    }

    if (format === 'csv') {
      const csvData = generateAllocationCSV(allocations);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=allocation-report.csv');
      return res.send(csvData);
    }

    res.json({
      success: true,
      data: {
        allocations,
        summary,
        filters: {
          financialYear,
          department,
          budgetHead
        }
      }
    });
  } catch (error) {
    console.error('Get allocation report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating allocation report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get consolidated dashboard report
// @route   GET /api/reports/dashboard
// @access  Private
const getDashboardReport = async (req, res) => {
  try {
    const { financialYear, includeComparison = false } = req.query;

    // Get current financial year if not specified
    const currentFY = financialYear || getCurrentFinancialYear();

    // Build department filter based on role or query
    const deptFilter = {};
    if (req.user.role === 'department' || req.user.role === 'hod') {
      deptFilter.department = req.user.department;
    } else if (req.query.department) {
      deptFilter.department = req.query.department;
    }

    // Get allocations for the financial year
    const allocations = await Allocation.find({
      financialYear: currentFY,
      ...deptFilter
    })
      .populate('department', 'name code')
      .populate('budgetHead', 'name category');

    // Validate financial year format
    if (!currentFY || !/^\d{4}-\d{4}$/.test(currentFY)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid financial year format. Expected YYYY-YYYY.'
      });
    }

    // Get expenditures for the financial year
    const startYear = parseInt(currentFY.split('-')[0]);
    const endYear = parseInt(currentFY.split('-')[1]);

    const startDate = new Date(startYear, 3, 1); // Month is 0-indexed: April 1st
    const endDate = new Date(endYear, 2, 31, 23, 59, 59); // March 31st end of day

    const expenditures = await Expenditure.find({
      eventDate: { $gte: startDate, $lte: endDate },
      ...deptFilter
    })
      .populate('department', 'name code')
      .populate('budgetHead', 'name category');

    // Get Budget Proposals for the financial year (for "Requested Amount")
    const proposals = await BudgetProposal.find({
      financialYear: currentFY,
      ...deptFilter
    });

    // Calculate consolidated statistics
    const consolidated = {
      financialYear: currentFY,
      // 1. Requested Amount (sum of all pending + approved event requests)
      totalRequested: expenditures
        .filter(exp => ['pending', 'verified', 'approved'].includes(exp.status))
        .reduce((sum, exp) => sum + (exp.totalAmount || 0), 0),

      // 2. Approved Budget (Total allocations for the department)
      totalAllocated: allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0),

      // 3. Utilized Amount (Finalized Phase 2 events only)
      totalUtilized: expenditures
        .filter(exp => exp.status === 'finalized')
        .reduce((sum, exp) => sum + (exp.totalAmount || 0), 0),

      // 4. Pending Amount (events under verification/approval - NOT deducted)
      totalPending: expenditures
        .filter(exp => ['pending', 'verified', 'approved'].includes(exp.status))
        .reduce((sum, exp) => sum + (exp.totalAmount || 0), 0),

      // Legacy field for compatibility if needed elsewhere
      remainingBalance: (allocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0)) -
        (expenditures.filter(exp => exp.status === 'finalized').reduce((sum, exp) => sum + (exp.totalAmount || 0), 0)),

      // Support for status breakdown count
      statusBreakdown: {
        pending: 0,
        verified: 0,
        approved: 0,
        finalized: 0,
        rejected: 0
      },

      recentEvents: expenditures
        .filter(exp => exp.status === 'finalized')
        .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
        .slice(0, 10)
        .map(exp => ({
          name: exp.eventName,
          amount: exp.totalAmount,
          date: exp.eventDate
        })),

      utilizationPercentage: 0,
      departmentBreakdown: {},
      budgetHeadBreakdown: {},
      monthlyTrend: {},
      dailyTotal: 0,
      dailyDepartmentBreakdown: {},
      yearComparison: null
    };

    consolidated.remainingBalance = consolidated.totalAllocated - consolidated.totalUtilized;

    // Calculate daily metrics (for today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dailyExpenditures = expenditures.filter(exp => {
      const eventDate = new Date(exp.eventDate);
      return eventDate >= today && eventDate < tomorrow && ['approved', 'finalized'].includes(exp.status);
    });

    consolidated.dailyTotal = dailyExpenditures.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);
    dailyExpenditures.forEach(exp => {
      const deptName = exp.department.name;
      consolidated.dailyDepartmentBreakdown[deptName] = (consolidated.dailyDepartmentBreakdown[deptName] || 0) + (exp.totalAmount || 0);
    });

    // Calculate utilization percentage
    if (consolidated.totalAllocated > 0) {
      consolidated.utilizationPercentage = (consolidated.totalUtilized / consolidated.totalAllocated) * 100;
    }

    // Department breakdown
    allocations.forEach(alloc => {
      if (!alloc.department) return;
      const deptName = alloc.department.name;
      if (!consolidated.departmentBreakdown[deptName]) {
        consolidated.departmentBreakdown[deptName] = {
          allocated: 0,
          spent: 0,
          remaining: 0,
          utilization: 0
        };
      }
      consolidated.departmentBreakdown[deptName].allocated += alloc.allocatedAmount;
      consolidated.departmentBreakdown[deptName].spent += alloc.spentAmount;
      consolidated.departmentBreakdown[deptName].remaining += alloc.remainingAmount;
    });

    // Calculate department utilization
    Object.keys(consolidated.departmentBreakdown).forEach(dept => {
      const deptData = consolidated.departmentBreakdown[dept];
      if (deptData.allocated > 0) {
        deptData.utilization = (deptData.spent / deptData.allocated) * 100;
      }
    });

    // Budget head breakdown
    allocations.forEach(alloc => {
      if (!alloc.budgetHead) return;
      const headName = alloc.budgetHead.name;
      if (!consolidated.budgetHeadBreakdown[headName]) {
        consolidated.budgetHeadBreakdown[headName] = {
          allocated: 0,
          spent: 0,
          remaining: 0,
          utilization: 0
        };
      }
      consolidated.budgetHeadBreakdown[headName].allocated += alloc.allocatedAmount;
      consolidated.budgetHeadBreakdown[headName].spent += alloc.spentAmount;
      consolidated.budgetHeadBreakdown[headName].remaining += alloc.remainingAmount;
    });

    // Calculate budget head utilization
    Object.keys(consolidated.budgetHeadBreakdown).forEach(head => {
      const headData = consolidated.budgetHeadBreakdown[head];
      if (headData.allocated > 0) {
        headData.utilization = (headData.spent / headData.allocated) * 100;
      }
    });

    // Monthly trend (Finalized only)
    expenditures
      .filter(exp => exp.status === 'finalized')
      .forEach(exp => {
        const month = (exp.eventDate || exp.createdAt).toISOString().substring(0, 7);
        consolidated.monthlyTrend[month] = (consolidated.monthlyTrend[month] || 0) + (exp.totalAmount || 0);
      });

    // Status breakdown
    expenditures.forEach(exp => {
      if (exp.status) {
        consolidated.statusBreakdown[exp.status]++;
      }
    });

    // Year comparison if requested
    if (includeComparison === 'true') {
      const previousFY = getPreviousFinancialYear(currentFY);
      const comparisonData = await getYearComparisonData(previousFY, currentFY);
      consolidated.yearComparison = comparisonData;
    }

    res.json({
      success: true,
      data: { consolidated }
    });
  } catch (error) {
    console.error('Get dashboard report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating dashboard report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get audit trail report
// @route   GET /api/reports/audit
// @access  Private/Admin
const getAuditReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      eventType,
      actorId,
      format = 'json'
    } = req.query;

    // Build query
    const query = {};

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (eventType) {
      query.eventType = eventType;
    }

    if (actorId) {
      query.actorId = actorId;
    }

    // Get audit logs with populated data
    const auditLogs = await AuditLog.find(query)
      .populate('actorId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(1000); // Limit to prevent large responses

    if (format === 'csv') {
      const csvData = generateAuditCSV(auditLogs);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.csv');
      return res.send(csvData);
    }

    res.json({
      success: true,
      data: {
        auditLogs,
        totalRecords: auditLogs.length,
        filters: {
          startDate,
          endDate,
          eventType,
          actorId
        }
      }
    });
  } catch (error) {
    console.error('Get audit report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating audit report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get budget proposal report
// @route   GET /api/reports/proposals
// @access  Private
const getBudgetProposalReport = async (req, res) => {
  try {
    const { financialYear, department, status } = req.query;

    const query = {};
    if (financialYear) query.financialYear = financialYear;
    if (department) query.department = department;
    if (status) query.status = status;

    const proposals = await BudgetProposal.find(query)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name code category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ financialYear: -1, department: 1 });

    const summary = {
      totalProposals: proposals.length,
      totalProposedAmount: proposals.reduce((sum, p) => sum + p.totalProposedAmount, 0),
      byStatus: {
        draft: 0,
        submitted: 0,
        verified: 0,
        approved: 0,
        rejected: 0,
        revised: 0
      },
      byDepartment: {}
    };

    proposals.forEach(p => {
      summary.byStatus[p.status] = (summary.byStatus[p.status] || 0) + 1;

      const deptName = p.department.name;
      if (!summary.byDepartment[deptName]) {
        summary.byDepartment[deptName] = {
          count: 0,
          amount: 0,
          status: p.status
        };
      }
      summary.byDepartment[deptName].count++;
      summary.byDepartment[deptName].amount += p.totalProposedAmount;
    });

    res.json({
      success: true,
      data: {
        proposals,
        summary,
        filters: { financialYear, department, status }
      }
    });
  } catch (error) {
    console.error('Get budget proposal report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating budget proposal report',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper functions
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

const getYearComparisonData = async (previousFY, currentFY) => {
  try {
    // Get previous year data
    const prevStartDate = new Date(`${previousFY.split('-')[0]}-04-01`);
    const prevEndDate = new Date(`${previousFY.split('-')[1]}-03-31`);

    const prevAllocations = await Allocation.find({ financialYear: previousFY })
      .populate('department', 'name code')
      .populate('budgetHead', 'name category');

    const prevExpenditures = await Expenditure.find({
      eventDate: { $gte: prevStartDate, $lte: prevEndDate },
      status: 'finalized'
    });

    // Get current year data (already fetched)
    const currentStartDate = new Date(`${currentFY.split('-')[0]}-04-01`);
    const currentEndDate = new Date(`${currentFY.split('-')[1]}-03-31`);

    const currentAllocations = await Allocation.find({ financialYear: currentFY })
      .populate('department', 'name code')
      .populate('budgetHead', 'name category');

    const currentExpenditures = await Expenditure.find({
      eventDate: { $gte: currentStartDate, $lte: currentEndDate },
      status: 'finalized'
    });

    // Calculate comparison metrics
    const prevTotalAllocated = prevAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    const prevTotalSpent = prevExpenditures.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);
    const prevUtilization = prevTotalAllocated > 0 ? (prevTotalSpent / prevTotalAllocated) * 100 : 0;

    const currentTotalAllocated = currentAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    const currentTotalSpent = currentExpenditures.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);
    const currentUtilization = currentTotalAllocated > 0 ? (currentTotalSpent / currentTotalAllocated) * 100 : 0;

    // Calculate percentage changes
    const allocatedChange = prevTotalAllocated > 0
      ? ((currentTotalAllocated - prevTotalAllocated) / prevTotalAllocated) * 100
      : 0;

    const spentChange = prevTotalSpent > 0
      ? ((currentTotalSpent - prevTotalSpent) / prevTotalSpent) * 100
      : 0;

    const utilizationChange = prevUtilization > 0
      ? currentUtilization - prevUtilization
      : 0;

    // Department-wise comparison
    const departmentComparison = {};

    // Get all unique departments from both years
    const allDepartments = new Set([
      ...prevAllocations.filter(a => a.department).map(a => a.department.name),
      ...currentAllocations.filter(a => a.department).map(a => a.department.name)
    ]);

    allDepartments.forEach(deptName => {
      // Filter safely checking if department exists
      const prevDeptAllocations = prevAllocations.filter(a => a.department && a.department.name === deptName);
      const currentDeptAllocations = currentAllocations.filter(a => a.department && a.department.name === deptName);

      const prevDeptAllocated = prevDeptAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
      const prevDeptSpent = prevDeptAllocations.reduce((sum, alloc) => sum + alloc.spentAmount, 0);

      const currentDeptAllocated = currentDeptAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
      const currentDeptSpent = currentDeptAllocations.reduce((sum, alloc) => sum + alloc.spentAmount, 0);

      const allocatedChange = prevDeptAllocated > 0
        ? ((currentDeptAllocated - prevDeptAllocated) / prevDeptAllocated) * 100
        : 0;

      const spentChange = prevDeptSpent > 0
        ? ((currentDeptSpent - prevDeptSpent) / prevDeptSpent) * 100
        : 0;

      const prevDeptUtilization = prevDeptAllocated > 0 ? (prevDeptSpent / prevDeptAllocated) * 100 : 0;
      const currentDeptUtilization = currentDeptAllocated > 0 ? (currentDeptSpent / currentDeptAllocated) * 100 : 0;

      const utilizationChange = prevDeptUtilization > 0
        ? currentDeptUtilization - prevDeptUtilization
        : 0;

      departmentComparison[deptName] = {
        previous: {
          allocated: prevDeptAllocated,
          spent: prevDeptSpent,
          utilization: prevDeptUtilization
        },
        current: {
          allocated: currentDeptAllocated,
          spent: currentDeptSpent,
          utilization: currentDeptUtilization
        },
        changes: {
          allocatedChange,
          spentChange,
          utilizationChange
        }
      };
    });

    return {
      previousYear: previousFY,
      currentYear: currentFY,
      summary: {
        previous: {
          totalAllocated: prevTotalAllocated,
          totalSpent: prevTotalSpent,
          utilization: prevUtilization
        },
        current: {
          totalAllocated: currentTotalAllocated,
          totalSpent: currentTotalSpent,
          utilization: currentUtilization
        },
        changes: {
          allocatedChange,
          spentChange,
          utilizationChange
        }
      },
      departmentComparison
    };
  } catch (error) {
    console.error('Error generating year comparison data:', error);
    return null;
  }
};

const generateExpenditureCSV = (expenditures) => {
  const headers = [
    'Event Name',
    'Event Type',
    'Event Date',
    'Total Amount',
    'Bill Number(s)',
    'Vendor(s)',
    'Department',
    'Budget Head',
    'Status',
    'Submitted By',
    'Financial Year',
    'Created At'
  ];

  const rows = expenditures.map(exp => {
    const billNumbers = exp.expenseItems?.map(item => item.billNumber).join('; ') || '';
    const vendors = exp.expenseItems?.map(item => item.vendorName).join('; ') || '';
    const date = exp.eventDate || exp.createdAt;

    return [
      exp.eventName || 'N/A',
      exp.eventType || 'N/A',
      date ? new Date(date).toISOString().split('T')[0] : 'N/A',
      exp.totalAmount || 0,
      billNumbers,
      vendors,
      exp.department?.name || 'N/A',
      exp.budgetHead?.name || 'N/A',
      exp.status || 'N/A',
      exp.submittedBy?.name || 'N/A',
      exp.financialYear || 'N/A',
      exp.createdAt ? new Date(exp.createdAt).toISOString() : 'N/A'
    ];
  });

  return [headers, ...rows].map(row =>
    row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
};

const generateAllocationCSV = (allocations) => {
  const headers = [
    'Financial Year',
    'Department',
    'Budget Head',
    'Allocated Amount',
    'Spent Amount',
    'Remaining Amount',
    'Utilization %',
    'Created By',
    'Created At'
  ];

  const rows = allocations.map(alloc => {
    const utilization = alloc.allocatedAmount > 0
      ? ((alloc.spentAmount / alloc.allocatedAmount) * 100).toFixed(2)
      : '0.00';

    return [
      alloc.financialYear,
      alloc.department.name,
      alloc.budgetHead.name,
      alloc.allocatedAmount,
      alloc.spentAmount,
      alloc.remainingAmount,
      utilization,
      alloc.createdBy.name,
      alloc.createdAt.toISOString()
    ];
  });

  return [headers, ...rows].map(row =>
    row.map(field => `"${field}"`).join(',')
  ).join('\n');
};

const generateAuditCSV = (auditLogs) => {
  const headers = [
    'Timestamp',
    'Event Type',
    'Actor',
    'Actor Role',
    'Details'
  ];

  const rows = auditLogs.map(log => [
    log.timestamp.toISOString(),
    log.eventType,
    log.actorId ? log.actorId.name : 'System',
    log.actorId ? log.actorId.role : 'System',
    log.details
  ]);

  return [headers, ...rows].map(row =>
    row.map(field => `"${field}"`).join(',')
  ).join('\n');
};

module.exports = {
  getExpenditureReport,
  getAllocationReport,
  getDashboardReport,
  getAuditReport,
  getBudgetProposalReport
};
