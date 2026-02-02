// Src/controllers/coachSubscriptionController.js - OF-style Coach Subscriptions
const CoachSubscription = require('../models/CoachSubscription');
const User = require('../models/User');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Platform fee: 10%
const PLATFORM_FEE_PERCENT = 10;

// ============================================
// SUBSCRIBE TO COACH (Content or Coaching tier)
// ============================================
exports.subscribeToCoach = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;
    const { tier, applicationMessage } = req.body;

    if (!['content', 'coaching'].includes(tier)) {
      return res.status(400).json({ success: false, message: 'Invalid tier. Must be "content" or "coaching"' });
    }

    // Get coach info
    const coach = await User.findById(coachId);
    if (!coach || coach.userType !== 'coach') {
      return res.status(404).json({ success: false, message: 'Coach not found' });
    }

    // Check existing subscription
    const existing = await CoachSubscription.findOne({ userId, coachId });
    if (existing) {
      if (existing.status === 'active') {
        return res.status(400).json({ success: false, message: 'Already subscribed to this coach' });
      }
      // Reactivate cancelled subscription
      existing.status = tier === 'content' ? 'active' : 'pending_approval';
      existing.tier = tier;
      existing.applicationMessage = applicationMessage || null;
      existing.coachApproved = tier === 'content';
      await existing.save();

      return res.json({
        success: true,
        message: tier === 'content' ? 'Subscription reactivated' : 'Coaching application submitted',
        subscription: existing
      });
    }

    // Get pricing from coach profile
    const contentPrice = coach.coachProfile?.pricing?.contentTier || 999; // $9.99 default
    const coachingPrice = coach.coachProfile?.pricing?.coachingTier || 2999; // $29.99 default
    const price = tier === 'content' ? contentPrice : coachingPrice;

    // Create Stripe checkout session
    const user = await User.findById(userId);

    // Check if user has Stripe customer ID
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: userId.toString() }
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }

    // Create price for this coach subscription (dynamic)
    const stripePrice = await stripe.prices.create({
      unit_amount: price,
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: `${coach.name} - ${tier === 'content' ? 'Content Subscription' : 'Coaching Subscription'}`,
        metadata: { coachId: coachId.toString(), tier }
      }
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/coach/${coachId}?subscribed=true`,
      cancel_url: `${process.env.FRONTEND_URL}/coach/${coachId}?cancelled=true`,
      metadata: {
        userId: userId.toString(),
        coachId: coachId.toString(),
        tier,
        applicationMessage: applicationMessage || ''
      },
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_PERCENT,
        transfer_data: {
          destination: coach.stripeConnectId // Coach's Stripe Connect account
        },
        metadata: {
          userId: userId.toString(),
          coachId: coachId.toString(),
          tier
        }
      }
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Subscribe to coach error:', error);
    res.status(500).json({ success: false, message: 'Failed to create subscription' });
  }
};

// ============================================
// GET MY SUBSCRIPTION TO A COACH
// ============================================
exports.getSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;

    const subscription = await CoachSubscription.findOne({ userId, coachId })
      .populate('coachId', 'name coachProfile.profilePicture coachProfile.specialty');

    res.json({
      success: true,
      subscription: subscription || null,
      isSubscribed: subscription?.isActive() || false,
      tier: subscription?.tier || null
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscription' });
  }
};

// ============================================
// CANCEL SUBSCRIPTION
// ============================================
exports.cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;

    const subscription = await CoachSubscription.findOne({ userId, coachId, status: 'active' });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Active subscription not found' });
    }

    // Cancel in Stripe
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription will cancel at end of billing period',
      cancelAt: subscription.currentPeriodEnd
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
};

// ============================================
// GET MY SUBSCRIBERS (Coach)
// ============================================
exports.getMySubscribers = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { tier, status = 'active' } = req.query;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can access this' });
    }

    const query = { coachId, status };
    if (tier) query.tier = tier;

    const subscribers = await CoachSubscription.find(query)
      .populate('userId', 'name email createdAt')
      .sort({ createdAt: -1 });

    // Get revenue stats
    const revenueStats = await CoachSubscription.getCoachRevenue(coachId);

    res.json({
      success: true,
      subscribers,
      counts: {
        content: subscribers.filter(s => s.tier === 'content').length,
        coaching: subscribers.filter(s => s.tier === 'coaching').length,
        total: subscribers.length
      },
      revenue: revenueStats
    });

  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({ success: false, message: 'Failed to get subscribers' });
  }
};

// ============================================
// APPROVE/REJECT COACHING APPLICATION
// ============================================
exports.handleCoachingApplication = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { subscriptionId } = req.params;
    const { action } = req.body; // 'approve' or 'reject'

    if (req.user.userType !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can do this' });
    }

    const subscription = await CoachSubscription.findOne({
      _id: subscriptionId,
      coachId,
      status: 'pending_approval'
    }).populate('userId', 'name email');

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Pending application not found' });
    }

    if (action === 'approve') {
      subscription.coachApproved = true;
      subscription.status = 'active';
      await subscription.save();

      // TODO: Send approval email to user

      res.json({
        success: true,
        message: `${subscription.userId.name} has been approved for coaching`,
        subscription
      });
    } else if (action === 'reject') {
      subscription.status = 'canceled';
      await subscription.save();

      // TODO: Refund via Stripe if payment was made
      // TODO: Send rejection email

      res.json({
        success: true,
        message: 'Application rejected',
        subscription
      });
    } else {
      res.status(400).json({ success: false, message: 'Action must be "approve" or "reject"' });
    }

  } catch (error) {
    console.error('Handle application error:', error);
    res.status(500).json({ success: false, message: 'Failed to process application' });
  }
};

// ============================================
// GET PENDING APPLICATIONS (Coach)
// ============================================
exports.getPendingApplications = async (req, res) => {
  try {
    const coachId = req.user.id;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can access this' });
    }

    const applications = await CoachSubscription.find({
      coachId,
      tier: 'coaching',
      status: 'pending_approval'
    })
      .populate('userId', 'name email profile createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      applications,
      count: applications.length
    });

  } catch (error) {
    console.error('Get pending applications error:', error);
    res.status(500).json({ success: false, message: 'Failed to get applications' });
  }
};

// ============================================
// STRIPE WEBHOOK HANDLER
// ============================================
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_COACH_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const { userId, coachId, tier, applicationMessage } = session.metadata;

      // Create or update subscription record
      await CoachSubscription.findOneAndUpdate(
        { userId, coachId },
        {
          userId,
          coachId,
          tier,
          price: session.amount_total,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          status: tier === 'content' ? 'active' : 'pending_approval',
          coachApproved: tier === 'content',
          applicationMessage: applicationMessage || null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        { upsert: true, new: true }
      );

      console.log(`✅ New ${tier} subscription: user ${userId} → coach ${coachId}`);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const subscription = await CoachSubscription.findOne({
        stripeSubscriptionId: invoice.subscription
      });

      if (subscription) {
        subscription.totalPaid += invoice.amount_paid;
        subscription.currentPeriodStart = new Date(invoice.period_start * 1000);
        subscription.currentPeriodEnd = new Date(invoice.period_end * 1000);
        await subscription.save();
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSubscription = event.data.object;
      await CoachSubscription.findOneAndUpdate(
        { stripeSubscriptionId: stripeSubscription.id },
        { status: 'canceled' }
      );
      break;
    }
  }

  res.json({ received: true });
};

module.exports = exports;
