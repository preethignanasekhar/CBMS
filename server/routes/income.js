const express = require('express');
const router = express.Router();
const { verifyToken, authorize } = require('../middleware/auth');
const {
    getIncomes,
    getIncomeById,
    createIncome,
    updateIncome,
    verifyIncome,
    deleteIncome,
    getIncomeStats
} = require('../controllers/incomeController');

// All routes require authentication
router.use(verifyToken);

// Get income statistics (all authenticated users)
router.get('/stats', getIncomeStats);

// Get all incomes (all authenticated users can view)
router.get('/', getIncomes);

// Get income by ID
router.get('/:id', getIncomeById);

// Create new income (office/admin only)
router.post('/', authorize('office', 'admin', 'principal'), createIncome);

// Update income (office/admin only)
router.put('/:id', authorize('office', 'admin', 'principal'), updateIncome);

// Verify income (principal/admin only)
router.put('/:id/verify', authorize('principal', 'admin'), verifyIncome);

// Delete income (admin only)
router.delete('/:id', authorize('admin'), deleteIncome);

module.exports = router;
