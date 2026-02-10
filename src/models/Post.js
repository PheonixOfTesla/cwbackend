// Src/models/Post.js - Coach Content Posts (OF-style feed)
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // Coach who created the post
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Post content
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },

  // Media attachment (single or carousel)
  mediaUrl: {
    type: String,
    default: null
  },

  mediaType: {
    type: String,
    enum: ['image', 'video', 'carousel', 'none'],
    default: 'none'
  },

  // Cloudinary public ID for deletion
  mediaPublicId: {
    type: String,
    default: null
  },

  // For carousel posts (multiple images)
  carousel: [{
    url: String,
    publicId: String,
    width: Number,
    height: Number
  }],

  // Post type for filtering
  postType: {
    type: String,
    enum: ['tip', 'workout', 'nutrition', 'motivation', 'behind-the-scenes', 'announcement', 'general'],
    default: 'general'
  },

  // Visibility - which tier can see this
  visibility: {
    type: String,
    enum: ['public', 'subscribers', 'coaching'],
    default: 'subscribers'
  },

  // Engagement metrics
  likes: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  likesCount: {
    type: Number,
    default: 0
  },

  commentsCount: {
    type: Number,
    default: 0
  },

  // Linked product (optional - for selling)
  linkedProductId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    default: null
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  isPinned: {
    type: Boolean,
    default: false
  }

}, {
  timestamps: true
});

// Indexes for efficient queries
postSchema.index({ coachId: 1, createdAt: -1 });
postSchema.index({ coachId: 1, visibility: 1, createdAt: -1 });
postSchema.index({ coachId: 1, isPinned: -1, createdAt: -1 });

// Virtual for formatted date
postSchema.virtual('timeAgo').get(function() {
  const seconds = Math.floor((new Date() - this.createdAt) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return this.createdAt.toLocaleDateString();
});

// Method to check if user can view post
postSchema.methods.canView = function(userSubscriptionTier) {
  if (this.visibility === 'public') return true;
  if (this.visibility === 'subscribers' && ['content', 'coaching'].includes(userSubscriptionTier)) return true;
  if (this.visibility === 'coaching' && userSubscriptionTier === 'coaching') return true;
  return false;
};

// Static method to get feed for a coach
postSchema.statics.getFeed = async function(coachId, userTier = null, page = 1, limit = 20) {
  const query = { coachId, isActive: true };

  // Filter by visibility based on user tier
  if (!userTier) {
    query.visibility = 'public';
  } else if (userTier === 'content') {
    query.visibility = { $in: ['public', 'subscribers'] };
  }
  // coaching tier can see all

  const posts = await this.find(query)
    .sort({ isPinned: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('coachId', 'name coachProfile.profilePicture')
    .lean();

  return posts;
};

module.exports = mongoose.model('Post', postSchema);
