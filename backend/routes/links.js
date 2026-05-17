const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  generateCompanyCode,
  generateCustomerCode,
  connectByCode,
  getMyLinks,
  removeLink,
  getMyInviteCodes,
} = require('../controllers/linkController');

// All link routes require authentication
router.use(authMiddleware);

// Generate invite codes
router.post('/company-code', requireRole('business'), generateCompanyCode);
router.post('/customer-code', requireRole('customer'), generateCustomerCode);

// Connect using a code (both roles can use)
router.post('/connect', requireRole('business', 'customer'), connectByCode);

// List links
router.get('/', requireRole('admin', 'business', 'customer'), getMyLinks);

// Get my invite codes
router.get('/invites', requireRole('business', 'customer'), getMyInviteCodes);

// Remove a link
router.delete('/:id', requireRole('admin', 'business', 'customer'), removeLink);

module.exports = router;
