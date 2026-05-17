const express = require('express');
const analytics = require('../controllers/analyticsController');

const router = express.Router();

router.get('/dashboard', analytics.getDashboardAnalytics);

module.exports = router;
