const express = require('express');
const item = require('../controllers/itemController');

const router = express.Router();
router.post('/', item.create);
router.get('/', item.list);
router.get('/:id/analytics', item.getAnalytics);
router.get('/:id', item.getOne);
router.put('/:id', item.update);
router.delete('/:id', item.remove);

module.exports = router;
