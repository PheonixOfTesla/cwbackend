module.exports = (io) => {
  io.on('connection', (socket) => {
    // Handle user authentication
    socket.on('authenticate', async (token) => {
      const user = await verifyToken(token);
      socket.userId = user.id;
      socket.join(`user-${user.id}`);
      
      // Update online status
      await updateUserStatus(user.id, 'online');
      socket.broadcast.emit('user-online', user.id);
    });

    // Handle real-time messaging
    socket.on('send-message', async (data) => {
      const message = await Message.create({
        senderId: socket.userId,
        recipientId: data.recipientId,
        content: data.content,
        timestamp: new Date()
      });

      // Send to recipient in real-time
      io.to(`user-${data.recipientId}`).emit('new-message', message);
      
      // Send push notification if offline
      const recipient = await User.findById(data.recipientId);
      if (recipient.status === 'offline') {
        await sendPushNotification(recipient, message);
      }
    });

    // Handle typing indicators
    socket.on('typing', (data) => {
      socket.to(`user-${data.recipientId}`).emit('user-typing', {
        userId: socket.userId,
        isTyping: data.isTyping
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      if (socket.userId) {
        await updateUserStatus(socket.userId, 'offline');
        socket.broadcast.emit('user-offline', socket.userId);
      }
    });
  });
};