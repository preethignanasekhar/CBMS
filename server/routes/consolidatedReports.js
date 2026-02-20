const express = require('express');
const router = express.Router();
const {
  getConsolidatedBudgetReport,
  getBudgetUtilizationDashboard,
  getFundUtilizationTrend
} = require('../controllers/consolidatedReportController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get consolidated budget report (with YoY comparison)
router.get('/', authorize('admin', 'principal', 'vice_principal', 'office', 'auditor'), getConsolidatedBudgetReport);

// Get budget utilization dashboard
router.get('/utilization', authorize('admin', 'principal', 'vice_principal', 'office', 'auditor'), getBudgetUtilizationDashboard);

// Get fund utilization trend (monthly)
router.get('/trend', authorize('admin', 'principal', 'vice_principal', 'office', 'auditor'), getFundUtilizationTrend);

module.exports = router;
