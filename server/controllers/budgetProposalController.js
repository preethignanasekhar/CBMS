const BudgetProposal = require('../models/BudgetProposal');
const Department = require('../models/Department');
const BudgetHead = require('../models/BudgetHead');
const Allocation = require('../models/Allocation');
const AllocationHistory = require('../models/AllocationHistory');
const AuditLog = require('../models/AuditLog');
const { recordAuditLog } = require('../utils/auditService');
const { notifyProposalSubmission, notifyProposalStatusChange } = require('../utils/notificationService');

// @desc    Get all budget proposals
// @route   GET /api/budget-proposals
// @access  Private
const getBudgetProposals = async (req, res) => {
  try {
    const { financialYear, department, status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (financialYear) query.financialYear = financialYear;

    // Status filtering
    if (status) {
      query.status = status;
    }

    // Role-based visibility and default filtering if status not provided
    if (['department', 'hod'].includes(req.user.role)) {
      query.department = req.user.department;
    } else if (department) {
      query.department = department;
    }

    // Smart default filtering based on role if no status is explicitly requested
    if (!status) {
      if (req.user.role === 'hod') {
        // HOD can see all department proposals in history/list views
        // Only restrict to 'submitted' if explicitly asked (like in approvals queue)
        // For standard GET, we allow all except maybe drafts if not requested
      } else if (['principal', 'vice_principal'].includes(req.user.role)) {
        // Default Principal view: content verified by HOD
        if (!query.status) query.status = 'verified_by_hod';
      } else if (req.user.role === 'office') {
        // Default Office view: content verified by Principal
        if (!query.status) query.status = 'verified_by_principal';
      }
    }

    console.log(`[Debug] getBudgetProposals - Final Query:`, query);

    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      BudgetProposal.find(query)
        .populate('department', 'name code')
        .populate('proposalItems.budgetHead', 'name category budgetType')
        .populate('submittedBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BudgetProposal.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        proposals,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching budget proposals',
      error: error.message
    });
  }
};

// @desc    Get budget proposal by ID
// @route   GET /api/budget-proposals/:id
// @access  Private
const getBudgetProposalById = async (req, res) => {
  try {
    const proposal = await BudgetProposal.findById(req.params.id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role')
      .populate('lastModifiedBy', 'name email');

    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    res.status(200).json({
      success: true,
      data: proposal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching budget proposal',
      error: error.message
    });
  }
};

// @desc    Mark proposal as read by current user
// @route   PUT /api/budget-proposals/:id/read
// @access  Private
const markProposalAsRead = async (req, res) => {
  try {
    const proposal = await BudgetProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    if (!proposal.readBy.includes(req.user._id)) {
      proposal.readBy.push(req.user._id);
      await proposal.save();
    }

    res.status(200).json({
      success: true,
      message: 'Proposal marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking proposal as read',
      error: error.message
    });
  }
};

// @desc    Create budget proposal
// @route   POST /api/budget-proposals
// @access  Private (HOD/Staff)
const createBudgetProposal = async (req, res) => {
  try {
    const { financialYear, proposalItems, notes } = req.body;

    // Check if a proposal already exists for this department and year
    const existingProposal = await BudgetProposal.findOne({
      financialYear,
      department: req.user.department,
      status: { $ne: 'rejected' }
    });

    if (existingProposal && existingProposal.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `A proposal already exists for ${financialYear} and is currently ${existingProposal.status}`
      });
    }

    const proposal = await BudgetProposal.create({
      financialYear,
      department: req.user.department,
      proposalItems,
      notes,
      submittedBy: req.user._id,
      lastModifiedBy: req.user._id,
      status: 'draft'
    });

    await recordAuditLog({
      eventType: 'budget_proposal_created',
      req,
      targetEntity: 'BudgetProposal',
      targetId: proposal._id,
      details: { financialYear }
    });

    res.status(201).json({
      success: true,
      data: proposal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating budget proposal',
      error: error.message
    });
  }
};

// @desc    Update budget proposal
// @route   PUT /api/budget-proposals/:id
// @access  Private (HOD/Staff)
const updateBudgetProposal = async (req, res) => {
  try {
    const { proposalItems, notes } = req.body;

    let proposal = await BudgetProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Only allow updating drafts or revised proposals
    if (!['draft', 'revised'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or revised proposals can be updated'
      });
    }

    proposal.proposalItems = proposalItems || proposal.proposalItems;
    proposal.notes = notes || proposal.notes;
    proposal.lastModifiedBy = req.user._id;

    await proposal.save();

    await recordAuditLog({
      eventType: 'budget_proposal_updated',
      req,
      targetEntity: 'BudgetProposal',
      targetId: proposal._id
    });

    res.status(200).json({
      success: true,
      data: proposal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating budget proposal',
      error: error.message
    });
  }
};

// @desc    Submit budget proposal
// @route   PUT /api/budget-proposals/:id/submit
// @access  Private (HOD/Staff)
const submitBudgetProposal = async (req, res) => {
  try {
    let proposal = await BudgetProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    if (!['draft', 'revised'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or revised proposals can be submitted'
      });
    }

    proposal.status = 'submitted';
    proposal.submittedDate = new Date();
    proposal.lastModifiedBy = req.user._id;

    await proposal.save();

    await recordAuditLog({
      eventType: 'budget_proposal_submitted',
      req,
      targetEntity: 'BudgetProposal',
      targetId: proposal._id
    });

    // Notify HOD
    const populatedProposal = await BudgetProposal.findById(proposal._id).populate('department', 'name');
    await notifyProposalSubmission(populatedProposal);

    res.status(200).json({
      success: true,
      data: proposal
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error submitting budget proposal',
      error: error.message
    });
  }
};


// @desc    Approve budget proposal
// @route   PUT /api/budget-proposals/:id/approve
// @access  Private (Admin/Principal/Vice Principal/Office)
const approveBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const proposal = await BudgetProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Role check for approval - Office Only (Final Step)
    const allowedApprovalRoles = ['office', 'admin'];
    if (!allowedApprovalRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only Office or Admin can perform final approval and budget allocation'
      });
    }

    // Must be read by the approver
    if (!proposal.readBy.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You must read the proposal before approving it'
      });
    }

    // Must be verified by Principal/VP first
    if (proposal.status !== 'verified_by_principal' && proposal.status !== 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Only proposals verified by Principal/VP can be approved by Office'
      });
    }

    proposal.status = 'approved';
    proposal.approvedDate = new Date();
    proposal.approvedBy = req.user._id;
    if (notes) proposal.notes = notes;
    proposal.lastModifiedBy = req.user._id;

    // Add approval step
    proposal.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'approve',
      remarks: notes || '',
      timestamp: new Date()
    });

    await proposal.save();

    // GOVERNANCE: Auto-create allocations from approved proposal items
    const createdAllocations = [];
    const allocationErrors = [];

    // Extract approved amounts from request body (if provided)
    // Structure: approvedAmounts: [{ budgetHead: 'id', amount: 1000 }]
    const { approvedAmounts } = req.body;
    const approvedAmountsMap = {};
    if (approvedAmounts && Array.isArray(approvedAmounts)) {
      approvedAmounts.forEach(item => {
        if (item.budgetHead && item.amount !== undefined) {
          approvedAmountsMap[item.budgetHead.toString()] = parseFloat(item.amount);
        }
      });
    }

    try {
      for (const item of proposal.proposalItems) {
        try {
          // Check if allocation already exists
          const existingAllocation = await Allocation.findOne({
            financialYear: proposal.financialYear,
            department: proposal.department,
            budgetHead: item.budgetHead
          });

          if (existingAllocation) {
            console.log(`Allocation already exists for ${item.budgetHead}, skipping auto-creation`);
            allocationErrors.push({
              budgetHead: item.budgetHead,
              reason: 'Allocation already exists'
            });
            continue;
          }

          // Determine final allocated amount
          // Use override if present, otherwise default to proposed amount
          let finalAmount = item.proposedAmount;
          const bhId = item.budgetHead.toString();
          if (approvedAmountsMap[bhId] !== undefined) {
            const overrideAmount = approvedAmountsMap[bhId];
            if (!isNaN(overrideAmount) && overrideAmount >= 0) {
              finalAmount = overrideAmount;
            }
          }

          // Create allocation
          const allocation = await Allocation.create({
            financialYear: proposal.financialYear,
            department: proposal.department,
            budgetHead: item.budgetHead,
            allocatedAmount: finalAmount,
            remarks: item.justification || 'Created from approved budget proposal',
            sourceProposalId: proposal._id,
            status: 'active',
            createdBy: req.user._id
          });

          // Create initial history record
          await AllocationHistory.create({
            allocationId: allocation._id,
            version: 1,
            changeType: 'created',
            snapshot: {
              department: allocation.department,
              budgetHead: allocation.budgetHead,
              allocatedAmount: allocation.allocatedAmount,
              spentAmount: 0,
              financialYear: allocation.financialYear,
              remarks: allocation.remarks
            },
            changes: {},
            changeReason: `Auto-created from approved budget proposal ${proposal._id}`,
            changedBy: req.user._id
          });

          createdAllocations.push(allocation._id);
        } catch (itemError) {
          console.error(`Error creating allocation for budget head ${item.budgetHead}: `, itemError.message);
          allocationErrors.push({
            budgetHead: item.budgetHead,
            error: itemError.message
          });
        }
      }
    } catch (error) {
      console.error('Error auto-creating allocations:', error.message);
    }

    const updatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_approved',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: {
        approvedDate: proposal.approvedDate,
        notes
      }
    });

    res.status(200).json({
      success: true,
      data: {
        proposal: updatedProposal,
        allocationsCreated: createdAllocations.length,
        allocationIds: createdAllocations,
        allocationErrors: allocationErrors.length > 0 ? allocationErrors : undefined
      },
      message: `Budget proposal approved successfully.${createdAllocations.length} allocation(s) created automatically.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving budget proposal',
      error: error.message
    });
  }
};

// @desc    Verify budget proposal
// @route   PUT /api/budget-proposals/:id/verify
// @access  Private (HOD/Office)
const verifyBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const proposal = await BudgetProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Check permissions
    // HOD verifies first. Then Principal/VP verifies.
    const allowedVerifyRoles = ['hod', 'principal', 'vice_principal'];
    if (!allowedVerifyRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to verify budget proposals'
      });
    }

    // Must be read by the verifier
    if (!proposal.readBy.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You must read the proposal before verifying it'
      });
    }

    let searchStatus = '';
    let nextStatus = '';

    if (req.user.role === 'hod') {
      if (proposal.department.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only verify proposals from your department'
        });
      }

      if (proposal.status !== 'submitted') {
        return res.status(400).json({
          success: false,
          message: 'HOD can only verify submitted proposals'
        });
      }
      nextStatus = 'verified_by_hod';

    } else if (['principal', 'vice_principal'].includes(req.user.role)) {
      if (proposal.status !== 'verified_by_hod' && proposal.status !== 'verified') {
        return res.status(400).json({
          success: false,
          message: 'Principal/VP can only verify proposals verified by HOD'
        });
      }

      // Check if another Principal/VP has already verified (one of them wins)
      const principalVerified = proposal.approvalSteps.some(step => ['principal', 'vice_principal'].includes(step.role) && step.decision === 'verify');
      if (principalVerified) {
        return res.status(400).json({
          success: false,
          message: 'Proposal has already been verified by Principal/VP'
        });
      }
      nextStatus = 'verified_by_principal';
    }

    proposal.status = nextStatus;
    proposal.lastModifiedBy = req.user._id;

    // Add verification step
    proposal.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'verify',
      remarks: remarks || '',
      timestamp: new Date()
    });

    await proposal.save();

    const populatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_verified',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: { remarks, newStatus: nextStatus }
    });

    // Notify Submittor
    await notifyProposalStatusChange(populatedProposal, 'verify', remarks);

    res.json({
      success: true,
      message: 'Budget proposal verified successfully',
      data: { proposal: populatedProposal }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// @desc    Reject budget proposal
// @route   PUT /api/budget-proposals/:id/reject
// @access  Private (Admin/Principal/Vice Principal/Office/HOD)
const rejectBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const proposal = await BudgetProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Role check for rejection
    const allowedRejectRoles = ['admin', 'principal', 'vice_principal', 'office', 'hod'];
    if (!allowedRejectRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reject budget proposals'
      });
    }

    if (!['submitted', 'verified'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only submitted or verified proposals can be rejected'
      });
    }

    proposal.status = 'rejected';
    proposal.rejectionReason = rejectionReason;
    proposal.lastModifiedBy = req.user._id;

    // Add rejection step
    proposal.approvalSteps.push({
      approver: req.user._id,
      role: req.user.role,
      decision: 'reject',
      remarks: rejectionReason,
      timestamp: new Date()
    });

    await proposal.save();

    const updatedProposal = await BudgetProposal.findById(id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email')
      .populate('approvalSteps.approver', 'name email role');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_rejected',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: { rejectionReason }
    });

    // Notify Submittor
    await notifyProposalStatusChange(updatedProposal, 'reject', rejectionReason);

    res.status(200).json({
      success: true,
      data: { proposal: updatedProposal },
      message: 'Budget proposal rejected'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting budget proposal',
      error: error.message
    });
  }
};

// @desc    Resubmit budget proposal (creates a new draft from rejected)
// @route   POST /api/budget-proposals/:id/resubmit
// @access  Private
const resubmitBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const originalProposal = await BudgetProposal.findById(id);
    if (!originalProposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    if (originalProposal.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Only rejected proposals can be resubmitted'
      });
    }

    // Authorization check
    if (['department', 'hod'].includes(req.user.role)) {
      if (originalProposal.department.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only resubmit proposals for your own department'
        });
      }
    }

    // Create a new draft based on the original
    const newProposal = await BudgetProposal.create({
      financialYear: originalProposal.financialYear,
      department: originalProposal.department,
      proposalItems: originalProposal.proposalItems.map(item => ({
        budgetHead: item.budgetHead,
        proposedAmount: item.proposedAmount,
        justification: item.justification,
        previousYearUtilization: item.previousYearUtilization
      })),
      notes: `Resubmission of rejected proposal ${id}. ${originalProposal.notes || ''} `,
      status: 'draft',
      submittedBy: req.user._id
    });

    // Update original proposal as 'revised'
    originalProposal.status = 'revised';
    await originalProposal.save();

    const populatedProposal = await BudgetProposal.findById(newProposal._id)
      .populate('department', 'name code')
      .populate('proposalItems.budgetHead', 'name category budgetType')
      .populate('submittedBy', 'name email');

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_created',
      req,
      targetEntity: 'BudgetProposal',
      targetId: newProposal._id,
      details: {
        isResubmission: true,
        originalProposalId: id
      }
    });

    // Notify HOD
    await notifyProposalSubmission(populatedProposal);

    res.status(201).json({
      success: true,
      data: { proposal: populatedProposal },
      message: 'Draft created from rejected proposal'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error resubmitting budget proposal',
      error: error.message
    });
  }
};

// @desc    Get budget proposals stats
// @route   GET /api/budget-proposals/stats
// @access  Private
const getBudgetProposalsStats = async (req, res) => {
  try {
    const { financialYear } = req.query;

    const query = {};
    if (financialYear) query.financialYear = financialYear;

    // Department and HOD users get stats for their own department only
    if (['department', 'hod'].includes(req.user.role)) {
      query.department = req.user.department;
    }

    const [
      totalProposals,
      submittedProposals,
      approvedProposals,
      rejectedProposals,
      draftProposals,
      totalApprovedAmount
    ] = await Promise.all([
      BudgetProposal.countDocuments(query),
      BudgetProposal.countDocuments({ ...query, status: { $in: ['submitted', 'verified_by_hod', 'verified_by_principal', 'verified'] } }),
      BudgetProposal.countDocuments({ ...query, status: 'approved' }),
      BudgetProposal.countDocuments({ ...query, status: 'rejected' }),
      BudgetProposal.countDocuments({ ...query, status: 'draft' }),
      BudgetProposal.aggregate([
        { $match: { ...query, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$totalProposedAmount' } } }
      ])
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProposals,
        submittedProposals,
        approvedProposals,
        rejectedProposals,
        draftProposals,
        totalApprovedAmount: totalProposedAmount[0]?.total || 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching budget proposals stats',
      error: error.message
    });
  }
};

// @desc    Delete budget proposal
// @route   DELETE /api/budget-proposals/:id
// @access  Private
const deleteBudgetProposal = async (req, res) => {
  try {
    const { id } = req.params;

    const proposal = await BudgetProposal.findById(id).populate('department');
    if (!proposal) {
      return res.status(404).json({
        success: false,
        message: 'Budget proposal not found'
      });
    }

    // Only allow deletion of draft or rejected proposals
    if (!['draft', 'rejected'].includes(proposal.status)) {
      return res.status(400).json({
        success: false,
        message: 'Only draft or rejected proposals can be deleted'
      });
    }

    // Department and HOD users can only delete their own department's proposals
    if (['department', 'hod'].includes(req.user.role)) {
      if (proposal.department._id.toString() !== req.user.department.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete proposals from your own department'
        });
      }
      // Department users can only delete their own proposals; HOD can delete any in their dept
      if (req.user.role === 'department' && proposal.submittedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own proposals'
        });
      }
    }

    // Delete the proposal
    await BudgetProposal.findByIdAndDelete(id);

    // Log audit
    await recordAuditLog({
      eventType: 'budget_proposal_deleted',
      req,
      targetEntity: 'BudgetProposal',
      targetId: id,
      details: {
        financialYear: proposal.financialYear,
        department: proposal.department.name
      },
      previousValues: proposal.toObject()
    });

    res.status(200).json({
      success: true,
      message: 'Budget proposal deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting budget proposal',
      error: error.message
    });
  }
};

module.exports = {
  getBudgetProposals,
  getBudgetProposalById,
  createBudgetProposal,
  updateBudgetProposal,
  submitBudgetProposal,
  resubmitBudgetProposal,
  verifyBudgetProposal,
  approveBudgetProposal,
  rejectBudgetProposal,
  deleteBudgetProposal,
  getBudgetProposalsStats,
  markProposalAsRead
};
