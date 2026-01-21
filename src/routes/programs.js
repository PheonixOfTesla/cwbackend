const express = require('express');
const router = express.Router();
const programController = require('../controllers/programController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// ============================================
// PROGRAM MANAGEMENT ROUTES
// ============================================

// Generate a new program (FORGE analysis)
router.post('/generate', programController.generateProgram);

// Get user's active program
router.get('/active', programController.getActiveProgram);

// Get calendar events for a program
router.get('/:programId/calendar', programController.getProgramCalendarEvents);

// Progress program to next week
router.post('/:programId/progress', programController.progressProgram);

// Update program status (pause/resume/complete)
router.patch('/:programId/status', programController.updateProgramStatus);

module.exports = router;
