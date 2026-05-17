const express = require('express');
const invoice = require('../controllers/invoiceController');

const router = express.Router();
router.post('/', invoice.create);
router.get('/', invoice.list);
router.get('/next-number', invoice.getNextNumber);
router.post('/preview-html', invoice.previewHtml);
router.get('/:id/pdf', invoice.pdf);
router.get('/:id', invoice.getOne);
router.put('/:id', invoice.update);
router.delete('/:id', invoice.remove);

module.exports = router;
