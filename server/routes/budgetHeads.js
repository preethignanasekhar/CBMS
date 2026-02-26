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

// Admin only routes for modification
router.post('/', authorize('admin'), createBudgetHead);
router.put('/:id', authorize('admin'), updateBudgetHead);
router.delete('/:id', authorize('admin'), deleteBudgetHead);

module.exports = router;
