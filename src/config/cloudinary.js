// src/config/cloudinary.js - Cloudinary Configuration
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary using CLOUDINARY_URL from environment
// Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
if (process.env.CLOUDINARY_URL) {
    // Cloudinary automatically configures from CLOUDINARY_URL
    console.log('✅ Cloudinary configured from CLOUDINARY_URL');
} else {
    console.warn('⚠️ CLOUDINARY_URL not set - file uploads will fail');
}

/**
 * Upload image to Cloudinary
 * @param {String} fileBuffer - Base64 or file buffer
 * @param {String} folder - Cloudinary folder path
 * @returns {Object} Upload result with URL
 */
const uploadImage = async (fileBuffer, folder = 'clockwork/posts') => {
    try {
        const result = await cloudinary.uploader.upload(fileBuffer, {
            folder: folder,
            resource_type: 'auto',
            transformation: [
                { quality: 'auto', fetch_format: 'auto' }
            ]
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw new Error('Failed to upload image');
    }
};

/**
 * Upload video to Cloudinary
 * @param {String} fileBuffer - Base64 or file buffer
 * @param {String} folder - Cloudinary folder path
 * @returns {Object} Upload result with URL
 */
const uploadVideo = async (fileBuffer, folder = 'clockwork/videos') => {
    try {
        const result = await cloudinary.uploader.upload(fileBuffer, {
            folder: folder,
            resource_type: 'video',
            transformation: [
                { quality: 'auto', fetch_format: 'auto' }
            ]
        });

        return {
            url: result.secure_url,
            publicId: result.public_id,
            duration: result.duration,
            format: result.format
        };
    } catch (error) {
        console.error('Cloudinary video upload error:', error);
        throw new Error('Failed to upload video');
    }
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @param {String} resourceType - 'image' or 'video'
 */
const deleteFile = async (publicId, resourceType = 'image') => {
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        return true;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        return false;
    }
};

module.exports = {
    cloudinary,
    uploadImage,
    uploadVideo,
    deleteFile
};
