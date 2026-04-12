const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const invoice = require('../controllers/invoiceController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', invoice.create);
router.get('/', invoice.list);
router.get('/next-number', invoice.getNextNumber);
router.post('/preview-html', invoice.previewHtml);
router.get('/:id/pdf', invoice.pdf);
router.get('/:id', invoice.getOne);
router.put('/:id', invoice.update);
router.delete('/:id', invoice.remove);

module.exports = router;
