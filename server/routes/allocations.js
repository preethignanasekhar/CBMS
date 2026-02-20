const express = require('express');
const router = express.Router();
const {
  getAllocations,
  getAllocationById,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  getAllocationStats,
  bulkCreateAllocations,
  getYearComparison
} = require('../controllers/allocationController');
const {
  getAllocationHistory,
  getAllocationVersion,
  rollbackAllocation
} = require('../controllers/allocationHistoryController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// All routes require office access or higher
router.use(authorize('office', 'vice_principal', 'principal', 'admin', 'hod', 'department'));

router.get('/', getAllocations);
router.get('/stats', getAllocationStats);
// Add specific routes before parameterized routes
router.get('/year-comparison', getYearComparison);
router.get('/:id', getAllocationById);
router.post('/', createAllocation);
router.post('/bulk', bulkCreateAllocations);
router.put('/:id', updateAllocation);
router.delete('/:id', deleteAllocation);

// History routes
router.get('/:id/history', getAllocationHistory);
router.get('/:id/history/:version', getAllocationVersion);
router.post('/:id/rollback/:version', authorize('admin', 'office'), rollbackAllocation);

module.exports = router;
