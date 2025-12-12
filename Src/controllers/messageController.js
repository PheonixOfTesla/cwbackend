const Message = require('../models/Message');
const User = require('../models/User');
const CoachClient = require('../models/CoachClient');

// ============================================
// GET ALL MY MESSAGES (grouped by conversation)
// ============================================
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id },
        { recipient: req.user.id }
      ]
    }).sort('-timestamp').populate('sender recipient', 'name email profile');

    // Group by conversation partner
    const conversations = {};
    messages.forEach(msg => {
      const partnerId = msg.sender._id.toString() === req.user.id
        ? msg.recipient._id.toString()
        : msg.sender._id.toString();

      if (!conversations[partnerId]) {
        conversations[partnerId] = {
          partner: msg.sender._id.toString() === req.user.id ? msg.recipient : msg.sender,
          messages: [],
          unreadCount: 0,
          lastMessage: msg
        };
      }

      conversations[partnerId].messages.push(msg);

      // Count unread messages
      if (!msg.read && msg.recipient._id.toString() === req.user.id) {
        conversations[partnerId].unreadCount++;
      }
    });

    res.json({
      success: true,
      conversations: Object.values(conversations)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// GET CONVERSATION WITH SPECIFIC USER
// ============================================
exports.getConversation = async (req, res) => {
  try {
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: req.user.id, recipient: userId },
        { sender: userId, recipient: req.user.id }
      ]
    })
    .sort('timestamp')
    .populate('sender recipient', 'name email profile')
    .limit(100);

    // Get partner info
    const partner = await User.findById(userId).select('name email profile userType coachProfile');

    res.json({
      success: true,
      partner,
      messages
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// SEND MESSAGE
// ============================================
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, text, isZoomLink } = req.body;

    // Verify relationship exists (coach-client or client-coach)
    const relationship = await CoachClient.findOne({
      $or: [
        { coach: req.user.id, client: recipientId },
        { coach: recipientId, client: req.user.id }
      ]
    });

    if (!relationship) {
      return res.status(403).json({
        success: false,
        message: 'You can only message your coach or clients'
      });
    }

    const message = await Message.create({
      sender: req.user.id,
      recipient: recipientId,
      text,
      isZoomLink: isZoomLink || false
    });

    const populated = await message.populate('sender recipient', 'name email profile');

    // Real-time notification via socket
    if (global.io) {
      global.io.to(`user:${recipientId}`).emit('new-message', {
        message: populated,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: populated
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// MARK MESSAGES AS READ
// ============================================
exports.markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      {
        _id: { $in: req.body.messageIds },
        recipient: req.user.id
      },
      { read: true }
    );
    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================
// SEND VIDEO CALL LINK
// ============================================
exports.sendVideoCallLink = async (req, res) => {
  try {
    const { recipientId, platform, customLink } = req.body;

    // Verify relationship
    const relationship = await CoachClient.findOne({
      $or: [
        { coach: req.user.id, client: recipientId },
        { coach: recipientId, client: req.user.id }
      ]
    });

    if (!relationship) {
      return res.status(403).json({
        success: false,
        message: 'You can only send video calls to your coach or clients'
      });
    }

    let videoLink;
    let messageText;

    if (customLink) {
      // Use custom link provided by coach
      videoLink = customLink;
      messageText = `📹 Video Call Link: ${customLink}`;
    } else {
      // Generate platform-specific link
      switch (platform) {
        case 'zoom':
          // For production, integrate with Zoom API
          // For now, use placeholder that opens Zoom
          videoLink = 'https://zoom.us/start/videomeeting';
          messageText = '📹 Click to start Zoom meeting: https://zoom.us/start/videomeeting';
          break;
        case 'google-meet':
          videoLink = 'https://meet.google.com/new';
          messageText = '📹 Click to start Google Meet: https://meet.google.com/new';
          break;
        case 'facetime':
          // FaceTime link (iOS only)
          const user = await User.findById(req.user.id).select('phone email');
          videoLink = `facetime:${user.phone || user.email}`;
          messageText = `📹 FaceTime call from ${req.user.name}`;
          break;
        default:
          videoLink = 'https://whereby.com/' + Date.now();
          messageText = `📹 Video Call Link: ${videoLink}`;
      }
    }

    const message = await Message.create({
      sender: req.user.id,
      recipient: recipientId,
      text: messageText,
      isZoomLink: true
    });

    const populated = await message.populate('sender recipient', 'name email profile');

    // Real-time notification
    if (global.io) {
      global.io.to(`user:${recipientId}`).emit('new-message', {
        message: populated,
        timestamp: new Date().toISOString()
      });

      // Special notification for video call
      global.io.to(`user:${recipientId}`).emit('video-call-invite', {
        from: req.user.name,
        link: videoLink,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: populated,
      videoLink
    });

  } catch (error) {
    console.error('Send video call link error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};