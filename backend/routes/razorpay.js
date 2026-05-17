const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  saveKeys,
  removeKeys,
  getStatus,
  createOrder,
  verifyPayment,
} = require('../controllers/razorpayController');

// Business endpoints — key management
router.post('/keys', authMiddleware, requireRole('business'), saveKeys);
router.delete('/keys', authMiddleware, requireRole('business'), removeKeys);
router.get('/status', authMiddleware, requireRole('business'), getStatus);

// Customer endpoints — payment flow
router.post('/create-order', authMiddleware, requireRole('customer'), createOrder);
router.post('/verify', authMiddleware, requireRole('customer'), verifyPayment);

module.exports = router;
