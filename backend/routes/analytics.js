const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const analytics = require('../controllers/analyticsController');

const router = express.Router();
router.use(authMiddleware);

router.get('/dashboard', analytics.getDashboardAnalytics);

module.exports = router;
