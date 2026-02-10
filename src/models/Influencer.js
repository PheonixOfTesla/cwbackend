const mongoose = require('mongoose');

const influencerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InfluencerApplication',
    required: true
  },
  affiliateCode: {
    type: String,
    required: true,
    unique: true
  },
  stripeAccountId: {
    type: String,
    default: null
  },
  stripeOnboardingComplete: {
    type: Boolean,
    default: false
  },
  stripeDetailsSubmitted: {
    type: Boolean,
    default: false
  },
  stripeChargesEnabled: {
    type: Boolean,
    default: false
  },
  stripePayoutsEnabled: {
    type: Boolean,
    default: false
  },
  stripeConnectedAt: {
    type: Date,
    default: null
  },
  stats: {
    clicks: {
      type: Number,
      default: 0
    },
    signups: {
      type: Number,
      default: 0
    },
    paidConversions: {
      type: Number,
      default: 0
    },
    revenueGenerated: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

influencerSchema.index({ affiliateCode: 1 });
influencerSchema.index({ user: 1 });

module.exports = mongoose.model('Influencer', influencerSchema);
