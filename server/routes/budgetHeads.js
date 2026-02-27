const express = require('express');
const router = express.Router();
const {
  getBudgetHeads,
  getBudgetHeadById,
  createBudgetHead,
  updateBudgetHead,
  deleteBudgetHead,
  getBudgetHeadStats,
  getBudgetHeadDetail
} = require('../controllers/budgetHeadController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Allow all authorized users to view budget heads
router.get('/stats', getBudgetHeadStats);
router.get('/', getBudgetHeads);
router.get('/:id/detail', getBudgetHeadDetail);
router.get('/:id', getBudgetHeadById);

// Admin, office, and management/department routes for modification
router.post('/', authorize('admin', 'office', 'principal', 'vice_principal', 'hod', 'department'), createBudgetHead);
router.put('/:id', authorize('admin', 'office', 'principal', 'vice_principal', 'hod', 'department'), updateBudgetHead);
router.delete('/:id', authorize('admin', 'office', 'principal', 'vice_principal', 'hod', 'department'), deleteBudgetHead);

module.exports = router;
