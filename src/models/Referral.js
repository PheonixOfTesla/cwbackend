// Src/models/Referral.js - PATF-style Referral Tracking
const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
  // The person who made the referral
  referrer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The referred user (who signed up)
  referred: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Referral code used
  code: {
    type: String,
    required: true,
    index: true
  },

  // Type of referrer
  referrerType: {
    type: String,
    enum: ['user', 'influencer', 'coach'],
    required: true
  },

  // Status of the referral
  status: {
    type: String,
    enum: ['pending', 'converted', 'expired', 'fraudulent'],
    default: 'pending'
  },

  // Commission tracking
  commission: {
    // Base rate (percentage, e.g., 10 = 10%)
    rate: {
      type: Number,
      default: 10
    },
    // Total earned from this referral
    totalEarned: {
      type: Number,
      default: 0
    },
    // Total paid out
    totalPaid: {
      type: Number,
      default: 0
    },
    // Pending (earned but not yet paid)
    pending: {
      type: Number,
      default: 0
    },
    // Commission duration in months (0 = lifetime)
    durationMonths: {
      type: Number,
      default: 12 // 12 months of recurring commission for regular referrals
    },
    // When commission expires
    expiresAt: {
      type: Date,
      default: function() {
        if (this.commission?.durationMonths === 0) return null;
        const months = this.commission?.durationMonths || 12;
        return new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
      }
    }
  },

  // Conversion tracking
  conversion: {
    // Did referred user subscribe to a paid plan?
    converted: {
      type: Boolean,
      default: false
    },
    convertedAt: Date,
    // What did they subscribe to?
    subscriptionType: {
      type: String,
      enum: ['pro', 'vip', 'coach_content', 'coach_coaching', null],
      default: null
    },
    // First payment amount
    firstPaymentAmount: {
      type: Number,
      default: 0
    }
  },

  // Attribution metadata
  attribution: {
    // URL they came from
    landingPage: String,
    // UTM params
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    // Device/browser info
    userAgent: String,
    // IP (hashed for privacy)
    ipHash: String
  },

  // Payment history for this referral
  payments: [{
    amount: Number,
    commission: Number,
    paymentId: String, // Reference to Payment/Transaction
    paidAt: Date,
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed'],
      default: 'pending'
    }
  }]

}, {
  timestamps: true
});

// Indexes
referralSchema.index({ referrer: 1, status: 1 });
referralSchema.index({ code: 1, createdAt: -1 });
referralSchema.index({ 'conversion.converted': 1, status: 1 });

// Virtual: Is commission still active?
referralSchema.virtual('isCommissionActive').get(function() {
  if (!this.commission.expiresAt) return true; // Lifetime
  return new Date() < this.commission.expiresAt;
});

// Method: Calculate and add commission from a payment
referralSchema.methods.addCommission = async function(paymentAmount, paymentId) {
  if (!this.isCommissionActive) return 0;

  const commissionAmount = Math.round(paymentAmount * (this.commission.rate / 100));

  this.commission.totalEarned += commissionAmount;
  this.commission.pending += commissionAmount;

  this.payments.push({
    amount: paymentAmount,
    commission: commissionAmount,
    paymentId,
    paidAt: new Date(),
    status: 'pending'
  });

  await this.save();
  return commissionAmount;
};

// Method: Mark referral as converted
referralSchema.methods.markConverted = async function(subscriptionType, paymentAmount) {
  this.status = 'converted';
  this.conversion.converted = true;
  this.conversion.convertedAt = new Date();
  this.conversion.subscriptionType = subscriptionType;
  this.conversion.firstPaymentAmount = paymentAmount;

  // Set commission expiry based on referrer type
  if (this.referrerType === 'influencer') {
    this.commission.durationMonths = 0; // Lifetime
    this.commission.expiresAt = null;
    this.commission.rate = 15; // 15% for influencers
  } else if (this.referrerType === 'coach') {
    this.commission.durationMonths = 0; // Lifetime
    this.commission.expiresAt = null;
    this.commission.rate = 5; // 5% for coach referrals (on top of their direct earnings)
  } else {
    this.commission.durationMonths = 12;
    this.commission.expiresAt = new Date(Date.now() + 12 * 30 * 24 * 60 * 60 * 1000);
    this.commission.rate = 10; // 10% for regular users
  }

  await this.save();
};

// Static: Get referrals by user
referralSchema.statics.getByReferrer = async function(userId, options = {}) {
  const query = { referrer: userId };
  if (options.status) query.status = options.status;

  return this.find(query)
    .populate('referred', 'name email createdAt')
    .sort({ createdAt: -1 })
    .limit(options.limit || 100);
};

// Static: Get referral stats for a user
referralSchema.statics.getReferrerStats = async function(userId) {
  const result = await this.aggregate([
    { $match: { referrer: new mongoose.Types.ObjectId(userId) } },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalEarned: { $sum: '$commission.totalEarned' },
      totalPaid: { $sum: '$commission.totalPaid' },
      pending: { $sum: '$commission.pending' }
    }}
  ]);

  const stats = {
    totalReferrals: 0,
    converted: 0,
    pending: 0,
    earnings: {
      total: 0,
      paid: 0,
      pending: 0
    }
  };

  result.forEach(r => {
    stats.totalReferrals += r.count;
    if (r._id === 'converted') {
      stats.converted = r.count;
    } else if (r._id === 'pending') {
      stats.pending = r.count;
    }
    stats.earnings.total += r.totalEarned || 0;
    stats.earnings.paid += r.totalPaid || 0;
    stats.earnings.pending += r.pending || 0;
  });

  return stats;
};

// Static: Find by referral code
referralSchema.statics.findByCode = async function(code, referredUserId) {
  return this.findOne({ code, referred: referredUserId });
};

module.exports = mongoose.model('Referral', referralSchema);
