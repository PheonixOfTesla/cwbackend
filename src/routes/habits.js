// Src/routes/habits.js - Habit Tracking Routes
const express = require('express');
const router = express.Router();
const habitController = require('../controllers/habitController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ============================================
// HABIT CRUD
// ============================================

// GET /api/habits - Get all habits for user
router.get('/', habitController.getHabits);

// GET /api/habits/today - Get today's habits with status
router.get('/today', habitController.getTodayStatus);

// GET /api/habits/weekly - Get weekly summary
router.get('/weekly', habitController.getWeeklySummary);

// POST /api/habits - Create new habit
router.post('/', habitController.createHabit);

// POST /api/habits/defaults - Create default habits
router.post('/defaults', habitController.createDefaults);

// POST /api/habits/reorder - Reorder habits
router.post('/reorder', habitController.reorderHabits);

// GET /api/habits/:id - Get single habit with stats
router.get('/:id', habitController.getHabit);

// PUT /api/habits/:id - Update habit
router.put('/:id', habitController.updateHabit);

// DELETE /api/habits/:id - Delete/archive habit
router.delete('/:id', habitController.deleteHabit);

// ============================================
// COMPLETION TRACKING
// ============================================

// POST /api/habits/:id/complete - Mark habit complete
router.post('/:id/complete', habitController.completeHabit);

// POST /api/habits/:id/uncomplete - Mark habit incomplete
router.post('/:id/uncomplete', habitController.uncompleteHabit);

// POST /api/habits/:id/toggle - Toggle today's completion
router.post('/:id/toggle', habitController.toggleHabit);

module.exports = router;
