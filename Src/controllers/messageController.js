const Message = require('../models/Message');

exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.id },
        { recipient: req.user.id }
      ]
    }).sort('-timestamp').populate('sender recipient', 'name email');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const message = await Message.create({
      sender: req.user.id,
      recipient: req.body.recipientId,
      text: req.body.text,
      isZoomLink: req.body.isZoomLink || false
    });
    
    const populated = await message.populate('sender recipient', 'name email');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      {
        _id: { $in: req.body.messageIds },
        recipient: req.user.id
      },
      { read: true }
    );
    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};