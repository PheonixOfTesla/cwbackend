class MessageService {
  async getConversations(userId) {
    // Get all conversations with last message preview
    const conversations = await Conversation.findAll({
      where: {
        [Op.or]: [
          { user1Id: userId },
          { user2Id: userId }
        ]
      },
      include: [{
        model: Message,
        limit: 1,
        order: [['createdAt', 'DESC']]
      }]
    });
    
    return conversations;
  }

  async getMessages(conversationId, pagination) {
    // Implement cursor-based pagination for performance
    const messages = await Message.findAll({
      where: { conversationId },
      limit: pagination.limit,
      offset: pagination.offset,
      order: [['createdAt', 'DESC']]
    });
    
    return messages;
  }

  async markAsRead(messageIds, userId) {
    await Message.update(
      { readAt: new Date() },
      { 
        where: { 
          id: messageIds,
          recipientId: userId,
          readAt: null
        }
      }
    );
  }
}