const express = require('express');
const router = express.Router();
const {
  getExpenditureReport,
  getAllocationReport,
  getDashboardReport,
  getAuditReport,
  getBudgetProposalReport
} = require('../controllers/reportController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Report routes
router.get('/expenditures', getExpenditureReport);
router.get('/allocations', getAllocationReport);
router.get('/dashboard', getDashboardReport);
router.get('/proposals', getBudgetProposalReport);

// Admin only routes
router.get('/audit', authorize('admin'), getAuditReport);

module.exports = router;
