const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  getMyInvoices,
  getInvoiceDetail,
  getMyPayments,
  getDashboardStats,
  portalPdf,
} = require('../controllers/portalController');

// All portal routes require authentication + customer (or admin) role
router.use(authMiddleware, requireRole('customer', 'admin'));

router.get('/stats', getDashboardStats);
router.get('/invoices', getMyInvoices);
router.get('/invoices/:id/pdf', portalPdf);
router.get('/invoices/:id', getInvoiceDetail);
router.get('/payments', getMyPayments);

module.exports = router;
