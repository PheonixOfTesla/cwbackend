const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

// Get all messages for current user
router.get('/', protect, messageController.getMessages);

// Send a message
router.post('/', protect, messageController.sendMessage);

// Mark messages as read
router.put('/read', protect, messageController.markAsRead);

module.exports = router;