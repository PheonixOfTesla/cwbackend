// src/controllers/uploadController.js - File Upload Controller
const { uploadImage, uploadVideo } = require('../config/cloudinary');

/**
 * Upload single image or video
 * POST /api/upload/media
 */
exports.uploadMedia = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const file = req.file;
        const isVideo = file.mimetype.startsWith('video/');

        // Convert buffer to base64
        const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        // Upload to Cloudinary
        let result;
        if (isVideo) {
            result = await uploadVideo(base64File, 'clockwork/videos');
        } else {
            result = await uploadImage(base64File, 'clockwork/images');
        }

        console.log(`✅ ${isVideo ? 'Video' : 'Image'} uploaded:`, result.url);

        res.json({
            success: true,
            data: {
                url: result.url,
                publicId: result.publicId,
                type: isVideo ? 'video' : 'image',
                ...result
            }
        });

    } catch (error) {
        console.error('Upload media error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload file',
            error: error.message
        });
    }
};

/**
 * Upload multiple images for carousel
 * POST /api/upload/carousel
 */
exports.uploadCarousel = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        const uploadPromises = req.files.map(async (file) => {
            const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            return uploadImage(base64File, 'clockwork/carousel');
        });

        const results = await Promise.all(uploadPromises);

        console.log(`✅ Carousel uploaded: ${results.length} images`);

        res.json({
            success: true,
            data: {
                images: results,
                count: results.length
            }
        });

    } catch (error) {
        console.error('Upload carousel error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload carousel',
            error: error.message
        });
    }
};

/**
 * Upload profile picture
 * POST /api/upload/profile-picture
 */
exports.uploadProfilePicture = async (req, res) => {
    try {
        console.log('📸 Profile picture upload request received');
        console.log('   User:', req.user?.email);
        console.log('   File present:', !!req.file);

        if (!req.file) {
            console.warn('❌ No file in request');
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const file = req.file;
        console.log('   File type:', file.mimetype);
        console.log('   File size:', (file.size / 1024).toFixed(2), 'KB');

        const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

        // Check if Cloudinary is configured
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('❌ Cloudinary not configured!');
            return res.status(500).json({
                success: false,
                message: 'Image upload service not configured. Please contact support.',
                error: 'CLOUDINARY_NOT_CONFIGURED'
            });
        }

        console.log('☁️  Uploading to Cloudinary...');
        // Upload to Cloudinary in profile-pictures folder
        const result = await uploadImage(base64File, 'clockwork/profile-pictures');

        console.log(`✅ Profile picture uploaded:`, result.url);

        res.json({
            success: true,
            data: {
                url: result.url,
                publicId: result.publicId
            }
        });

    } catch (error) {
        console.error('Upload profile picture error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Failed to upload profile picture',
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};
