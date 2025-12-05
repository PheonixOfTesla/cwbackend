const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const classController = require('../controllers/classController');

// Public routes (any authenticated user can view)
router.get('/gym/:gymId', protect, classController.getClasses);
router.get('/:id', protect, classController.getClassById);
router.get('/:id/stats', protect, classController.getClassStats);

// Booking routes (any authenticated user)
router.post('/:classId/book', protect, classController.bookClass);
router.post('/:classId/cancel-booking', protect, classController.cancelBooking);

// User's classes
router.get('/user/:userId?', protect, classController.getUserClasses);

// Protected routes (only specialists, admin, owner can manage)
router.post('/gym/:gymId', protect, checkRole(['specialist', 'admin', 'owner']), classController.createClass);
router.put('/:id', protect, checkRole(['specialist', 'admin', 'owner']), classController.updateClass);
router.delete('/:id', protect, checkRole(['specialist', 'admin', 'owner']), classController.deleteClass);
router.post('/:id/cancel', protect, checkRole(['specialist', 'admin', 'owner']), classController.cancelClass);

module.exports = router;