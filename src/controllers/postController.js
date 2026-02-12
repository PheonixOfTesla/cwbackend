// Src/controllers/postController.js - Coach Content Posts (OF-style)
const mongoose = require('mongoose');
const Post = require('../models/Post');
const CoachSubscription = require('../models/CoachSubscription');
const User = require('../models/User');
const { uploadImage, uploadVideo } = require('../config/cloudinary');

// ============================================
// CREATE POST (Coach only)
// ============================================
exports.createPost = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { content, mediaUrl, mediaType, postType, visibility, linkedProductId } = req.body;

    // Allow coaches and influencers (creators)
    const canPost = ['coach', 'influencer'].includes(req.user.userType);
    if (!canPost) {
      return res.status(403).json({ success: false, message: 'Only creators can create posts' });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Post content is required' });
    }

    const post = await Post.create({
      coachId,
      content: content.trim(),
      mediaUrl: mediaUrl || null,
      mediaType: mediaType || 'none',
      postType: postType || 'general',
      visibility: visibility || 'subscribers',
      linkedProductId: linkedProductId || null
    });

    await post.populate('coachId', 'name coachProfile.profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Failed to create post' });
  }
};

// ============================================
// GET COACH FEED (Public + Subscriber views)
// ============================================
exports.getCoachFeed = async (req, res) => {
  try {
    let { coachId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user?.id;

    // Resolve handle to ID if needed
    if (!mongoose.Types.ObjectId.isValid(coachId)) {
      const creator = await User.findOne({ 'coachProfile.handle': coachId.toLowerCase() }).select('_id');
      if (!creator) {
        return res.status(404).json({ success: false, message: 'Creator not found' });
      }
      coachId = creator._id;
    }

    // Check subscription status
    let userTier = null;
    if (userId) {
      const subscription = await CoachSubscription.getUserSubscription(userId, coachId);
      if (subscription && subscription.isActive()) {
        userTier = subscription.tier;
      }
    }

    // Get posts based on user tier
    const posts = await Post.getFeed(coachId, userTier, parseInt(page), parseInt(limit));

    // Get total count for pagination
    const query = { coachId, isActive: true };
    if (!userTier) {
      query.visibility = 'public';
    } else if (userTier === 'content') {
      query.visibility = { $in: ['public', 'subscribers'] };
    }
    const totalPosts = await Post.countDocuments(query);

    // Check if there are locked posts (for showing paywall teaser)
    let lockedPostsCount = 0;
    if (!userTier || userTier === 'content') {
      const lockedQuery = { coachId, isActive: true };
      if (!userTier) {
        lockedQuery.visibility = { $in: ['subscribers', 'coaching'] };
      } else {
        lockedQuery.visibility = 'coaching';
      }
      lockedPostsCount = await Post.countDocuments(lockedQuery);
    }

    res.json({
      success: true,
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalPosts,
        pages: Math.ceil(totalPosts / limit)
      },
      subscription: {
        tier: userTier,
        lockedPostsCount,
        canAccessAll: userTier === 'coaching'
      }
    });

  } catch (error) {
    console.error('Get coach feed error:', error);
    res.status(500).json({ success: false, message: 'Failed to get feed' });
  }
};

// ============================================
// GET MY POSTS (Coach dashboard)
// ============================================
exports.getMyPosts = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const canAccess = req.user.userType === 'coach' || req.user.coachProfile;
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Only creators can access this' });
    }

    const posts = await Post.find({ coachId, isActive: { $ne: false } })
      .sort({ isPinned: -1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Post.countDocuments({ coachId, isActive: { $ne: false } });

    res.json({
      success: true,
      posts,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });

  } catch (error) {
    console.error('Get my posts error:', error);
    res.status(500).json({ success: false, message: 'Failed to get posts' });
  }
};

// ============================================
// UPDATE POST
// ============================================
exports.updatePost = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { postId } = req.params;
    const { content, visibility, isPinned } = req.body;

    const post = await Post.findOne({ _id: postId, coachId });

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (content) post.content = content.trim();
    if (visibility) post.visibility = visibility;
    if (isPinned !== undefined) post.isPinned = isPinned;

    await post.save();

    res.json({ success: true, message: 'Post updated', post });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Failed to update post' });
  }
};

// ============================================
// DELETE POST
// ============================================
exports.deletePost = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { postId } = req.params;

    const post = await Post.findOneAndUpdate(
      { _id: postId, coachId },
      { isActive: false },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    res.json({ success: true, message: 'Post deleted' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete post' });
  }
};

// ============================================
// LIKE POST
// ============================================
exports.likePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check if already liked
    const alreadyLiked = post.likes.some(like => like.userId.toString() === userId);

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter(like => like.userId.toString() !== userId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      // Like
      post.likes.push({ userId });
      post.likesCount += 1;
    }

    await post.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: post.likesCount
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Failed to like post' });
  }
};

module.exports = exports;
