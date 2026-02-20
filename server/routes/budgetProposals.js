const express = require('express');
const router = express.Router();
const {
  getBudgetProposals,
  getBudgetProposalById,
  createBudgetProposal,
  updateBudgetProposal,
  submitBudgetProposal,
  approveBudgetProposal,
  rejectBudgetProposal,
  deleteBudgetProposal,
  getBudgetProposalsStats,
  verifyBudgetProposal,
  resubmitBudgetProposal,
  markProposalAsRead
} = require('../controllers/budgetProposalController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get stats (accessible to authorized roles)
router.get('/stats', authorize('admin', 'principal', 'vice_principal', 'office', 'hod', 'department_staff', 'department'), getBudgetProposalsStats);

// Get all proposals (accessible to authorized roles)
router.get('/', authorize('admin', 'principal', 'vice_principal', 'office', 'hod', 'department_staff', 'department'), getBudgetProposals);

// Get proposal by ID
router.get('/:id', getBudgetProposalById);

// Create new proposal (department HOD/staff)
router.post('/', authorize('hod', 'department_staff', 'department'), createBudgetProposal);

// Update proposal (only draft/revised proposals by creator)
router.put('/:id', authorize('hod', 'department_staff', 'department'), updateBudgetProposal);

// Submit proposal (only draft/revised proposals by creator)
router.put('/:id/submit', authorize('hod', 'department_staff', 'department'), submitBudgetProposal);

// Delete proposal (only draft/rejected proposals)
router.delete('/:id', authorize('hod', 'department_staff', 'department', 'admin'), deleteBudgetProposal);

// Approve proposal (admin/principal/vice principal/office)
router.put('/:id/approve', authorize('admin', 'principal', 'vice_principal', 'office'), approveBudgetProposal);

// Verify proposal (admin/office/hod/principal/vice_principal)
router.put('/:id/verify', authorize('admin', 'office', 'hod', 'principal', 'vice_principal'), verifyBudgetProposal);

// Reject proposal (admin/principal/vice principal/office/hod)
router.put('/:id/reject', authorize('admin', 'principal', 'vice_principal', 'office', 'hod'), rejectBudgetProposal);

// Mark proposal as read
router.put('/:id/read', markProposalAsRead);

// Resubmit proposal
router.post('/:id/resubmit', authorize('hod', 'department_staff', 'department'), resubmitBudgetProposal);

module.exports = router;
