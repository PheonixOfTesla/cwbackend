// Src/models/CoachSubscription.js - User subscriptions to individual coaches (OF model)
const mongoose = require('mongoose');

const coachSubscriptionSchema = new mongoose.Schema({
  // The subscriber (client/individual)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The coach being subscribed to
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Subscription tier
  tier: {
    type: String,
    enum: ['content', 'coaching'],
    required: true
  },

  // Pricing (stored for historical reference)
  price: {
    type: Number,
    required: true
  },

  // Stripe integration
  stripeCustomerId: {
    type: String,
    default: null
  },

  stripeSubscriptionId: {
    type: String,
    default: null
  },

  stripePriceId: {
    type: String,
    default: null
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'paused', 'pending_approval'],
    default: 'active'
  },

  // For coaching tier - requires coach approval
  coachApproved: {
    type: Boolean,
    default: function() {
      return this.tier === 'content'; // Auto-approve content tier
    }
  },

  applicationMessage: {
    type: String,
    maxlength: 500,
    default: null
  },

  // Billing period
  currentPeriodStart: {
    type: Date,
    default: Date.now
  },

  currentPeriodEnd: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }
  },

  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },

  // Revenue tracking
  totalPaid: {
    type: Number,
    default: 0
  },

  // Metadata
  source: {
    type: String,
    enum: ['direct', 'marketplace', 'referral', 'influencer'],
    default: 'direct'
  },

  referralCode: {
    type: String,
    default: null
  }

}, {
  timestamps: true
});

// Compound unique index - user can only have one subscription per coach
coachSubscriptionSchema.index({ userId: 1, coachId: 1 }, { unique: true });

// Index for coach queries
coachSubscriptionSchema.index({ coachId: 1, status: 1 });
coachSubscriptionSchema.index({ coachId: 1, tier: 1, status: 1 });

// Virtual for subscription type label
coachSubscriptionSchema.virtual('tierLabel').get(function() {
  return this.tier === 'content' ? 'Content Subscriber' : 'Coaching Client';
});

// Check if subscription is active
coachSubscriptionSchema.methods.isActive = function() {
  return this.status === 'active' &&
         this.coachApproved &&
         new Date() < this.currentPeriodEnd;
};

// Check if user can access content at given visibility level
coachSubscriptionSchema.methods.canAccess = function(visibility) {
  if (!this.isActive()) return false;
  if (visibility === 'public') return true;
  if (visibility === 'subscribers') return true;
  if (visibility === 'coaching') return this.tier === 'coaching';
  return false;
};

// Static: Get user's subscription to a specific coach
coachSubscriptionSchema.statics.getUserSubscription = async function(userId, coachId) {
  return this.findOne({
    userId,
    coachId,
    status: { $in: ['active', 'pending_approval'] }
  });
};

// Static: Get all subscribers for a coach
coachSubscriptionSchema.statics.getCoachSubscribers = async function(coachId, tier = null) {
  const query = { coachId, status: 'active', coachApproved: true };
  if (tier) query.tier = tier;

  return this.find(query)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 });
};

// Static: Get coach revenue stats
coachSubscriptionSchema.statics.getCoachRevenue = async function(coachId) {
  const result = await this.aggregate([
    { $match: { coachId: new mongoose.Types.ObjectId(coachId), status: 'active' } },
    { $group: {
      _id: '$tier',
      count: { $sum: 1 },
      monthlyRevenue: { $sum: '$price' },
      totalRevenue: { $sum: '$totalPaid' }
    }}
  ]);

  return {
    content: result.find(r => r._id === 'content') || { count: 0, monthlyRevenue: 0, totalRevenue: 0 },
    coaching: result.find(r => r._id === 'coaching') || { count: 0, monthlyRevenue: 0, totalRevenue: 0 }
  };
};

module.exports = mongoose.model('CoachSubscription', coachSubscriptionSchema);
