const express = require('express');
const router = express.Router();
const { verifyToken, authorize } = require('../middleware/auth');
const {
    getFinancialYears,
    getFinancialYearById,
    createFinancialYear,
    recalculateTotals,
    lockFinancialYear,
    closeFinancialYear,
    getActiveFinancialYear,
    getYearSummary
} = require('../controllers/financialYearController');

// All routes require authentication
router.use(verifyToken);

// Get active financial year (all authenticated users)
router.get('/active', getActiveFinancialYear);

// Get all financial years (all authenticated users can view)
router.get('/', getFinancialYears);

// Get financial year by ID
router.get('/:id', getFinancialYearById);

// Get year summary with detailed statistics
router.get('/:id/summary', getYearSummary);

// Create new financial year (admin/principal only)
router.post('/', authorize('admin', 'principal'), createFinancialYear);

// Recalculate totals (admin/principal only)
router.put('/:id/recalculate', authorize('admin', 'principal'), recalculateTotals);

// Lock financial year (principal/admin only)
router.put('/:id/lock', authorize('principal', 'admin'), lockFinancialYear);

// Close financial year (principal/admin only)
router.put('/:id/close', authorize('principal', 'admin'), closeFinancialYear);

module.exports = router;
