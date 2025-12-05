const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const checkInController = require('../controllers/checkInController');

// Get today's check-in (or pre-filled template)
// GET /api/check-ins/today
router.get('/today', protect, checkInController.getTodayCheckIn);

// Get check-in trends and analytics
// GET /api/check-ins/trends?days=30
router.get('/trends', protect, checkInController.getTrends);

// Auto-fill check-in from wearables
// POST /api/check-ins/auto-fill
router.post('/auto-fill', protect, checkInController.autoFill);

// Submit or update today's check-in
// POST /api/check-ins
router.post('/', protect, checkInController.submitCheckIn);

// Get check-in history for a user
// GET /api/check-ins/:userId/history?days=30
router.get('/:userId/history', protect, checkInController.getHistory);

// Get a specific check-in by ID
// GET /api/check-ins/:checkInId
router.get('/:checkInId', protect, checkInController.getCheckInById);

// Delete a check-in
// DELETE /api/check-ins/:checkInId
router.delete('/:checkInId', protect, checkInController.deleteCheckIn);

module.exports = router;
