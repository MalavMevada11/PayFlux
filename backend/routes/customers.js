const express = require('express');
const customer = require('../controllers/customerController');

const router = express.Router();
router.post('/', customer.create);
router.get('/', customer.list);
router.get('/:id/analytics', customer.getAnalytics);
router.get('/:id', customer.getOne);
router.put('/:id', customer.update);
router.delete('/:id', customer.remove);

module.exports = router;
