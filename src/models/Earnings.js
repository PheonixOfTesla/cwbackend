// Src/models/Earnings.js - Unified Income Tracking for All User Types
const mongoose = require('mongoose');

const earningsSchema = new mongoose.Schema({
  // The user earning money
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Type of earner
  earnerType: {
    type: String,
    enum: ['referrer', 'influencer', 'coach'],
    required: true
  },

  // ═══════════════════════════════════════════════════════════
  // REFERRAL CODE (PATF-style)
  // ═══════════════════════════════════════════════════════════
  referralCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },

  // ═══════════════════════════════════════════════════════════
  // STRIPE CONNECT (for payouts)
  // ═══════════════════════════════════════════════════════════
  stripe: {
    accountId: {
      type: String,
      default: null
    },
    onboardingComplete: {
      type: Boolean,
      default: false
    },
    payoutsEnabled: {
      type: Boolean,
      default: false
    },
    chargesEnabled: {
      type: Boolean,
      default: false
    },
    detailsSubmitted: {
      type: Boolean,
      default: false
    },
    // Bank account info (masked)
    bankLast4: String,
    bankName: String
  },

  // ═══════════════════════════════════════════════════════════
  // COMMISSION RATES (configurable per user)
  // ═══════════════════════════════════════════════════════════
  commissionRates: {
    // Referral commission (percentage of referred user's subscription)
    referral: {
      type: Number,
      default: 5 // 5% of all revenue from referred users
    },
    // Influencer commission (percentage of all conversions)
    influencer: {
      type: Number,
      default: 90 // 90% to influencer (10% to platform)
    },
    // Coach revenue share (percentage they keep from subscriptions)
    coachShare: {
      type: Number,
      default: 90 // 90% to coach (10% to platform)
    }
  },

  // ═══════════════════════════════════════════════════════════
  // EARNINGS TRACKING
  // ═══════════════════════════════════════════════════════════
  lifetime: {
    // Total earned all time (in cents)
    total: {
      type: Number,
      default: 0
    },
    // From referrals
    fromReferrals: {
      type: Number,
      default: 0
    },
    // From influencer conversions
    fromInfluencer: {
      type: Number,
      default: 0
    },
    // From coach subscriptions
    fromCoaching: {
      type: Number,
      default: 0
    },
    // Total paid out
    paidOut: {
      type: Number,
      default: 0
    }
  },

  // Current balance (available to withdraw)
  balance: {
    // Total available
    available: {
      type: Number,
      default: 0
    },
    // Pending (in 30-day hold)
    pending: {
      type: Number,
      default: 0
    },
    // Last updated
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },

  // ═══════════════════════════════════════════════════════════
  // REFERRAL STATS
  // ═══════════════════════════════════════════════════════════
  stats: {
    // Link clicks
    clicks: {
      type: Number,
      default: 0
    },
    // Signups from referral
    signups: {
      type: Number,
      default: 0
    },
    // Paid conversions
    conversions: {
      type: Number,
      default: 0
    },
    // Conversion rate
    conversionRate: {
      type: Number,
      default: 0
    },
    // Active referred subscribers
    activeSubscribers: {
      type: Number,
      default: 0
    }
  },

  // ═══════════════════════════════════════════════════════════
  // COACH-SPECIFIC STATS (only for coaches)
  // ═══════════════════════════════════════════════════════════
  coachStats: {
    // Content tier subscribers
    contentSubscribers: {
      type: Number,
      default: 0
    },
    // Coaching tier clients
    coachingClients: {
      type: Number,
      default: 0
    },
    // MRR from coaching
    monthlyRecurring: {
      type: Number,
      default: 0
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PAYOUT PREFERENCES
  // ═══════════════════════════════════════════════════════════
  payoutPreferences: {
    // Minimum payout threshold (in cents)
    minimumPayout: {
      type: Number,
      default: 2500 // $25 minimum
    },
    // Auto-payout frequency
    schedule: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'manual'],
      default: 'monthly'
    },
    // Day of week (0-6, Sunday-Saturday) for weekly/biweekly
    dayOfWeek: {
      type: Number,
      default: 1 // Monday
    },
    // Day of month for monthly
    dayOfMonth: {
      type: Number,
      default: 1 // 1st of month
    }
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'paused', 'suspended'],
    default: 'active'
  }

}, {
  timestamps: true
});

// Indexes
earningsSchema.index({ referralCode: 1 });
earningsSchema.index({ user: 1, earnerType: 1 });
earningsSchema.index({ 'balance.available': -1 });
earningsSchema.index({ 'stripe.accountId': 1 });

// Virtual: Formatted referral link
earningsSchema.virtual('referralLink').get(function() {
  const baseUrl = process.env.FRONTEND_URL || 'https://clockwork.fit';
  return `${baseUrl}?ref=${this.referralCode}`;
});

// Virtual: Is payout eligible?
earningsSchema.virtual('canPayout').get(function() {
  return this.stripe.payoutsEnabled &&
         this.stripe.onboardingComplete &&
         this.balance.available >= this.payoutPreferences.minimumPayout;
});

// Method: Generate unique referral code
earningsSchema.statics.generateReferralCode = async function(userName) {
  // Format: FirstName + random 2-digit number (e.g., JOSH42)
  const firstName = userName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  let code;
  let attempts = 0;

  do {
    const randomNum = Math.floor(Math.random() * 100);
    code = `${firstName}${randomNum.toString().padStart(2, '0')}`;
    const existing = await this.findOne({ referralCode: code });
    if (!existing) break;
    attempts++;
  } while (attempts < 100);

  // Fallback to fully random if name-based fails
  if (attempts >= 100) {
    code = `CW${Date.now().toString(36).toUpperCase()}`;
  }

  return code;
};

// Method: Record a click
earningsSchema.methods.recordClick = async function() {
  this.stats.clicks++;
  await this.save();
};

// Method: Record a signup
earningsSchema.methods.recordSignup = async function() {
  this.stats.signups++;
  this.stats.conversionRate = this.stats.clicks > 0
    ? Math.round((this.stats.signups / this.stats.clicks) * 100)
    : 0;
  await this.save();
};

// Method: Record a conversion and add commission
earningsSchema.methods.recordConversion = async function(amount, source = 'referral') {
  this.stats.conversions++;
  this.stats.activeSubscribers++;

  // Calculate commission based on source
  let commissionRate;
  if (source === 'influencer') {
    commissionRate = this.commissionRates.influencer;
  } else if (source === 'coaching') {
    commissionRate = this.commissionRates.coachShare;
  } else {
    commissionRate = this.commissionRates.referral;
  }

  const commission = Math.round(amount * (commissionRate / 100));

  // Add to pending (30-day hold)
  this.balance.pending += commission;
  this.balance.lastUpdated = new Date();

  // Update lifetime earnings
  this.lifetime.total += commission;
  if (source === 'referral') {
    this.lifetime.fromReferrals += commission;
  } else if (source === 'influencer') {
    this.lifetime.fromInfluencer += commission;
  } else if (source === 'coaching') {
    this.lifetime.fromCoaching += commission;
  }

  await this.save();
  return commission;
};

// Method: Move pending to available (after hold period)
earningsSchema.methods.releasePending = async function(amount) {
  const toRelease = Math.min(amount, this.balance.pending);
  this.balance.pending -= toRelease;
  this.balance.available += toRelease;
  this.balance.lastUpdated = new Date();
  await this.save();
  return toRelease;
};

// Method: Record payout
earningsSchema.methods.recordPayout = async function(amount) {
  this.balance.available -= amount;
  this.lifetime.paidOut += amount;
  this.balance.lastUpdated = new Date();
  await this.save();
};

// Static: Get by referral code
earningsSchema.statics.getByCode = async function(code) {
  return this.findOne({ referralCode: code.toUpperCase() });
};

// Static: Get earnings summary for a user
earningsSchema.statics.getEarningsSummary = async function(userId) {
  const earnings = await this.findOne({ user: userId });
  if (!earnings) return null;

  return {
    referralCode: earnings.referralCode,
    referralLink: earnings.referralLink,
    earnerType: earnings.earnerType,
    balance: {
      available: earnings.balance.available / 100, // Convert to dollars
      pending: earnings.balance.pending / 100
    },
    lifetime: {
      total: earnings.lifetime.total / 100,
      fromReferrals: earnings.lifetime.fromReferrals / 100,
      fromInfluencer: earnings.lifetime.fromInfluencer / 100,
      fromCoaching: earnings.lifetime.fromCoaching / 100,
      paidOut: earnings.lifetime.paidOut / 100
    },
    stats: earnings.stats,
    coachStats: earnings.coachStats,
    stripeConnected: earnings.stripe.onboardingComplete,
    canPayout: earnings.canPayout
  };
};

// Static: Get leaderboard
earningsSchema.statics.getLeaderboard = async function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'lifetime.total': -1 })
    .limit(limit)
    .populate('user', 'name coachProfile.profilePicture')
    .select('referralCode lifetime.total stats.conversions earnerType');
};

module.exports = mongoose.model('Earnings', earningsSchema);
