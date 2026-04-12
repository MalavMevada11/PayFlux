const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const item = require('../controllers/itemController');

const router = express.Router();
router.use(authMiddleware);
router.post('/', item.create);
router.get('/', item.list);
router.get('/:id/analytics', item.getAnalytics);
router.get('/:id', item.getOne);
router.put('/:id', item.update);
router.delete('/:id', item.remove);

module.exports = router;
