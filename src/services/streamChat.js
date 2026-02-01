const { StreamChat } = require('stream-chat');

// Initialize Stream Chat client
let chatClient = null;

const getClient = () => {
  if (!chatClient) {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error('Stream Chat credentials not configured');
    }

    chatClient = StreamChat.getInstance(apiKey, apiSecret);
  }
  return chatClient;
};

/**
 * Generate a user token for Stream Chat
 */
exports.createUserToken = (userId) => {
  const client = getClient();
  return client.createToken(userId.toString());
};

/**
 * Create or update a user in Stream Chat
 */
exports.upsertUser = async (userData) => {
  const client = getClient();
  await client.upsertUser({
    id: userData.userId.toString(),
    name: userData.name,
    image: userData.profileImage,
    role: userData.isCoach ? 'coach' : 'user'
  });
};

/**
 * Create a coaching channel between coach and client
 */
exports.createCoachingChannel = async ({
  channelId,
  coachId,
  clientId,
  coachName,
  clientName,
  programTitle
}) => {
  const client = getClient();

  const channel = client.channel('messaging', channelId, {
    name: `${coachName} <> ${clientName}`,
    members: [coachId.toString(), clientId.toString()],
    created_by_id: coachId.toString(),
    coaching: true,
    program: programTitle
  });

  await channel.create();

  // Send welcome message
  await channel.sendMessage({
    text: `Welcome! This is your private coaching channel with ${coachName}. Feel free to ask questions, share progress, and stay connected.`,
    user_id: coachId.toString()
  });

  return channel;
};

/**
 * Get all channels for a user
 */
exports.getUserChannels = async (userId) => {
  const client = getClient();

  const filter = {
    type: 'messaging',
    members: { $in: [userId.toString()] }
  };

  const sort = { last_message_at: -1 };

  const channels = await client.queryChannels(filter, sort, {
    limit: 30,
    state: true
  });

  return channels.map(ch => ({
    id: ch.id,
    name: ch.data.name,
    members: ch.data.members,
    lastMessage: ch.state.messages[ch.state.messages.length - 1],
    unreadCount: ch.countUnread()
  }));
};

/**
 * Archive/delete a channel when subscription ends
 */
exports.archiveChannel = async (channelId) => {
  const client = getClient();
  const channel = client.channel('messaging', channelId);

  // Send final message
  await channel.sendMessage({
    text: 'This coaching subscription has ended. The channel is now archived.',
    user_id: 'system'
  });

  // Disable the channel
  await channel.update({
    frozen: true,
    archived: true
  });
};

/**
 * Get unread count for a user across all channels
 */
exports.getUnreadCount = async (userId) => {
  const client = getClient();

  const filter = {
    type: 'messaging',
    members: { $in: [userId.toString()] }
  };

  const channels = await client.queryChannels(filter, {}, { limit: 100 });

  let totalUnread = 0;
  for (const channel of channels) {
    totalUnread += channel.countUnread();
  }

  return totalUnread;
};

module.exports = exports;
