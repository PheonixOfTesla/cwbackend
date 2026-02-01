const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const workoutController = require('../controllers/workoutController');

// ============================================
// CLIENT WORKOUT ROUTES
// ============================================

// Get all workouts for a client
router.get('/client/:clientId', protect, workoutController.getWorkoutsByClient);

// Create new workout for a client (specialists/admins only)
router.post('/client/:clientId', 
  protect, 
  checkRole(['specialist', 'admin', 'owner']), 
  workoutController.createWorkout
);

// Update existing workout (specialists/admins only) - with clientId
router.put('/client/:clientId/:workoutId', 
  protect, 
  checkRole(['specialist', 'admin', 'owner']), 
  workoutController.updateWorkout
);

// Delete workout (specialists/admins only) - with clientId
router.delete('/client/:clientId/:workoutId', 
  protect, 
  checkRole(['specialist', 'admin', 'owner']), 
  workoutController.deleteWorkout
);

// Complete workout - alternative route with clientId
router.post('/client/:clientId/:workoutId/complete', 
  protect, 
  workoutController.completeWorkout
);

// ============================================
// EXERCISE HISTORY ROUTES
// ============================================

// Get previous exercise data for progressive overload
router.get('/client/:clientId/exercise/:exerciseName/previous', 
  protect, 
  workoutController.getPreviousExerciseData
);

// Get complete exercise history
router.get('/client/:clientId/exercise/:exerciseName/history', 
  protect, 
  workoutController.getExerciseHistory
);

// ============================================
// WORKOUT SESSION ROUTES
// ============================================

// Get single workout by ID
router.get('/:id', protect, workoutController.getWorkoutById);

// Start workout session
router.post('/:id/start', protect, workoutController.startWorkout);

// Update exercise progress during workout
router.put('/:id/progress', protect, workoutController.updateExerciseProgress);

// Complete workout
router.post('/:id/complete', protect, workoutController.completeWorkout);

// Batch update multiple sets
router.put('/:id/sets', protect, workoutController.updateMultipleSets);

// ============================================
// SIMPLIFIED ROUTES (WITHOUT CLIENT ID)
// ============================================

// These are fallback routes for simpler API calls
router.put('/:id', 
  protect, 
  checkRole(['specialist', 'admin', 'owner']), 
  workoutController.updateWorkout
);

router.delete('/:id', 
  protect, 
  checkRole(['specialist', 'admin', 'owner']), 
  workoutController.deleteWorkout
);

// ============================================
// ERROR HANDLING FALLBACK
// ============================================

// Catch-all for unmatched routes
router.all('*', (req, res) => {
  console.log('Unmatched workout route:', req.method, req.path);
  res.status(404).json({
    success: false,
    message: 'Workout endpoint not found',
    attempted: `${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /client/:clientId',
      'POST /client/:clientId',
      'PUT /client/:clientId/:workoutId',
      'DELETE /client/:clientId/:workoutId',
      'POST /client/:clientId/:workoutId/complete',
      'GET /client/:clientId/exercise/:exerciseName/previous',
      'GET /client/:clientId/exercise/:exerciseName/history',
      'GET /:id',
      'POST /:id/start',
      'PUT /:id/progress',
      'POST /:id/complete',
      'PUT /:id/sets'
    ]
  });
});

module.exports = router;
