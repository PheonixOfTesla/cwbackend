const mongoose = require('mongoose');

const coachProgramSchema = new mongoose.Schema({
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoachProfile',
    required: true
  },

  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 2000
  },

  // Program Type
  type: {
    type: String,
    enum: ['one_on_one', 'group', 'program'],
    default: 'one_on_one'
  },

  // Pricing
  pricing: {
    amount: {
      type: Number,
      required: true,
      min: 0 // in cents
    },
    currency: {
      type: String,
      default: 'usd'
    },
    billingPeriod: {
      type: String,
      enum: ['monthly', 'weekly', 'one_time'],
      default: 'monthly'
    }
  },

  // Trial Options
  trial: {
    enabled: {
      type: Boolean,
      default: false
    },
    days: {
      type: Number,
      enum: [3, 7, 14],
      default: 7
    }
  },

  // Stripe Integration
  stripeProductId: {
    type: String
  },
  stripePriceId: {
    type: String
  },

  // Features
  features: [{
    type: String,
    trim: true
  }],

  // Includes
  includes: {
    weeklyCheckIns: { type: Number, default: 0 },
    monthlyVideoCalls: { type: Number, default: 0 },
    messagingAccess: { type: Boolean, default: true },
    customWorkoutPlans: { type: Boolean, default: false },
    nutritionGuidance: { type: Boolean, default: false }
  },

  // Capacity
  maxClients: {
    type: Number,
    default: null // null = unlimited
  },
  currentClients: {
    type: Number,
    default: 0
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  },

  // Display Order
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
coachProgramSchema.index({ coachId: 1, isActive: 1 });
coachProgramSchema.index({ type: 1 });

// Virtual to check if program is full
coachProgramSchema.virtual('isFull').get(function() {
  if (this.maxClients === null) return false;
  return this.currentClients >= this.maxClients;
});

// Method to format price for display
coachProgramSchema.methods.getFormattedPrice = function() {
  const amount = (this.pricing.amount / 100).toFixed(2);
  const period = this.pricing.billingPeriod === 'one_time' ? '' : `/${this.pricing.billingPeriod}`;
  return `$${amount}${period}`;
};

module.exports = mongoose.model('CoachProgram', coachProgramSchema);
