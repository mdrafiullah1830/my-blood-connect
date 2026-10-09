const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { donorHeatmap, checkGeofence, streamLocation } = require('../controllers/mapController');

router.get('/heatmap', protect, donorHeatmap);
router.post('/geofence/check', protect, checkGeofence);
router.post('/stream-location', protect, streamLocation);

module.exports = router;
