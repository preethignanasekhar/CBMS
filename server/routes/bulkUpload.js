const express = require('express');
const router = express.Router();
const { verifyToken, authorize } = require('../middleware/auth');
const { handleCSVUpload, handleCSVUploadError } = require('../middleware/csvUpload');
const {
    downloadTemplate,
    bulkUploadAllocations,
    getUploadHistory,
    getUploadById
} = require('../controllers/bulkAllocationController');

// All routes require authentication
router.use(verifyToken);

// Download CSV template (all authenticated users can download)
router.get('/template', downloadTemplate);

// Bulk upload allocations (office only)
router.post('/',
    authorize('office', 'admin'),
    handleCSVUpload,
    handleCSVUploadError,
    bulkUploadAllocations
);

// Get upload history (office only)
router.get('/history', authorize('office', 'admin'), getUploadHistory);

// Get specific upload details (office only)
router.get('/:id', authorize('office', 'admin'), getUploadById);

module.exports = router;
