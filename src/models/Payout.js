// Src/models/Payout.js - Payout Transaction History
const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  // The user receiving the payout
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Reference to their Earnings record
  earnings: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Earnings',
    required: true
  },

  // Amount in cents
  amount: {
    type: Number,
    required: true
  },

  // Platform fee taken (if any)
  platformFee: {
    type: Number,
    default: 0
  },

  // Net amount sent to user
  netAmount: {
    type: Number,
    required: true
  },

  // Currency
  currency: {
    type: String,
    default: 'usd'
  },

  // Payout method
  method: {
    type: String,
    enum: ['stripe_connect', 'manual', 'bank_transfer'],
    default: 'stripe_connect'
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'canceled'],
    default: 'pending'
  },

  // Stripe payout ID (if using Stripe Connect)
  stripePayoutId: {
    type: String,
    default: null
  },

  // Stripe transfer ID (for Connect)
  stripeTransferId: {
    type: String,
    default: null
  },

  // Bank details (masked)
  bankDetails: {
    last4: String,
    bankName: String,
    routingLast4: String
  },

  // Breakdown of what this payout includes
  breakdown: {
    fromReferrals: {
      type: Number,
      default: 0
    },
    fromInfluencer: {
      type: Number,
      default: 0
    },
    fromCoaching: {
      type: Number,
      default: 0
    }
  },

  // Processing timestamps
  processedAt: Date,
  completedAt: Date,
  failedAt: Date,

  // Failure reason if failed
  failureReason: String,

  // Notes
  notes: String,

  // Period this payout covers
  periodStart: Date,
  periodEnd: Date

}, {
  timestamps: true
});

// Indexes
payoutSchema.index({ user: 1, status: 1 });
payoutSchema.index({ stripePayoutId: 1 });
payoutSchema.index({ status: 1, createdAt: -1 });

// Virtual: Formatted amount
payoutSchema.virtual('formattedAmount').get(function() {
  return `$${(this.netAmount / 100).toFixed(2)}`;
});

// Method: Mark as processing
payoutSchema.methods.markProcessing = async function(stripeTransferId = null) {
  this.status = 'processing';
  this.processedAt = new Date();
  if (stripeTransferId) this.stripeTransferId = stripeTransferId;
  await this.save();
};

// Method: Mark as completed
payoutSchema.methods.markCompleted = async function(stripePayoutId = null) {
  this.status = 'completed';
  this.completedAt = new Date();
  if (stripePayoutId) this.stripePayoutId = stripePayoutId;
  await this.save();

  // Update user's earnings record
  const Earnings = mongoose.model('Earnings');
  await Earnings.findByIdAndUpdate(this.earnings, {
    $inc: {
      'balance.available': -this.amount,
      'lifetime.paidOut': this.amount
    }
  });
};

// Method: Mark as failed
payoutSchema.methods.markFailed = async function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  await this.save();

  // Restore balance to user's earnings
  const Earnings = mongoose.model('Earnings');
  await Earnings.findByIdAndUpdate(this.earnings, {
    $inc: { 'balance.available': this.amount }
  });
};

// Static: Get payout history for user
payoutSchema.statics.getUserHistory = async function(userId, options = {}) {
  const query = { user: userId };
  if (options.status) query.status = options.status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Static: Get pending payouts (for admin/processing)
payoutSchema.statics.getPendingPayouts = async function() {
  return this.find({ status: 'pending' })
    .populate('user', 'name email')
    .populate('earnings', 'stripe.accountId referralCode')
    .sort({ createdAt: 1 });
};

// Static: Get payout stats
payoutSchema.statics.getStats = async function(options = {}) {
  const match = {};
  if (options.startDate) match.createdAt = { $gte: options.startDate };
  if (options.endDate) {
    match.createdAt = match.createdAt || {};
    match.createdAt.$lte = options.endDate;
  }

  const result = await this.aggregate([
    { $match: match },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      totalAmount: { $sum: '$amount' },
      totalNet: { $sum: '$netAmount' }
    }}
  ]);

  return result.reduce((acc, r) => {
    acc[r._id] = {
      count: r.count,
      totalAmount: r.totalAmount,
      totalNet: r.totalNet
    };
    return acc;
  }, {});
};

module.exports = mongoose.model('Payout', payoutSchema);
