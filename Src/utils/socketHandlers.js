const jwt = require('jsonwebtoken');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication failed'));
      }
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log('New socket connection');

    socket.on('authenticate', (token) => {
      console.log('User authenticated');
    });

    socket.on('send-message', (data) => {
      io.to(`user-${data.recipientId}`).emit('new-message', data);
    });

    socket.on('typing', (data) => {
      socket.to(`user-${data.recipientId}`).emit('user-typing', data);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  });
};
