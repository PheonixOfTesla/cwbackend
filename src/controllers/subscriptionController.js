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

/**
 * Gets the tier string from a Stripe price ID.
 * @param {string} priceId The Stripe Price ID.
 * @returns {string} The corresponding tier ('pro', 'elite', etc.).
 */
const getTierFromPriceId = (priceId) => {
  for (const tier in STRIPE_PRICES) {
    if (STRIPE_PRICES[tier] === priceId) {
      return tier.split('_')[0]; // 'pro_monthly' -> 'pro'
    }
  }
  return 'pro'; // Default fallback
};

/**
 * Centralized function to sync subscription state from a Stripe subscription object.
 */
const syncSubscription = async (stripeSubscription, metadata = {}) => {
  const stripeSubscriptionId = stripeSubscription.id;
  
  // Metadata from the checkout session is the most reliable source for our internal IDs.
  const userId = metadata.userId;
  const creatorId = metadata.creatorId;

  if (!userId || !creatorId) {
      console.error(`Webhook for subscription ${stripeSubscriptionId} is missing critical metadata (userId or creatorId). Cannot sync.`);
      return;
  }

  const priceId = stripeSubscription.items.data[0].price.id;
  const tier = getTierFromPriceId(priceId);

  const subscriptionData = {
    userId,
    creatorId,
    tier,
    status: stripeSubscription.status,
    stripeCustomerId: stripeSubscription.customer,
    stripeSubscriptionId: stripeSubscriptionId,
    stripePriceId: priceId,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
  };

  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: stripeSubscriptionId },
    subscriptionData,
    { upsert: true, new: true }
  );

  console.log(`Subscription synced for user ${userId} to creator ${creatorId}: Tier ${tier}, Status ${subscriptionData.status}`);
};

// Get current subscription status for a specific creator
exports.getStatus = async (req, res) => {
    try {
        const { creatorId } = req.query;
        if (!creatorId) {
            return res.status(400).json({ success: false, message: 'creatorId is required' });
        }

        const subscription = await Subscription.findOne({ userId: req.user.id, creatorId: creatorId });

        if (!subscription) {
            return res.json({ success: true, data: { status: 'unsubscribed', tier: 'free' } });
        }

        const limits = Subscription.TIER_LIMITS[subscription.tier];
        res.json({
            success: true,
            data: {
                ...subscription.toObject(),
                limits,
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
    const { priceKey, successUrl, cancelUrl, creatorId } = req.body;

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ success: false, message: 'Stripe is not configured.' });
    }
    if (!creatorId) {
      return res.status(400).json({ success: false, message: 'creatorId is required.' });
    }

    const priceId = STRIPE_PRICES[priceKey];
    if (!priceId) {
      return res.status(400).json({ success: false, message: 'Subscription pricing not configured.' });
    }

    // Find subscription for the user, though we may not have one yet.
    let subscription = await Subscription.findOne({ userId: req.user.id, creatorId });
    let customerId = subscription?.stripeCustomerId;
    
    // If we don't have a Stripe Customer ID for this user yet, create one.
    if (!customerId) {
        // Let's see if this user has *any* subscription to get their customer ID
        const anySub = await Subscription.findOne({ userId: req.user.id });
        if (anySub?.stripeCustomerId) {
            customerId = anySub.stripeCustomerId;
        } else {
            const customer = await stripe.customers.create({
                email: req.user.email,
                name: req.user.name,
                metadata: { userId: req.user.id.toString() }
            });
            customerId = customer.id;
        }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl || `${process.env.FRONTEND_URL}/settings?success=true`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/settings?canceled=true`,
      metadata: {
        userId: req.user.id.toString(),
        creatorId: creatorId.toString(),
      }
    });

    res.json({
      success: true,
      data: { sessionId: session.id, url: session.url }
    });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// Create customer portal session
exports.createPortal = async (req, res) => {
  try {
    // Find any subscription for the user to get their customer ID
    const subscription = await Subscription.findOne({ userId: req.user.id });

    if (!subscription?.stripeCustomerId) {
      return res.status(400).json({ success: false, message: 'No Stripe customer ID found for this user.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings`
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error('Create portal error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Cancel a specific subscription
exports.cancel = async (req, res) => {
    try {
        const { subscriptionId } = req.body; // The DB ID of the subscription
        if (!subscriptionId) {
            return res.status(400).json({ success: false, message: 'Subscription ID is required.' });
        }
        const subscription = await Subscription.findOne({ _id: subscriptionId, userId: req.user.id });

        if (!subscription?.stripeSubscriptionId) {
            return res.status(400).json({ success: false, message: 'No active Stripe subscription found to cancel.' });
        }

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true
        });

        subscription.cancelAtPeriodEnd = true;
        await subscription.save();

        res.json({ success: true, message: 'Subscription will cancel at period end', data: subscription });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Reactivate a specific subscription
exports.reactivate = async (req, res) => {
    try {
        const { subscriptionId } = req.body; // The DB ID of the subscription
        if (!subscriptionId) {
            return res.status(400).json({ success: false, message: 'Subscription ID is required.' });
        }
        const subscription = await Subscription.findOne({ _id: subscriptionId, userId: req.user.id });

        if (!subscription?.stripeSubscriptionId) {
            return res.status(400).json({ success: false, message: 'No subscription to reactivate.' });
        }

        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: false
        });

        subscription.cancelAtPeriodEnd = false;
        await subscription.save();

        res.json({ success: true, message: 'Subscription reactivated', data: subscription });
    } catch (error) {
        console.error('Reactivate subscription error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Stripe webhook handler
exports.handleWebhook = async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('CRITICAL ERROR: STRIPE_WEBHOOK_SECRET is not set. Aborting.');
    return res.status(500).send('Webhook secret not configured.');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const stripeObject = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = stripeObject;
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        // Pass metadata from the session, which contains our internal IDs
        await syncSubscription(subscription, session.metadata);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // For these events, metadata is on the subscription object itself
        await syncSubscription(stripeObject, stripeObject.metadata);
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const subscription = await Subscription.findOne({ stripeCustomerId: stripeObject.customer });
        if (subscription) {
          subscription.usage.aiQueriesThisMonth = 0;
          subscription.usage.lastResetDate = new Date();
          await subscription.save();
        }
        break;
      }

      case 'invoice.payment_failed': {
        const subscription = await Subscription.findOne({ stripeCustomerId: stripeObject.customer });
        if (subscription) {
          subscription.status = 'past_due';
          await subscription.save();
        }
        break;
      }

      default:
        // Unhandled event type
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Check if action is allowed for a specific creator's subscription
exports.checkLimit = async (req, res) => {
  try {
    const { action } = req.params;
    const { creatorId } = req.query;

    if (!creatorId) {
      return res.status(400).json({ success: false, message: 'creatorId query parameter is required.' });
    }

    const subscription = await Subscription.findOne({ userId: req.user.id, creatorId });

    if (!subscription) {
      // If no specific subscription, check against 'free' tier limits
      const limits = Subscription.TIER_LIMITS['free'];
      const allowed = limits[action] !== false && limits[action] > 0;
      return res.json({
        success: true,
        data: { allowed, tier: 'free', usage: {} }
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
