const express = require('express');
const router = express.Router();
const {
  getExpenditures,
  getExpenditureById,
  submitExpenditure,
  approveExpenditure,
  rejectExpenditure,
  verifyExpenditure,
  finalizeExpenditure,
  resubmitExpenditure,
  getExpenditureStats
} = require('../controllers/expenditureController');
const { verifyToken, authorize } = require('../middleware/auth');
const { handleFileUpload } = require('../middleware/fileUpload');
const { validateAttachments, validateAttachmentsForApproval } = require('../middleware/attachmentValidator');

// All routes require authentication
router.use(verifyToken);

const attachFilesToBody = (req, res, next) => {
  if (req.uploadedFiles) {
    req.body.attachments = req.uploadedFiles;
  }
  next();
};

// Get expenditures (all authenticated users)
router.get('/', getExpenditures);
router.get('/stats', getExpenditureStats);
router.get('/:id', getExpenditureById);

// Submit expenditure (department users only)
router.post('/',
  authorize('department'),
  handleFileUpload,
  attachFilesToBody,
  validateAttachments,
  submitExpenditure
);

// Resubmit expenditure (department users only)
router.post('/:id/resubmit',
  authorize('department'),
  handleFileUpload,
  attachFilesToBody,
  resubmitExpenditure
);

// Verify expenditure (HOD, Office, Principal, Vice Principal)
router.put('/:id/verify', authorize('hod', 'office', 'principal', 'vice_principal'), verifyExpenditure);

// Approve expenditure (Office, Vice Principal, Principal)
router.put('/:id/approve',
  authorize('office', 'vice_principal', 'principal'),
  validateAttachmentsForApproval,
  approveExpenditure
);

// Reject expenditure (Office, Vice Principal, Principal, HOD)
router.put('/:id/reject',
  authorize('office', 'vice_principal', 'principal', 'hod'),
  rejectExpenditure
);

module.exports = router;
