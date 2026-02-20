/**
 * AI Routes for CBMS
 * All routes require authentication.
 */

const express = require('express');
const router = express.Router();
const {
    getAnomalies,
    getRiskScores,
    getApprovalPriority,
    getYearComparison,
    getInsights,
    getSystemHealth,
    getDashboardSummary
} = require('../controllers/aiController');

// Import auth middleware
const { verifyToken, authorize } = require('../middleware/auth');

// All AI routes require authentication
router.use(verifyToken);

// Dashboard summary (combined data)
router.get('/dashboard', authorize('admin', 'office', 'principal', 'vice_principal'), getDashboardSummary);

// Anomaly detection
router.get('/anomalies', authorize('admin', 'office', 'principal', 'vice_principal'), getAnomalies);

// Risk scores
router.get('/risk-scores', authorize('admin', 'office', 'principal', 'vice_principal'), getRiskScores);

// Approval prioritization
router.get('/approval-priority', authorize('admin', 'office', 'principal', 'vice_principal', 'hod'), getApprovalPriority);

// Year-over-year comparison
router.get('/year-comparison', authorize('admin', 'office', 'principal', 'vice_principal'), getYearComparison);

// AI insights
router.get('/insights', authorize('admin', 'office', 'principal', 'vice_principal'), getInsights);

// System health (admin only)
router.get('/health', authorize('admin'), getSystemHealth);

module.exports = router;
