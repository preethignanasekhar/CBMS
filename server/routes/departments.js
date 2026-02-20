const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentStats,
  getDepartmentDetail
} = require('../controllers/departmentController');
const { verifyToken, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Department detail route - accessible by department users for their own dept, or elevated roles
router.get('/:id/detail', getDepartmentDetail);

// Allow authorized roles to view department list
router.get('/', authorize('admin', 'principal', 'vice_principal', 'office', 'auditor', 'hod', 'department'), getDepartments);
router.get('/stats', authorize('admin', 'principal', 'vice_principal', 'office', 'auditor'), getDepartmentStats);

// All other routes require admin access
router.use(authorize('admin'));
router.get('/:id', getDepartmentById);
router.post('/', createDepartment);
router.put('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);

module.exports = router;
