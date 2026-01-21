// Src/controllers/subscriptionController.js
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe Price IDs (set these in your Stripe dashboard)
const STRIPE_PRICES = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
  pro_yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
  elite_monthly: process.env.STRIPE_ELITE_MONTHLY_PRICE_ID,
  elite_yearly: process.env.STRIPE_ELITE_YEARLY_PRICE_ID
};

// Get current subscription status
exports.getStatus = async (req, res) => {
  try {
    let subscription = await Subscription.findOne({ userId: req.user.id });

    if (!subscription) {
      subscription = await Subscription.create({
        userId: req.user.id,
        tier: 'free',
        status: 'active'
      });
    }

    const limits = Subscription.TIER_LIMITS[subscription.tier];

    res.json({
      success: true,
      data: {
        ...subscription.toObject(),
        limits,
        canGenerateWorkout: subscription.canPerform('generateWorkout'),
        canAiQuery: subscription.canPerform('aiQuery'),
        canWearableSync: subscription.canPerform('wearableSync')
      }
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create checkout session
exports.createCheckout = async (req, res) => {
  try {
    const { priceKey, successUrl, cancelUrl } = req.body;

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Stripe is not configured. Please contact support.'
      });
    }

    // Check if price ID is configured
    if (!STRIPE_PRICES[priceKey]) {
      console.error(`Missing Stripe price for ${priceKey}. Set STRIPE_PRO_MONTHLY_PRICE_ID in environment.`);
      return res.status(400).json({
        success: false,
        message: 'Subscription pricing not configured. Please contact support.'
      });
    }

    // Get or create Stripe customer
    let subscription = await Subscription.findOne({ userId: req.user.id });
    let customerId = subscription?.stripeCustomerId;

    // Verify customer exists in Stripe (handles test/live mode mismatch)
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (err) {
        console.log(`Customer ${customerId} not found in Stripe, creating new one`);
        customerId = null; // Will create new customer below
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: { userId: req.user.id }
      });
      customerId = customer.id;

      if (subscription) {
        subscription.stripeCustomerId = customerId;
        await subscription.save();
      } else {
        subscription = await Subscription.create({
          userId: req.user.id,
          stripeCustomerId: customerId,
          tier: 'free'
        });
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: STRIPE_PRICES[priceKey],
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/settings?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/settings?canceled=true`,
      metadata: {
        userId: req.user.id,
        priceKey
      }
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create customer portal session
exports.createPortal = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user.id });

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription found'
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings`
    });

    res.json({
      success: true,
      data: { url: session.url }
    });
  } catch (error) {
    console.error('Create portal error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel subscription
exports.cancel = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user.id });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No active subscription'
      });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription will cancel at period end',
      data: subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reactivate subscription
exports.reactivate = async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ userId: req.user.id });

    if (!subscription?.stripeSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: 'No subscription to reactivate'
      });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    subscription.cancelAtPeriodEnd = false;
    await subscription.save();

    res.json({
      success: true,
      message: 'Subscription reactivated',
      data: subscription
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Stripe webhook handler
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await handleCheckoutComplete(session);
        break;
      }

      case 'customer.subscription.updated': {
        const stripeSubscription = event.data.object;
        await handleSubscriptionUpdate(stripeSubscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSubscription = event.data.object;
        await handleSubscriptionCancel(stripeSubscription);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        await handlePaymentSuccess(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Helper: Handle checkout complete
async function handleCheckoutComplete(session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
  const priceId = stripeSubscription.items.data[0].price.id;

  // Determine tier from price
  let tier = 'pro';
  if (priceId === STRIPE_PRICES.elite_monthly || priceId === STRIPE_PRICES.elite_yearly) {
    tier = 'elite';
  }

  // Update Subscription model
  await Subscription.findOneAndUpdate(
    { userId },
    {
      tier,
      status: 'active',
      stripeSubscriptionId: stripeSubscription.id,
      stripePriceId: priceId,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: false
    },
    { upsert: true }
  );

  // CRITICAL: Sync User model subscription field (used by FORGE AI limits)
  await User.findByIdAndUpdate(userId, {
    'subscription.tier': tier,
    'subscription.status': 'active',
    'subscription.stripeCustomerId': stripeSubscription.customer,
    'subscription.stripeSubscriptionId': stripeSubscription.id,
    'subscription.currentPeriodStart': new Date(stripeSubscription.current_period_start * 1000),
    'subscription.currentPeriodEnd': new Date(stripeSubscription.current_period_end * 1000),
    'subscription.cancelAtPeriodEnd': false
  });

  console.log(`Subscription activated for user ${userId}: ${tier} (synced to User model)`);
}

// Helper: Handle subscription update
async function handleSubscriptionUpdate(stripeSubscription) {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id
  });

  if (!subscription) return;

  const priceId = stripeSubscription.items.data[0].price.id;
  let tier = 'pro';
  if (priceId === STRIPE_PRICES.elite_monthly || priceId === STRIPE_PRICES.elite_yearly) {
    tier = 'elite';
  }

  subscription.tier = tier;
  subscription.status = stripeSubscription.status;
  subscription.stripePriceId = priceId;
  subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

  await subscription.save();

  // CRITICAL: Sync User model subscription field (used by FORGE AI limits)
  await User.findByIdAndUpdate(subscription.userId, {
    'subscription.tier': tier,
    'subscription.status': stripeSubscription.status,
    'subscription.currentPeriodStart': new Date(stripeSubscription.current_period_start * 1000),
    'subscription.currentPeriodEnd': new Date(stripeSubscription.current_period_end * 1000),
    'subscription.cancelAtPeriodEnd': stripeSubscription.cancel_at_period_end
  });
}

// Helper: Handle subscription cancel
async function handleSubscriptionCancel(stripeSubscription) {
  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id
  });

  if (!subscription) return;

  subscription.tier = 'free';
  subscription.status = 'canceled';
  subscription.stripeSubscriptionId = null;
  subscription.stripePriceId = null;

  await subscription.save();

  // CRITICAL: Sync User model subscription field (used by FORGE AI limits)
  await User.findByIdAndUpdate(subscription.userId, {
    'subscription.tier': 'free',
    'subscription.status': 'canceled',
    'subscription.stripeSubscriptionId': null
  });
}

// Helper: Handle payment success
async function handlePaymentSuccess(invoice) {
  const subscription = await Subscription.findOne({
    stripeCustomerId: invoice.customer
  });

  if (!subscription) return;

  // Reset monthly usage
  subscription.usage.aiQueriesThisMonth = 0;
  subscription.usage.lastResetDate = new Date();
  await subscription.save();
}

// Helper: Handle payment failed
async function handlePaymentFailed(invoice) {
  const subscription = await Subscription.findOne({
    stripeCustomerId: invoice.customer
  });

  if (!subscription) return;

  subscription.status = 'past_due';
  await subscription.save();
}

// Get tier limits
exports.getTierLimits = async (req, res) => {
  try {
    res.json({
      success: true,
      data: Subscription.TIER_LIMITS
    });
  } catch (error) {
    console.error('Get tier limits error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Check if action is allowed
exports.checkLimit = async (req, res) => {
  try {
    const { action } = req.params;
    let subscription = await Subscription.findOne({ userId: req.user.id });

    if (!subscription) {
      subscription = await Subscription.create({
        userId: req.user.id,
        tier: 'free'
      });
    }

    const allowed = subscription.canPerform(action);

    res.json({
      success: true,
      data: {
        allowed,
        tier: subscription.tier,
        usage: subscription.usage
      }
    });
  } catch (error) {
    console.error('Check limit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
