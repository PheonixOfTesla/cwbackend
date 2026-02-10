// src/routes/upload.js - Upload Routes
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadSingle, uploadMultiple, handleUploadError } = require('../middleware/upload');
const {
    uploadMedia,
    uploadCarousel,
    uploadProfilePicture
} = require('../controllers/uploadController');

// All upload routes require authentication
router.use(protect);

// @route   POST /api/upload/media
// @desc    Upload single image or video
// @access  Private
router.post('/media', uploadSingle, handleUploadError, uploadMedia);

// @route   POST /api/upload/carousel
// @desc    Upload multiple images for carousel
// @access  Private
router.post('/carousel', uploadMultiple, handleUploadError, uploadCarousel);

// @route   POST /api/upload/profile-picture
// @desc    Upload profile picture
// @access  Private
router.post('/profile-picture', uploadSingle, handleUploadError, uploadProfilePicture);

module.exports = router;
