// Src/controllers/earningsController.js - Income Tracking for Referrals, Influencers, Coaches
const Earnings = require('../models/Earnings');
const Referral = require('../models/Referral');
const Payout = require('../models/Payout');
const User = require('../models/User');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Commission rates (in percentages)
const COMMISSION_RATES = {
  referral: 10,      // 10% for 12 months
  influencer: 15,    // 15% lifetime
  coachShare: 80     // Coach keeps 80% (platform takes 20%)
};

// ═══════════════════════════════════════════════════════════
// GET EARNINGS SUMMARY (Dashboard data)
// ═══════════════════════════════════════════════════════════
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    let earnings = await Earnings.findOne({ user: userId });

    // Create earnings record if doesn't exist
    if (!earnings) {
      const user = await User.findById(userId);
      const referralCode = await Earnings.generateReferralCode(user.name);

      earnings = await Earnings.create({
        user: userId,
        earnerType: user.userType === 'coach' ? 'coach' : user.userType === 'influencer' ? 'influencer' : 'referrer',
        referralCode,
        commissionRates: COMMISSION_RATES
      });
    }

    const summary = await Earnings.getEarningsSummary(userId);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get earnings summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET REFERRAL CODE
// ═══════════════════════════════════════════════════════════
exports.getReferralCode = async (req, res) => {
  try {
    const userId = req.user.id;

    let earnings = await Earnings.findOne({ user: userId });

    if (!earnings) {
      const user = await User.findById(userId);
      const referralCode = await Earnings.generateReferralCode(user.name);

      earnings = await Earnings.create({
        user: userId,
        earnerType: user.userType === 'coach' ? 'coach' : user.userType === 'influencer' ? 'influencer' : 'referrer',
        referralCode
      });
    }

    res.json({
      success: true,
      data: {
        referralCode: earnings.referralCode,
        referralLink: earnings.referralLink
      }
    });

  } catch (error) {
    console.error('Get referral code error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// TRACK REFERRAL CLICK (Public - called when someone visits with ref code)
// ═══════════════════════════════════════════════════════════
exports.trackClick = async (req, res) => {
  try {
    const { code } = req.params;

    const earnings = await Earnings.getByCode(code);

    if (!earnings) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    await earnings.recordClick();

    res.json({ success: true, message: 'Click tracked' });

  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// TRACK REFERRAL SIGNUP (Called during user registration)
// ═══════════════════════════════════════════════════════════
exports.trackSignup = async (req, res) => {
  try {
    const { code, referredUserId, attribution } = req.body;

    const earnings = await Earnings.getByCode(code);

    if (!earnings) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }

    // Create referral record
    const referral = await Referral.create({
      referrer: earnings.user,
      referred: referredUserId,
      code: code,
      referrerType: earnings.earnerType,
      status: 'pending',
      attribution: attribution || {}
    });

    // Update earnings stats
    await earnings.recordSignup();

    res.json({
      success: true,
      message: 'Signup tracked',
      referralId: referral._id
    });

  } catch (error) {
    console.error('Track signup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// TRACK CONVERSION (Called when referred user subscribes)
// ═══════════════════════════════════════════════════════════
exports.trackConversion = async (req, res) => {
  try {
    const { referredUserId, subscriptionType, amount } = req.body;

    // Find the referral
    const referral = await Referral.findOne({
      referred: referredUserId,
      status: 'pending'
    });

    if (!referral) {
      return res.json({ success: true, message: 'No referral to convert' });
    }

    // Mark as converted
    await referral.markConverted(subscriptionType, amount);

    // Get referrer's earnings
    const earnings = await Earnings.findOne({ user: referral.referrer });

    if (earnings) {
      // Calculate and add commission
      const source = referral.referrerType === 'influencer' ? 'influencer' : 'referral';
      const commission = await earnings.recordConversion(amount, source);

      // Add commission to referral record
      await referral.addCommission(amount, `conversion_${Date.now()}`);

      console.log(`💰 Commission earned: $${(commission / 100).toFixed(2)} for ${referral.referrerType}`);
    }

    res.json({
      success: true,
      message: 'Conversion tracked'
    });

  } catch (error) {
    console.error('Track conversion error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET REFERRALS LIST
// ═══════════════════════════════════════════════════════════
exports.getReferrals = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 50 } = req.query;

    const referrals = await Referral.getByReferrer(userId, { status, limit: parseInt(limit) });
    const stats = await Referral.getReferrerStats(userId);

    res.json({
      success: true,
      data: {
        referrals,
        stats
      }
    });

  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// STRIPE CONNECT - START ONBOARDING
// ═══════════════════════════════════════════════════════════
exports.startStripeOnboarding = async (req, res) => {
  try {
    const userId = req.user.id;

    let earnings = await Earnings.findOne({ user: userId });

    if (!earnings) {
      return res.status(404).json({ success: false, message: 'Earnings record not found' });
    }

    // Create Stripe Connect account if doesn't exist
    if (!earnings.stripe.accountId) {
      const user = await User.findById(userId);

      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        capabilities: {
          transfers: { requested: true }
        },
        metadata: {
          userId: userId.toString()
        }
      });

      earnings.stripe.accountId = account.id;
      await earnings.save();
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: earnings.stripe.accountId,
      refresh_url: `${process.env.FRONTEND_URL}/settings?stripe=refresh`,
      return_url: `${process.env.FRONTEND_URL}/settings?stripe=success`,
      type: 'account_onboarding'
    });

    res.json({
      success: true,
      data: {
        url: accountLink.url
      }
    });

  } catch (error) {
    console.error('Stripe onboarding error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// STRIPE CONNECT - CHECK STATUS
// ═══════════════════════════════════════════════════════════
exports.getStripeStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const earnings = await Earnings.findOne({ user: userId });

    if (!earnings || !earnings.stripe.accountId) {
      return res.json({
        success: true,
        data: {
          connected: false,
          onboardingComplete: false
        }
      });
    }

    // Get account status from Stripe
    const account = await stripe.accounts.retrieve(earnings.stripe.accountId);

    // Update local record
    earnings.stripe.onboardingComplete = account.details_submitted;
    earnings.stripe.payoutsEnabled = account.payouts_enabled;
    earnings.stripe.chargesEnabled = account.charges_enabled;
    earnings.stripe.detailsSubmitted = account.details_submitted;

    if (account.external_accounts?.data?.[0]) {
      earnings.stripe.bankLast4 = account.external_accounts.data[0].last4;
      earnings.stripe.bankName = account.external_accounts.data[0].bank_name;
    }

    await earnings.save();

    res.json({
      success: true,
      data: {
        connected: true,
        onboardingComplete: account.details_submitted,
        payoutsEnabled: account.payouts_enabled,
        bankLast4: earnings.stripe.bankLast4,
        bankName: earnings.stripe.bankName
      }
    });

  } catch (error) {
    console.error('Get Stripe status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// REQUEST PAYOUT
// ═══════════════════════════════════════════════════════════
exports.requestPayout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body; // Optional specific amount, otherwise withdraw all available

    const earnings = await Earnings.findOne({ user: userId });

    if (!earnings) {
      return res.status(404).json({ success: false, message: 'Earnings record not found' });
    }

    if (!earnings.stripe.payoutsEnabled) {
      return res.status(400).json({ success: false, message: 'Please complete Stripe onboarding first' });
    }

    const payoutAmount = amount || earnings.balance.available;

    if (payoutAmount < earnings.payoutPreferences.minimumPayout) {
      return res.status(400).json({
        success: false,
        message: `Minimum payout is $${(earnings.payoutPreferences.minimumPayout / 100).toFixed(2)}`
      });
    }

    if (payoutAmount > earnings.balance.available) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Create payout record
    const payout = await Payout.create({
      user: userId,
      earnings: earnings._id,
      amount: payoutAmount,
      platformFee: 0, // No fee for now
      netAmount: payoutAmount,
      method: 'stripe_connect',
      status: 'pending',
      bankDetails: {
        last4: earnings.stripe.bankLast4,
        bankName: earnings.stripe.bankName
      },
      breakdown: {
        fromReferrals: Math.min(payoutAmount, earnings.lifetime.fromReferrals - earnings.lifetime.paidOut),
        fromInfluencer: 0,
        fromCoaching: 0
      },
      periodEnd: new Date()
    });

    // Deduct from available balance (actual transfer happens in background job)
    earnings.balance.available -= payoutAmount;
    await earnings.save();

    // Transfer via Stripe Connect
    try {
      const transfer = await stripe.transfers.create({
        amount: payoutAmount,
        currency: 'usd',
        destination: earnings.stripe.accountId,
        metadata: {
          payoutId: payout._id.toString(),
          userId: userId.toString()
        }
      });

      await payout.markProcessing(transfer.id);

      // In production, Stripe webhook will confirm completion
      // For now, mark as completed
      await payout.markCompleted();

      res.json({
        success: true,
        message: `Payout of $${(payoutAmount / 100).toFixed(2)} initiated`,
        data: {
          payoutId: payout._id,
          amount: payoutAmount,
          status: 'processing'
        }
      });

    } catch (stripeError) {
      // Restore balance on failure
      earnings.balance.available += payoutAmount;
      await earnings.save();

      await payout.markFailed(stripeError.message);

      throw stripeError;
    }

  } catch (error) {
    console.error('Request payout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// GET PAYOUT HISTORY
// ═══════════════════════════════════════════════════════════
exports.getPayoutHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const payouts = await Payout.getUserHistory(userId, { limit: parseInt(limit) });

    res.json({
      success: true,
      data: payouts
    });

  } catch (error) {
    console.error('Get payout history error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// UPDATE PAYOUT PREFERENCES
// ═══════════════════════════════════════════════════════════
exports.updatePayoutPreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { minimumPayout, schedule, dayOfWeek, dayOfMonth } = req.body;

    const earnings = await Earnings.findOne({ user: userId });

    if (!earnings) {
      return res.status(404).json({ success: false, message: 'Earnings record not found' });
    }

    if (minimumPayout !== undefined) {
      earnings.payoutPreferences.minimumPayout = Math.max(2500, minimumPayout); // Min $25
    }
    if (schedule) earnings.payoutPreferences.schedule = schedule;
    if (dayOfWeek !== undefined) earnings.payoutPreferences.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) earnings.payoutPreferences.dayOfMonth = dayOfMonth;

    await earnings.save();

    res.json({
      success: true,
      message: 'Payout preferences updated',
      data: earnings.payoutPreferences
    });

  } catch (error) {
    console.error('Update payout preferences error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════
exports.getLeaderboard = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const leaderboard = await Earnings.getLeaderboard(parseInt(limit));

    res.json({
      success: true,
      data: leaderboard.map((e, i) => ({
        rank: i + 1,
        name: e.user?.name || 'Anonymous',
        avatar: e.user?.coachProfile?.profilePicture,
        referralCode: e.referralCode,
        totalEarned: (e.lifetime.total / 100).toFixed(2),
        conversions: e.stats.conversions,
        type: e.earnerType
      }))
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════
// VALIDATE REFERRAL CODE (Public)
// ═══════════════════════════════════════════════════════════
exports.validateCode = async (req, res) => {
  try {
    const { code } = req.params;

    const earnings = await Earnings.getByCode(code);

    if (!earnings || earnings.status !== 'active') {
      return res.json({
        success: true,
        data: { valid: false }
      });
    }

    const user = await User.findById(earnings.user).select('name coachProfile.profilePicture');

    res.json({
      success: true,
      data: {
        valid: true,
        referrerName: user?.name,
        referrerAvatar: user?.coachProfile?.profilePicture
      }
    });

  } catch (error) {
    console.error('Validate code error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = exports;
