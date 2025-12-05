const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const goalController = require('../controllers/goalController');

// Get all goals for a client
router.get('/client/:clientId', protect, goalController.getGoalsByClient);

// Create goal for a client
router.post('/client/:clientId', protect, goalController.createGoal);

// Update goal - FIX: Ensure this works with just ID
router.put('/:id', protect, goalController.updateGoal);

// Delete goal - Already correct
router.delete('/:id', protect, goalController.deleteGoal);

module.exports = router;
