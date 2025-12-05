const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const measurementController = require('../controllers/measurementController');

// Get measurements for a client
router.get('/client/:clientId', protect, measurementController.getMeasurementsByClient);

// Create measurement for a client
router.post('/client/:clientId', protect, measurementController.createMeasurement);

// Get measurement stats
router.get('/client/:clientId/stats', protect, measurementController.getMeasurementStats);

// Update measurement - FIX: Single ID path
router.put('/:id', protect, measurementController.updateMeasurement);

// Delete measurement - Already correct
router.delete('/:id', protect, measurementController.deleteMeasurement);

module.exports = router;
