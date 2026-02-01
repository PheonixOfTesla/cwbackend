const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const userController = require('../controllers/userController');

// Public routes (none for users)

// Protected routes - all require authentication
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);

// Get all users - any authenticated user can view
router.get('/', protect, userController.getAllUsers);

// Get specific user
router.get('/:id', protect, userController.getProfile);

// Admin/Owner only routes
router.post('/', protect, checkRole('admin', 'owner'), userController.createUser);
router.put('/:id', protect, checkRole('admin', 'owner'), userController.updateUser);
router.delete('/:id', protect, checkRole('admin', 'owner'), userController.deleteUser);

module.exports = router;
