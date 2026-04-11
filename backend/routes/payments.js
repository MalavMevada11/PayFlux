const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const payments = require('../controllers/paymentController');

const router = express.Router();
router.use(authMiddleware);

router.get('/:invoiceId/payments', payments.listPayments);
router.post('/:invoiceId/payments', payments.addPayment);
router.delete('/:invoiceId/payments/:paymentId', payments.deletePayment);

module.exports = router;
