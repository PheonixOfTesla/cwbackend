const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const calendarController = require('../controllers/calendarController');

// Get calendar events for a date range
// GET /api/calendar/:userId?start=2025-01-01&end=2025-01-31
router.get('/:userId', protect, calendarController.getCalendar);

// Get today's events
// GET /api/calendar/:userId/today
router.get('/:userId/today', protect, calendarController.getTodayEvents);

// Get upcoming events
// GET /api/calendar/:userId/upcoming?limit=5
router.get('/:userId/upcoming', protect, calendarController.getUpcoming);

// Create a calendar event
// POST /api/calendar
router.post('/', protect, calendarController.createEvent);

// Create recurring events
// POST /api/calendar/recurring
router.post('/recurring', protect, calendarController.createRecurring);

// Generate a training week with AI
// POST /api/calendar/generate-week
router.post('/generate-week', protect, calendarController.generateWeek);

// Generate a full training month with FORGE
// POST /api/calendar/generate-month
router.post('/generate-month', protect, calendarController.generateMonth);

// Update a calendar event
// PUT /api/calendar/:eventId
router.put('/:eventId', protect, calendarController.updateEvent);

// Delete a calendar event
// DELETE /api/calendar/:eventId
router.delete('/:eventId', protect, calendarController.deleteEvent);

// Mark event as completed
// POST /api/calendar/:eventId/complete
router.post('/:eventId/complete', protect, calendarController.completeEvent);

// Skip event
// POST /api/calendar/:eventId/skip
router.post('/:eventId/skip', protect, calendarController.skipEvent);

module.exports = router;
