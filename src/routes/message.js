const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

// All routes require authentication
router.use(protect);

// ============================================
// MESSAGE ROUTES
// ============================================

// GET /api/messages - Get all my messages (grouped by conversation)
router.get('/', messageController.getMessages);

// GET /api/messages/:userId - Get conversation with specific user
router.get('/:userId', messageController.getConversation);

// POST /api/messages - Send a message
router.post('/', messageController.sendMessage);

// PUT /api/messages/read - Mark messages as read
router.put('/read', messageController.markAsRead);

// ============================================
// VIDEO CALL INTEGRATION
// ============================================

// POST /api/messages/video-call - Generate and send video call link
router.post('/video-call', messageController.sendVideoCallLink);

module.exports = router;