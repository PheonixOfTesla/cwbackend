const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const exerciseController = require('../controllers/exerciseController');

// Public routes (clients can view)
router.get('/', protect, exerciseController.getExercises);
router.get('/:id', protect, exerciseController.getExerciseById);
router.get('/:id/related', protect, exerciseController.getRelatedExercises);

// Protected routes (only specialists, admin, owner can modify)
router.post('/', protect, checkRole(['specialist', 'admin', 'owner']), exerciseController.createExercise);
router.put('/:id', protect, checkRole(['specialist', 'admin', 'owner']), exerciseController.updateExercise);
router.delete('/:id', protect, checkRole(['specialist', 'admin', 'owner']), exerciseController.deleteExercise);

module.exports = router;