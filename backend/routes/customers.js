const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const customer = require('../controllers/customerController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', customer.create);
router.get('/', customer.list);
router.get('/:id/analytics', customer.getAnalytics);
router.get('/:id', customer.getOne);
router.put('/:id', customer.update);
router.delete('/:id', customer.remove);

module.exports = router;
