// ============================================
// THE FORGE KITCHEN - Nutrition Routes
// ============================================

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const nutritionController = require('../controllers/nutritionController');

// ============================================
// FORGE KITCHEN ROUTES (Individual users)
// ============================================

// Get my nutrition (targets, meal plan, today's log)
router.get('/me', protect, nutritionController.getMyNutrition);

// Calculate/recalculate TDEE targets
router.post('/calculate', protect, nutritionController.calculateTargets);

// Generate AI meal plan
router.post('/generate-meal-plan', protect, nutritionController.generateMealPlan);

// Log food
router.post('/log', protect, nutritionController.logFood);

// Get daily summary
router.get('/daily', protect, nutritionController.getDailySummary);

// Update preferences
router.put('/preferences', protect, nutritionController.updatePreferences);

// ============================================
// LEGACY ROUTES (Coach/Client model)
// ============================================

// Get nutrition plan for a client
router.get('/client/:clientId', protect, nutritionController.getNutritionByClient);

// Create nutrition plan (specialists/admins only)
router.post('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner', 'coach']), nutritionController.createOrUpdateNutrition);

// Update nutrition plan
router.put('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner', 'coach']), nutritionController.createOrUpdateNutrition);

// Log daily nutrition (clients can update their own)
router.post('/client/:clientId/log', protect, nutritionController.logDailyNutrition);

// Delete nutrition plan
router.delete('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner', 'coach']), nutritionController.deleteNutrition);

module.exports = router;
