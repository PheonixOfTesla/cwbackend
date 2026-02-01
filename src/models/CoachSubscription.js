const mongoose = require('mongoose');

const coachSubscriptionSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoachProfile',
    required: true
  },
  programId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoachProgram',
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['trialing', 'active', 'canceled', 'past_due', 'paused'],
    default: 'trialing'
  },

  // Stripe Integration
  stripeSubscriptionId: {
    type: String
  },
  stripeCustomerId: {
    type: String
  },

  // Billing Periods
  trialEndsAt: {
    type: Date
  },
  currentPeriodStart: {
    type: Date
  },
  currentPeriodEnd: {
    type: Date
  },
  canceledAt: {
    type: Date
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },

  // Messaging
  streamChannelId: {
    type: String
  },

  // Revenue Tracking (denormalized for reporting)
  totalPaid: {
    type: Number,
    default: 0 // in cents
  },
  platformFeeCollected: {
    type: Number,
    default: 0 // in cents (20% of total)
  },

  // Notes
  notes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Indexes
coachSubscriptionSchema.index({ clientId: 1, status: 1 });
coachSubscriptionSchema.index({ coachId: 1, status: 1 });
coachSubscriptionSchema.index({ status: 1 });
coachSubscriptionSchema.index({ stripeSubscriptionId: 1 });

// Virtual to check if subscription is active
coachSubscriptionSchema.virtual('isActive').get(function() {
  return ['trialing', 'active'].includes(this.status);
});

// Method to calculate days remaining in trial
coachSubscriptionSchema.methods.getTrialDaysRemaining = function() {
  if (this.status !== 'trialing' || !this.trialEndsAt) return 0;
  const now = new Date();
  const diff = this.trialEndsAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

module.exports = mongoose.model('CoachSubscription', coachSubscriptionSchema);
