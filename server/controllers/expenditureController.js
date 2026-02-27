const Expenditure = require('../models/Expenditure');
const Allocation = require('../models/Allocation');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const {
  notifyExpenditureSubmission,
  notifyExpenditureApproval,
  notifyExpenditureRejection,
  notifyBudgetExhaustion,
  notifyExpenditureVerification,
  notifyExpenditureFinalization
} = require('../utils/notificationService');
const { recordAuditLog } = require('../utils/auditService');
const { broadcast } = require('../services/socketService');

const getSetting = async (key, defaultValue) => {
  try {
    const setting = await Settings.findOne({ key });
    return setting ? setting.value : defaultValue;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
};

// @desc    Get all expenditures
// @route   GET /api/expenditures
// @access  Private
const getExpenditures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      department,
      budgetHead,
      status,
      financialYear,
      search,
      submittedBy,
      category
    } = req.query;

    const query = {};

    // Apply filters based on user role
    const isApprovalRole = ['hod', 'office', 'vice_principal', 'principal'].includes(req.user.role);

    if (status === 'pending_approval' && isApprovalRole) {
      // Logic for "My Approvals" queue
      if (req.user.role === 'hod') {
        query.status = 'pending';
        query.department = req.user.department;
      } else if (req.user.role === 'office') {
        // Office is the final step: Sanctioning Management-approved expenditures
        query.status = 'approved';
      } else if (req.user.role === 'vice_principal' || req.user.role === 'principal') {
        query.status = 'verified'; // Prin/VP approve what HOD/Office verified
      }
    } else {
      // Standard filtering
      if (req.user.role === 'department' || req.user.role === 'hod') {
        query.department = req.user.department;
      } else if (department && department !== 'undefined' && department !== 'all') {
        query.department = department;
      }

      // Default status for admins should include all non-draft statuses
      if (!status || status === 'all') {
        if (['principal', 'vice_principal', 'office', 'admin'].includes(req.user.role)) {
          query.status = { $in: ['pending', 'verified', 'approved', 'finalized', 'rejected'] };
        }
      } else {
        query.status = status;
      }
    }

    if (budgetHead) query.budgetHead = budgetHead;
    if (financialYear) query.financialYear = financialYear;
    if (submittedBy) query.submittedBy = submittedBy;
    if (category) query['expenseItems.category'] = { $regex: category, $options: 'i' };
    if (search) {
      query.$or = [
        { eventName: { $regex: search, $options: 'i' } },
        { 'expenseItems.billNumber': { $regex: search, $options: 'i' } },
        { 'expenseItems.vendorName': { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const expenditures = await Expenditure.find(query)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Expenditure.countDocuments(query);

    res.json({
      success: true,
      data: {
        expenditures,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get expenditures error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching expenditures',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get expenditure by ID
// @route   GET /api/expenditures/:id
// @access  Private
const getExpenditureById = async (req, res) => {
  try {
    const expenditure = await Expenditure.findById(req.params.id)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    if (!expenditure) {
      return res.status(404).json({
        success: false,
        message: 'Expenditure not found'
      });
    }

    // Check if user can access this expenditure
    if ((req.user.role === 'department' || req.user.role === 'hod') && expenditure.department._id.toString() !== req.user.department.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your department expenditures.'
      });
    }

    res.json({
      success: true,
      data: { expenditure }
    });
  } catch (error) {
    console.error('Get expenditure by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Submit new event-based expenditure
// @route   POST /api/expenditures
// @access  Private/Department
const submitExpenditure = async (req, res) => {
  try {
    let {
      department,
      budgetHead,
      eventName,
      eventType,
      eventDate,
      description,
      expenseItems
    } = req.body;

    // Resolve department: use body department if user is management, else use user's own department
    let departmentId = req.user.department;
    if (['admin', 'office', 'principal', 'vice_principal'].includes(req.user.role) && department) {
      departmentId = department;
    }

    if (!departmentId) {
      return res.status(400).json({
        success: false,
        message: 'Department is required for this request'
      });
    }

    // Handle JSON string if sent via FormData
    if (typeof expenseItems === 'string') {
      try {
        expenseItems = JSON.parse(expenseItems);
      } catch (e) {
        console.error('Error parsing expenseItems JSON:', e);
      }
    }

    // Map uploaded files to expense items if metadata exists
    if (req.uploadedFiles && req.uploadedFiles.length > 0 && Array.isArray(expenseItems)) {
      let fileIdx = 0;
      expenseItems.forEach(item => {
        item.attachments = item.attachments || [];
        const count = item.fileCount || 0;
        for (let i = 0; i < count; i++) {
          if (req.uploadedFiles[fileIdx]) {
            item.attachments.push(req.uploadedFiles[fileIdx]);
            fileIdx++;
          }
        }
      });
    }

    // Validate required fields
    if (!budgetHead || !eventName || !eventType || !eventDate || !expenseItems || !Array.isArray(expenseItems) || expenseItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided, including at least one expense item'
      });
    }

    // Calculate total amount
    const totalAmount = expenseItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    // Get current financial year based on event date
    const eventDateObj = new Date(eventDate);
    const year = eventDateObj.getFullYear();
    const month = eventDateObj.getMonth() + 1;
    const financialYear = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    // Check if allocation exists
    const allocation = await Allocation.findOne({
      department: departmentId,
      budgetHead,
      financialYear
    });

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: 'No budget has been allocated for this budget head'
      });
    }

    // Overspend check
    const remainingAmount = allocation.allocatedAmount - allocation.spentAmount;
    const overspendPolicy = await getSetting('budget_overspend_policy', 'disallow');

    if (totalAmount > remainingAmount && overspendPolicy === 'disallow') {
      return res.status(400).json({
        success: false,
        message: `Total event amount (₹${totalAmount.toLocaleString()}) exceeds remaining budget (₹${remainingAmount.toLocaleString()})`,
        remainingBudget: remainingAmount
      });
    }

    const expenditure = await Expenditure.create([{
      department: departmentId,
      budgetHead,
      eventName,
      eventType,
      eventDate: eventDateObj,
      description,
      expenseItems: expenseItems.map(item => ({
        ...item,
        category: item.category || 'MISCELLANEOUS',
        amount: Number(item.amount) || 0,
        billDate: item.billDate ? new Date(item.billDate) : new Date()
      })),
      totalAmount,
      submittedBy: req.user._id,
      financialYear,
      status: 'pending'
    }]);

    // Log the submission
    await recordAuditLog({
      eventType: 'expenditure_submitted',
      req,
      targetEntity: 'Expenditure',
      targetId: expenditure[0]._id,
      details: {
        eventName,
        totalAmount,
        department: departmentId
      },
      newValues: expenditure[0]
    });

    const populatedExpenditure = await Expenditure.findById(expenditure[0]._id)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email');

    await notifyExpenditureSubmission(populatedExpenditure);

    res.status(201).json({
      success: true,
      message: 'Event expenditure submitted successfully',
      data: { expenditure: populatedExpenditure }
    });
  } catch (error) {
    console.error('Submit expenditure error:', error);

    // Provide detailed error for validation failures
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', '),
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while submitting expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Approve expenditure
// @route   PUT /api/expenditures/:id/approve
// @access  Private/Office/VicePrincipal/Principal
const approveExpenditure = async (req, res) => {
  try {
    const { remarks } = req.body;
    const expenditureId = req.params.id;

    const expenditure = await Expenditure.findById(expenditureId);
    if (!expenditure) {
      return res.status(404).json({
        success: false,
        message: 'Expenditure not found'
      });
    }

    // Check if expenditure is in pending or verified status
    // Department -> HOD (Verify) -> Principal (Approve) -> Office (Finalize)
    // Principal/VP can ONLY approve VERIFIED items (HOD verification is mandatory)
    if (expenditure.status !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Expenditure must be verified by HOD before Management approval'
      });
    }

    // Role check for approval - ONLY Management (Principal/VP)
    const allowedApprovalRoles = ['vice_principal', 'principal'];
    if (!allowedApprovalRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only Principal or Vice Principal can approve expenditures'
      });
    }

    // Get allocation
    const allocation = await Allocation.findOne({
      department: expenditure.department,
      budgetHead: expenditure.budgetHead,
      financialYear: expenditure.financialYear
    });

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Check if approval would exceed budget
    const remainingAmount = allocation.allocatedAmount - allocation.spentAmount;
    const overspendPolicy = await getSetting('budget_overspend_policy', 'disallow');

    if (expenditure.totalAmount > remainingAmount && overspendPolicy === 'disallow') {
      return res.status(400).json({
        success: false,
        message: 'Approval would exceed allocated budget, and overspend is disallowed.'
      });
    }

    // Store previous values for audit log
    const previousState = expenditure.toObject();

    // Role-based logic for approval
    let newStatus = 'approved';
    const amount = expenditure.totalAmount;

    // Vice Principal threshold check (₹50,000)
    if (req.user.role === 'vice_principal') {
      if (amount > 50000) {
        return res.status(403).json({
          success: false,
          message: 'Vice Principal can only approve expenditures up to ₹50,000. This requires Principal approval.'
        });
      }
    }

    // Update expenditure status and add approval step
    expenditure.status = newStatus;
    expenditure.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'approve',
      remarks: remarks || '',
      timestamp: new Date()
    });

    await expenditure.save();

    // Population for notification and audit
    const populatedExpenditure = await Expenditure.findById(expenditureId)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Send notifications
    try {
      await notifyExpenditureApproval(populatedExpenditure, req.user);

      // Check for budget exhaustion and notify if > 90%
      const updatedAllocation = await Allocation.findById(allocation._id).populate('department budgetHead');
      if (updatedAllocation) {
        await notifyBudgetExhaustion(updatedAllocation);
      }
    } catch (notifyError) {
      console.error('Notification error (non-fatal):', notifyError);
    }

    // Log the approval
    try {
      await recordAuditLog({
        eventType: 'expenditure_approved',
        req,
        targetEntity: 'Expenditure',
        targetId: expenditureId,
        details: {
          eventName: expenditure.eventName,
          totalAmount: expenditure.totalAmount,
          remarks
        },
        previousValues: previousState,
        newValues: populatedExpenditure
      });
    } catch (auditError) {
      console.error('Audit log error (non-fatal):', auditError);
    }

    res.json({
      success: true,
      message: 'Expenditure approved successfully',
      data: { expenditure: populatedExpenditure }
    });
  } catch (error) {
    console.error('Approve expenditure error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Reject expenditure
// @route   PUT /api/expenditures/:id/reject
// @access  Private/Office/VicePrincipal/Principal/HOD
const rejectExpenditure = async (req, res) => {
  try {
    const { remarks } = req.body;
    const expenditureId = req.params.id;

    if (!remarks || remarks.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Remarks are mandatory when rejecting an expenditure'
      });
    }

    const expenditure = await Expenditure.findById(expenditureId);
    if (!expenditure) {
      return res.status(404).json({
        success: false,
        message: 'Expenditure not found'
      });
    }

    // Check if expenditure is in a state that can be rejected
    // For HOD: pending
    // For Prin/VP: pending or verified
    // For Office: approved
    const allowedStatuses = ['pending', 'verified', 'approved'];
    if (!allowedStatuses.includes(expenditure.status)) {
      return res.status(400).json({
        success: false,
        message: 'Expenditure is not in a state that can be rejected'
      });
    }

    const previousState = expenditure.toObject();
    // Update expenditure status and add rejection step
    expenditure.status = 'rejected';
    expenditure.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'reject',
      remarks: remarks.trim(),
      timestamp: new Date()
    });

    await expenditure.save();

    // Log the rejection
    await recordAuditLog({
      eventType: 'expenditure_rejected',
      req,
      targetEntity: 'Expenditure',
      targetId: expenditureId,
      details: { eventName: expenditure.eventName, totalAmount: expenditure.totalAmount, remarks },
      previousValues: previousState,
      newValues: expenditure
    });

    const populatedExpenditure = await Expenditure.findById(expenditureId)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Send notifications
    await notifyExpenditureRejection(populatedExpenditure, req.user, remarks);

    res.json({
      success: true,
      message: 'Expenditure rejected successfully',
      data: { expenditure: populatedExpenditure }
    });
  } catch (error) {
    console.error('Reject expenditure error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Finalize expenditure
// @route   PUT /api/expenditures/:id/finalize
// @access  Private/Office
const finalizeExpenditure = async (req, res) => {
  try {
    const { remarks } = req.body;
    const expenditureId = req.params.id;

    const expenditure = await Expenditure.findById(expenditureId);
    if (!expenditure) {
      return res.status(404).json({
        success: false,
        message: 'Expenditure not found'
      });
    }

    // Can only finalize if it's already approved
    if (expenditure.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Expenditure must be approved before it can be finalized'
      });
    }

    // Get allocation
    const allocation = await Allocation.findOne({
      department: expenditure.department,
      budgetHead: expenditure.budgetHead,
      financialYear: expenditure.financialYear
    });

    if (!allocation) {
      return res.status(400).json({
        success: false,
        message: 'Allocation not found'
      });
    }

    // Update expenditure status to finalized
    expenditure.status = 'finalized';
    expenditure.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'finalize',
      remarks: remarks || '',
      timestamp: new Date()
    });

    await expenditure.save();

    // NEW: Update allocation spent amount atomically during finalization (Office Sanction)
    const overspendPolicy = await getSetting('budget_overspend_policy', 'disallow');
    const updateResult = await Allocation.findOneAndUpdate(
      {
        _id: allocation._id,
        // If policy is disallow, ensure we don't exceed budget in this atomic step
        ...(overspendPolicy === 'disallow' ? {
          $expr: { $lte: [{ $add: ['$spentAmount', expenditure.totalAmount] }, '$allocatedAmount'] }
        } : {})
      },
      { $inc: { spentAmount: expenditure.totalAmount } },
      { new: true }
    );

    if (!updateResult) {
      return res.status(400).json({
        success: false,
        message: 'Budget exceeded during finalization attempt or allocation not found.'
      });
    }

    let transactionCommitted = true;

    // REAL-TIME UPDATE: Notify all clients to update their dashboards
    try {
      broadcast('dashboard_update', {
        type: 'expenditure_finalized',
        department: expenditure.department,
        amount: expenditure.totalAmount,
        timestamp: new Date()
      });
    } catch (socketError) {
      console.error('Socket broadcast error (non-fatal):', socketError);
    }



    // Log the finalization
    try {
      await AuditLog.create({
        eventType: 'expenditure_finalized',
        actor: req.user._id,
        actorRole: req.user.role,
        targetEntity: 'Expenditure',
        targetId: expenditureId,
        details: {
          eventName: expenditure.eventName,
          totalAmount: expenditure.totalAmount,
          remarks
        }
      });
    } catch (auditError) {
      console.error('Audit log error (non-fatal):', auditError);
    }

    const populatedExpenditure = await Expenditure.findById(expenditureId)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Send notification to submittor
    await notifyExpenditureFinalization(populatedExpenditure);

    res.json({
      success: true,
      message: 'Expenditure finalized successfully',
      data: { expenditure: populatedExpenditure }
    });
  } catch (error) {
    console.error('Finalize expenditure error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while finalizing expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Verify expenditure (HOD)
// @route   PUT /api/expenditures/:id/verify
// @access  Private/HOD
const verifyExpenditure = async (req, res) => {
  try {
    const { remarks } = req.body;
    const expenditureId = req.params.id;

    const expenditure = await Expenditure.findById(expenditureId);
    if (!expenditure) {
      return res.status(404).json({
        success: false,
        message: 'Expenditure not found'
      });
    }

    // Check permissions - HOD Only for Verification
    const allowedVerifyRoles = ['hod'];
    if (!allowedVerifyRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only HOD can verify expenditures'
      });
    }

    if (req.user.role === 'hod') {
      if (expenditure.department.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only verify expenditures from your department'
        });
      }
    }

    // Check if expenditure is in a state that can be verified
    if (expenditure.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Only pending expenditures can be verified'
      });
    }

    // Update expenditure status and add verification step
    expenditure.status = 'verified';
    expenditure.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'verify',
      remarks: remarks || '',
      timestamp: new Date()
    });

    await expenditure.save();

    // Log the verification
    await AuditLog.create({
      eventType: 'expenditure_verified',
      actor: req.user._id,
      actorRole: req.user.role,
      targetEntity: 'Expenditure',
      targetId: expenditureId,
      details: {
        eventName: expenditure.eventName,
        totalAmount: expenditure.totalAmount,
        remarks
      }
    });

    const populatedExpenditure = await Expenditure.findById(expenditureId)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Send notification to next level (Principal/VP)
    await notifyExpenditureVerification(populatedExpenditure);

    res.json({
      success: true,
      message: 'Expenditure verified successfully',
      data: { expenditure: populatedExpenditure }
    });
  } catch (error) {
    console.error('Verify expenditure error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while verifying expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Resubmit expenditure
// @route   POST /api/expenditures/:id/resubmit
// @access  Private/Department
const resubmitExpenditure = async (req, res) => {
  try {
    const expenditureId = req.params.id;
    let {
      eventName,
      eventType,
      eventDate,
      description,
      expenseItems
    } = req.body;

    // Handle JSON string if sent via FormData
    if (typeof expenseItems === 'string') {
      try {
        expenseItems = JSON.parse(expenseItems);
      } catch (e) {
        console.error('Error parsing expenseItems JSON in resubmit:', e);
      }
    }

    // Map uploaded files to expense items if metadata exists
    if (req.uploadedFiles && req.uploadedFiles.length > 0 && Array.isArray(expenseItems)) {
      let fileIdx = 0;
      expenseItems.forEach(item => {
        item.attachments = item.attachments || [];
        const count = item.fileCount || 0;
        for (let i = 0; i < count; i++) {
          if (req.uploadedFiles[fileIdx]) {
            item.attachments.push(req.uploadedFiles[fileIdx]);
            fileIdx++;
          }
        }
      });
    }

    const originalExpenditure = await Expenditure.findById(expenditureId);
    if (!originalExpenditure) {
      return res.status(404).json({
        success: false,
        message: 'Original expenditure not found'
      });
    }

    // Check if user can resubmit this expenditure
    if (originalExpenditure.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only resubmit your own expenditures'
      });
    }

    // Check if expenditure is rejected
    if (originalExpenditure.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only rejected expenditures can be resubmitted'
      });
    }

    // Check 1: Cannot resubmit a record that is ALREADY a resubmission (Limit depth to 1)
    if (originalExpenditure.isResubmission) {
      return res.status(400).json({
        success: false,
        message: 'This expenditure was already a resubmission. Following the "One Time Resend" policy, you cannot resubmit it again.'
      });
    }

    // Check 2: Check if this specific record has already been resubmitted
    const existingResubmission = await Expenditure.findOne({ originalExpenditureId: expenditureId });
    if (existingResubmission) {
      return res.status(400).json({
        success: false,
        message: 'This expenditure has already been resubmitted once. Multiple resubmissions are not allowed.'
      });
    }

    // Compute date and totals
    const eventDateObj = new Date(eventDate || originalExpenditure.eventDate);
    const resolvedItems = Array.isArray(expenseItems) && expenseItems.length > 0
      ? expenseItems
      : originalExpenditure.expenseItems;
    const totalAmount = resolvedItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

    // Create new expenditure based on original
    const newExpenditure = await Expenditure.create([{
      department: originalExpenditure.department,
      budgetHead: originalExpenditure.budgetHead,
      eventName: eventName || originalExpenditure.eventName,
      eventType: eventType || originalExpenditure.eventType,
      eventDate: eventDateObj,
      description: description || originalExpenditure.description,
      expenseItems: resolvedItems.map(item => ({
        ...item,
        category: item.category || 'MISCELLANEOUS',
        amount: Number(item.amount) || 0,
        billDate: item.billDate ? new Date(item.billDate) : new Date()
      })),
      totalAmount,
      submittedBy: req.user._id,
      financialYear: originalExpenditure.financialYear,
      status: 'pending',
      isResubmission: true,
      originalExpenditureId: expenditureId
    }]);

    // Log the resubmission
    await recordAuditLog({
      eventType: 'expenditure_resubmitted',
      req,
      targetEntity: 'Expenditure',
      targetId: newExpenditure[0]._id,
      details: {
        originalExpenditureId: expenditureId,
        eventName: newExpenditure[0].eventName,
        totalAmount: newExpenditure[0].totalAmount
      },
      newValues: newExpenditure[0]
    });

    const populatedExpenditure = await Expenditure.findById(newExpenditure[0]._id)
      .populate('department', 'name code')
      .populate('budgetHead', 'name category')
      .populate('submittedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Expenditure resubmitted successfully',
      data: { expenditure: populatedExpenditure }
    });
  } catch (error) {
    console.error('Resubmit expenditure error:', error);

    // Provide detailed error for validation failures
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed: ' + messages.join(', '),
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while resubmitting expenditure',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get expenditure statistics
// @route   GET /api/expenditures/stats
// @access  Private
const getExpenditureStats = async (req, res) => {
  try {
    const { financialYear, department } = req.query;

    const query = {};
    if (financialYear) query.financialYear = financialYear;
    if (department) query.department = department;

    // Apply department filter for department users
    if (req.user.role === 'department' || req.user.role === 'hod') {
      query.department = req.user.department;
    }

    const stats = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const totalStats = await Expenditure.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalExpenditures: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          pendingAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, '$totalAmount', 0]
            }
          },
          approvedAmount: {
            $sum: {
              $cond: [{ $eq: ['$status', 'approved'] }, '$totalAmount', 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        summary: totalStats[0] || {
          totalExpenditures: 0,
          totalAmount: 0,
          pendingAmount: 0,
          approvedAmount: 0
        }
      }
    });
  } catch (error) {
    console.error('Get expenditure stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching expenditure statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getExpenditures,
  getExpenditureById,
  submitExpenditure,
  approveExpenditure,
  rejectExpenditure,
  verifyExpenditure,
  finalizeExpenditure,
  resubmitExpenditure,
  getExpenditureStats
};
