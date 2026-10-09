const express = require('express');
const router = express.Router();
const { leaderboard, impactMetrics, analyticsDashboard } = require('../controllers/analyticsController');

router.get('/leaderboard', leaderboard);
router.get('/impact', impactMetrics);
router.get('/dashboard', analyticsDashboard);

module.exports = router;
