const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PLATFORM_FEE_PERCENT = 20;

/**
 * Create a Stripe Connect Express account for a coach
 */
exports.createConnectAccount = async (email, userId) => {
  const account = await stripe.accounts.create({
    type: 'express',
    email: email,
    metadata: {
      userId: userId.toString()
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true }
    }
  });
  return account;
};

/**
 * Generate onboarding link for coach to complete Stripe setup
 */
exports.createOnboardingLink = async (accountId, returnUrl, refreshUrl) => {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding'
  });
  return accountLink.url;
};

/**
 * Get coach's Stripe dashboard login link
 */
exports.createDashboardLink = async (accountId) => {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
};

/**
 * Check if coach's Stripe account is fully onboarded
 */
exports.checkAccountStatus = async (accountId) => {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements
  };
};

/**
 * Create a Stripe Product and Price for a coach program
 */
exports.createProgramProduct = async (coachAccountId, program) => {
  // Create product
  const product = await stripe.products.create({
    name: program.title,
    description: program.description,
    metadata: {
      programId: program._id.toString(),
      coachId: program.coachId.toString()
    }
  });

  // Create price
  const priceData = {
    product: product.id,
    unit_amount: program.pricing.amount,
    currency: program.pricing.currency || 'usd',
    metadata: {
      programId: program._id.toString()
    }
  };

  if (program.pricing.billingPeriod !== 'one_time') {
    priceData.recurring = {
      interval: program.pricing.billingPeriod === 'weekly' ? 'week' : 'month'
    };
  }

  const price = await stripe.prices.create(priceData);

  return {
    productId: product.id,
    priceId: price.id
  };
};

/**
 * Create checkout session with destination charges (80% coach, 20% platform)
 */
exports.createCheckoutSession = async ({
  coachStripeAccountId,
  stripePriceId,
  programId,
  clientId,
  coachId,
  trialDays,
  successUrl,
  cancelUrl,
  customerEmail
}) => {
  const sessionConfig = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{
      price: stripePriceId,
      quantity: 1
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      programId: programId.toString(),
      clientId: clientId.toString(),
      coachId: coachId.toString()
    },
    subscription_data: {
      application_fee_percent: PLATFORM_FEE_PERCENT,
      transfer_data: {
        destination: coachStripeAccountId
      },
      metadata: {
        programId: programId.toString(),
        clientId: clientId.toString(),
        coachId: coachId.toString()
      }
    }
  };

  // Add trial if enabled
  if (trialDays && trialDays > 0) {
    sessionConfig.subscription_data.trial_period_days = trialDays;
  }

  // Add customer email if provided
  if (customerEmail) {
    sessionConfig.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session;
};

/**
 * Cancel a subscription
 */
exports.cancelSubscription = async (stripeSubscriptionId, cancelAtPeriodEnd = true) => {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true
    });
  } else {
    return await stripe.subscriptions.cancel(stripeSubscriptionId);
  }
};

/**
 * Get subscription details
 */
exports.getSubscription = async (stripeSubscriptionId) => {
  return await stripe.subscriptions.retrieve(stripeSubscriptionId);
};

/**
 * Construct webhook event
 */
exports.constructWebhookEvent = (payload, signature) => {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};

/**
 * Get coach revenue stats from Stripe
 */
exports.getCoachRevenue = async (coachStripeAccountId, startDate, endDate) => {
  const transfers = await stripe.transfers.list({
    destination: coachStripeAccountId,
    created: {
      gte: Math.floor(startDate.getTime() / 1000),
      lte: Math.floor(endDate.getTime() / 1000)
    },
    limit: 100
  });

  const totalRevenue = transfers.data.reduce((sum, t) => sum + t.amount, 0);

  return {
    totalRevenue,
    transferCount: transfers.data.length,
    transfers: transfers.data
  };
};

module.exports = exports;
