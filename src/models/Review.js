// Src/models/Review.js - Client reviews of coaches (Amazon-style)
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  // The reviewer (must be coaching tier subscriber)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The coach being reviewed
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Star rating (1-5)
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },

  // Review title
  title: {
    type: String,
    maxlength: 100,
    default: ''
  },

  // Review text
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },

  // Verified purchase (was actually a coaching client)
  verified: {
    type: Boolean,
    default: false
  },

  // Duration of coaching relationship when review was written
  coachingDuration: {
    type: String,
    enum: ['less-than-month', '1-3-months', '3-6-months', '6-12-months', 'over-year'],
    default: 'less-than-month'
  },

  // What the client was training for
  trainingGoal: {
    type: String,
    enum: ['weight-loss', 'muscle-gain', 'strength', 'competition', 'general-fitness', 'sports', 'other'],
    default: 'general-fitness'
  },

  // Helpful votes
  helpfulVotes: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],

  helpfulCount: {
    type: Number,
    default: 0
  },

  // Coach response (optional)
  coachResponse: {
    text: { type: String, maxlength: 500 },
    createdAt: { type: Date }
  },

  // Moderation
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'approved' // Auto-approve for now
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, {
  timestamps: true
});

// Compound unique index - one review per user per coach
reviewSchema.index({ userId: 1, coachId: 1 }, { unique: true });

// Index for coach queries
reviewSchema.index({ coachId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ coachId: 1, rating: -1 });

// Static: Get reviews for a coach
reviewSchema.statics.getCoachReviews = async function(coachId, page = 1, limit = 10) {
  return this.find({ coachId, status: 'approved', isActive: true })
    .populate('userId', 'name')
    .sort({ helpfulCount: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// Static: Get coach rating summary
reviewSchema.statics.getCoachRatingSummary = async function(coachId) {
  const result = await this.aggregate([
    { $match: {
      coachId: new mongoose.Types.ObjectId(coachId),
      status: 'approved',
      isActive: true
    }},
    { $group: {
      _id: null,
      averageRating: { $avg: '$rating' },
      totalReviews: { $sum: 1 },
      rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
      rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
      rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
      rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
    }}
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    };
  }

  const summary = result[0];
  return {
    averageRating: Math.round(summary.averageRating * 10) / 10,
    totalReviews: summary.totalReviews,
    distribution: {
      5: summary.rating5,
      4: summary.rating4,
      3: summary.rating3,
      2: summary.rating2,
      1: summary.rating1
    }
  };
};

// Static: Check if user can review coach
reviewSchema.statics.canUserReview = async function(userId, coachId) {
  const CoachSubscription = mongoose.model('CoachSubscription');

  // Check if user has active coaching subscription
  const subscription = await CoachSubscription.findOne({
    userId,
    coachId,
    tier: 'coaching',
    status: 'active',
    coachApproved: true
  });

  if (!subscription) return { canReview: false, reason: 'Must be a coaching client to leave a review' };

  // Check if already reviewed
  const existingReview = await this.findOne({ userId, coachId });
  if (existingReview) return { canReview: false, reason: 'You have already reviewed this coach' };

  return { canReview: true, subscriptionId: subscription._id };
};

module.exports = mongoose.model('Review', reviewSchema);
