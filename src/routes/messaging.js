const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const streamChat = require('../services/streamChat');
const User = require('../models/User');

/**
 * Get Stream Chat token
 * POST /api/messaging/token
 */
router.post('/token', authenticate, async (req, res) => {
  try {
    // Ensure user exists in Stream Chat
    await streamChat.upsertUser({
      userId: req.user._id,
      name: req.user.name,
      profileImage: req.user.profileImage,
      isCoach: req.user.roles?.includes('coach')
    });

    // Generate token
    const token = streamChat.createUserToken(req.user._id);

    // Save Stream Chat user ID if not already saved
    if (!req.user.streamChatUserId) {
      await User.findByIdAndUpdate(req.user._id, {
        streamChatUserId: req.user._id.toString()
      });
    }

    res.json({
      token,
      userId: req.user._id.toString(),
      apiKey: process.env.STREAM_API_KEY
    });
  } catch (error) {
    console.error('Get token error:', error);
    res.status(500).json({ message: 'Error generating chat token' });
  }
});

/**
 * Get my chat channels
 * GET /api/messaging/channels
 */
router.get('/channels', authenticate, async (req, res) => {
  try {
    const channels = await streamChat.getUserChannels(req.user._id);
    res.json(channels);
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ message: 'Error fetching channels' });
  }
});

/**
 * Get unread message count
 * GET /api/messaging/unread
 */
router.get('/unread', authenticate, async (req, res) => {
  try {
    const count = await streamChat.getUnreadCount(req.user._id);
    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Get unread error:', error);
    res.status(500).json({ message: 'Error fetching unread count' });
  }
});

module.exports = router;
