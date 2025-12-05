const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const nutritionController = require('../controllers/nutritionController');

// Get nutrition plan for a client
router.get('/client/:clientId', protect, nutritionController.getNutritionByClient);

// Create nutrition plan (specialists/admins only)
router.post('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner']), nutritionController.createOrUpdateNutrition);

// Update nutrition plan - FIX: Use PUT with same path structure
router.put('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner']), nutritionController.createOrUpdateNutrition);

// Log daily nutrition (clients can update their own)
router.post('/client/:clientId/log', protect, nutritionController.logDailyNutrition);

module.exports = router;
