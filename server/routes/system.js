const express = require('express');
const router = express.Router();
const { getConcurrencyStatus, bulkSetup } = require('../controllers/systemController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Get system concurrency status (Admin, Office)
router.get('/concurrency-status', authorize('admin', 'office'), getConcurrencyStatus);

// Bulk setup departments and users (Admin only)
router.post('/bulk-setup', authorize('admin'), bulkSetup);

module.exports = router;
