const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const exerciseController = require('../controllers/exerciseController');

// ============================================
// VIDEO LIBRARY ROUTES (MuscleWiki + Free Exercise DB)
// Videos from MuscleWiki, Images from Free Exercise DB
// ============================================

// Get video library stats
router.get('/videos/stats', exerciseController.getVideoLibraryStats);

// Get available muscle groups
router.get('/videos/muscles', exerciseController.getVideoMuscleGroups);

// Get available equipment types
router.get('/videos/equipment', exerciseController.getVideoEquipment);

// Get all exercises with videos
router.get('/videos/with-videos', exerciseController.getExercisesWithVideos);

// Search video library
router.get('/videos/search', exerciseController.searchVideoLibrary);

// Get exercises by muscle (video library)
router.get('/videos/muscle/:muscle', exerciseController.getVideoByMuscle);

// Get exercises by equipment (video library)
router.get('/videos/equipment/:equipment', exerciseController.getVideoByEquipment);

// Refresh video library cache (admin only)
router.post('/videos/refresh', protect, checkRole(['admin']), exerciseController.refreshVideoLibrary);

// Get exercise variations and why it's recommended (requires auth for personalization)
router.get('/videos/:id/variations', protect, exerciseController.getExerciseVariations);

// Get single exercise from video library
router.get('/videos/:id', exerciseController.getVideoExerciseById);

// Get all video exercises with filters
router.get('/videos', exerciseController.getVideoLibrary);

// ============================================
// EXERCISE LIBRARY ROUTES (500+ exercises)
// ============================================

// Get library metadata (muscle groups, equipment, etc.)
router.get('/library/meta', exerciseController.getLibraryMeta);

// Get all exercises from library with filters
router.get('/library', exerciseController.getLibrary);

// Search exercises
router.get('/library/search', exerciseController.searchLibrary);

// Get compound exercises
router.get('/library/compound', exerciseController.getCompound);

// Get powerlifting exercises
router.get('/library/powerlifting', exerciseController.getPowerlifting);

// Get bodyweight exercises
router.get('/library/bodyweight', exerciseController.getBodyweight);

// Get home gym exercises
router.get('/library/home-gym', exerciseController.getHomeGym);

// Get exercises by muscle group
router.get('/library/muscle/:muscle', exerciseController.getByMuscle);

// Get exercises by equipment
router.get('/library/equipment/:equipment', exerciseController.getByEquipment);

// Get exercise substitutes
router.get('/library/:id/substitutes', exerciseController.getSubstitutes);

// Get single exercise from library
router.get('/library/:id', exerciseController.getLibraryExercise);

// ============================================
// USER CUSTOM EXERCISES (Database)
// ============================================

// Public routes (clients can view)
router.get('/', protect, exerciseController.getExercises);
router.get('/:id', protect, exerciseController.getExerciseById);
router.get('/:id/related', protect, exerciseController.getRelatedExercises);

// Protected routes (only coaches, admin can modify)
router.post('/', protect, checkRole(['coach', 'admin']), exerciseController.createExercise);
router.put('/:id', protect, checkRole(['coach', 'admin']), exerciseController.updateExercise);
router.delete('/:id', protect, checkRole(['coach', 'admin']), exerciseController.deleteExercise);

module.exports = router;
