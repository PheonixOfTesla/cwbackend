const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const CoachProfile = require('../models/CoachProfile');
const CoachProgram = require('../models/CoachProgram');
const CoachSubscription = require('../models/CoachSubscription');
const stripeConnect = require('../services/stripeConnect');
const streamChat = require('../services/streamChat');

/**
 * Create checkout session for subscribing to a coach
 * POST /api/subscriptions/checkout
 */
router.post('/checkout', authenticate, async (req, res) => {
  try {
    const { programId } = req.body;

    const program = await CoachProgram.findById(programId);
    if (!program || !program.isActive) {
      return res.status(404).json({ message: 'Program not found' });
    }

    // Check if program is full
    if (program.maxClients && program.currentClients >= program.maxClients) {
      return res.status(400).json({ message: 'Program is full' });
    }

    const coachProfile = await CoachProfile.findById(program.coachId);
    if (!coachProfile || !coachProfile.stripeConnectAccountId || !coachProfile.stripeOnboardingComplete) {
      return res.status(400).json({ message: 'Coach is not set up to accept payments' });
    }

    // Check for existing active subscription
    const existingSub = await CoachSubscription.findOne({
      clientId: req.user._id,
      programId: programId,
      status: { $in: ['active', 'trialing'] }
    });

    if (existingSub) {
      return res.status(400).json({ message: 'You already have an active subscription to this program' });
    }

    // Create Stripe checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'https://coastal-fitness.vercel.app';

    const session = await stripeConnect.createCheckoutSession({
      coachStripeAccountId: coachProfile.stripeConnectAccountId,
      stripePriceId: program.stripePriceId,
      programId: program._id,
      clientId: req.user._id,
      coachId: coachProfile._id,
      trialDays: program.trial?.enabled ? program.trial.days : 0,
      successUrl: `${frontendUrl}/coaching/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${frontendUrl}/coach/${coachProfile._id}`,
      customerEmail: req.user.email
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ message: 'Error creating checkout session' });
  }
});

/**
 * Get my coach subscriptions
 * GET /api/subscriptions/mine
 */
router.get('/mine', authenticate, async (req, res) => {
  try {
    const subscriptions = await CoachSubscription.find({
      clientId: req.user._id
    })
      .populate({
        path: 'coachId',
        select: 'displayName profileImage userId',
        populate: { path: 'userId', select: 'name email' }
      })
      .populate('programId', 'title type pricing')
      .sort({ createdAt: -1 });

    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ message: 'Error fetching subscriptions' });
  }
});

/**
 * Cancel subscription
 * POST /api/subscriptions/:id/cancel
 */
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const subscription = await CoachSubscription.findOne({
      _id: req.params.id,
      clientId: req.user._id
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    if (!['active', 'trialing'].includes(subscription.status)) {
      return res.status(400).json({ message: 'Subscription is not active' });
    }

    // Cancel in Stripe (at period end by default)
    if (subscription.stripeSubscriptionId) {
      await stripeConnect.cancelSubscription(
        subscription.stripeSubscriptionId,
        req.body.immediately !== true
      );
    }

    subscription.cancelAtPeriodEnd = true;
    subscription.canceledAt = new Date();
    await subscription.save();

    res.json({ message: 'Subscription will be canceled at the end of the billing period' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ message: 'Error canceling subscription' });
  }
});

/**
 * Stripe webhook handler
 * POST /api/subscriptions/webhook
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripeConnect.constructWebhookEvent(req.body, sig);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const { programId, clientId, coachId } = session.metadata;

        // Create subscription record
        const subscription = new CoachSubscription({
          clientId,
          coachId,
          programId,
          status: session.subscription ? 'trialing' : 'active',
          stripeSubscriptionId: session.subscription,
          stripeCustomerId: session.customer
        });

        // Get trial info from Stripe subscription
        if (session.subscription) {
          const stripeSub = await stripeConnect.getSubscription(session.subscription);
          subscription.trialEndsAt = stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null;
          subscription.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
          subscription.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
          subscription.status = stripeSub.status;
        }

        await subscription.save();

        // Update program client count
        await CoachProgram.findByIdAndUpdate(programId, {
          $inc: { currentClients: 1 }
        });

        // Update coach total clients
        await CoachProfile.findByIdAndUpdate(coachId, {
          $inc: { totalClients: 1 }
        });

        // Create Stream Chat channel
        try {
          const coachProfile = await CoachProfile.findById(coachId).populate('userId', 'name');
          const client = await require('../models/User').findById(clientId);
          const program = await CoachProgram.findById(programId);

          const channelId = `coaching_${subscription._id}`;
          await streamChat.createCoachingChannel({
            channelId,
            coachId: coachProfile.userId._id,
            clientId,
            coachName: coachProfile.displayName,
            clientName: client.name,
            programTitle: program.title
          });

          subscription.streamChannelId = channelId;
          await subscription.save();
        } catch (chatError) {
          console.error('Stream Chat channel creation error:', chatError);
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await CoachSubscription.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          {
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          }
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const sub = await CoachSubscription.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          { status: 'canceled', canceledAt: new Date() }
        );

        if (sub) {
          // Decrease program client count
          await CoachProgram.findByIdAndUpdate(sub.programId, {
            $inc: { currentClients: -1 }
          });

          // Archive chat channel
          if (sub.streamChannelId) {
            try {
              await streamChat.archiveChannel(sub.streamChannelId);
            } catch (chatError) {
              console.error('Stream Chat archive error:', chatError);
            }
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await CoachSubscription.findOneAndUpdate(
            { stripeSubscriptionId: invoice.subscription },
            {
              $inc: {
                totalPaid: invoice.amount_paid,
                platformFeeCollected: Math.round(invoice.amount_paid * 0.20)
              }
            }
          );
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
});

module.exports = router;
