const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const customer = require('../controllers/customerController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', customer.create);
router.get('/', customer.list);
router.put('/:id', customer.update);
router.delete('/:id', customer.remove);

module.exports = router;
