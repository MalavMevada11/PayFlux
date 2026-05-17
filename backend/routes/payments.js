const express = require('express');
const payments = require('../controllers/paymentController');

const router = express.Router();

router.get('/:invoiceId/payments', payments.listPayments);
router.post('/:invoiceId/payments', payments.addPayment);
router.delete('/:invoiceId/payments/:paymentId', payments.deletePayment);

module.exports = router;
