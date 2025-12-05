// Src/models/Subscription.js
const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Tier
  tier: {
    type: String,
    enum: ['free', 'pro', 'elite'],
    default: 'free'
  },

  // Stripe IDs
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  stripePriceId: String,

  // Status
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete'],
    default: 'active'
  },

  // Billing cycle
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },

  // Trial
  trialEnd: Date,

  // Usage (for limits)
  usage: {
    workoutsGenerated: { type: Number, default: 0 },
    aiQueriesThisMonth: { type: Number, default: 0 },
    lastResetDate: Date
  }

}, { timestamps: true });

// Tier Limits
subscriptionSchema.statics.TIER_LIMITS = {
  free: {
    workoutsPerWeek: 3,
    aiWorkoutGenerations: 2,
    aiCoachingQueries: 5,
    wearableSync: false,
    communities: 1,
    checkInReminders: false,
    exportData: false
  },
  pro: {
    workoutsPerWeek: Infinity,
    aiWorkoutGenerations: 20,
    aiCoachingQueries: 50,
    wearableSync: true,
    communities: 10,
    checkInReminders: true,
    exportData: true
  },
  elite: {
    workoutsPerWeek: Infinity,
    aiWorkoutGenerations: Infinity,
    aiCoachingQueries: Infinity,
    wearableSync: true,
    communities: Infinity,
    checkInReminders: true,
    exportData: true,
    prioritySupport: true,
    betaFeatures: true
  }
};

// Check if user can perform action
subscriptionSchema.methods.canPerform = function(action) {
  const limits = this.constructor.TIER_LIMITS[this.tier];

  switch(action) {
    case 'generateWorkout':
      return limits.aiWorkoutGenerations === Infinity ||
             this.usage.workoutsGenerated < limits.aiWorkoutGenerations;
    case 'aiQuery':
      return limits.aiCoachingQueries === Infinity ||
             this.usage.aiQueriesThisMonth < limits.aiCoachingQueries;
    case 'wearableSync':
      return limits.wearableSync;
    case 'exportData':
      return limits.exportData;
    default:
      return true;
  }
};

// Increment usage
subscriptionSchema.methods.incrementUsage = async function(action) {
  switch(action) {
    case 'generateWorkout':
      this.usage.workoutsGenerated += 1;
      break;
    case 'aiQuery':
      this.usage.aiQueriesThisMonth += 1;
      break;
  }
  await this.save();
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
