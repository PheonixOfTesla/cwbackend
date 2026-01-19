// src/routes/workout.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const workoutController = require('../controllers/workoutController');

// Get all workouts for a client
router.get('/client/:clientId', protect, workoutController.getWorkoutsByClient);

// Create new workout for a client (specialists/admins only)
router.post('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner']), workoutController.createWorkout);

// Update existing workout (specialists/admins only)
router.put('/client/:clientId/:workoutId', protect, checkRole(['specialist', 'admin', 'owner']), workoutController.updateWorkout);

// Delete workout (specialists/admins only)
router.delete('/client/:clientId/:workoutId', protect, checkRole(['specialist', 'admin', 'owner']), workoutController.deleteWorkout);

// Workout session routes
router.get('/:id', protect, workoutController.getWorkoutById);
router.post('/:id/start', protect, workoutController.startWorkout);
router.put('/:id/progress', protect, workoutController.updateExerciseProgress);
router.post('/:id/complete', protect, workoutController.completeWorkout);

// Alternative complete route that matches frontend expectations
router.post('/client/:clientId/:workoutId/complete', protect, workoutController.completeWorkout);

module.exports = router;
