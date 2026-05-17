const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  getDashboardStats,
  listUsers,
  getUserDetail,
  updateUserRole,
  listBusinesses,
  listAllPayments,
} = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(authMiddleware, requireRole('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/role', updateUserRole);
router.get('/businesses', listBusinesses);
router.get('/payments', listAllPayments);

module.exports = router;
