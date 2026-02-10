const InfluencerApplication = require('../models/InfluencerApplication');
const Influencer = require('../models/Influencer');
const Earnings = require('../models/Earnings');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Submit an influencer application
// @route   POST /api/influencers/apply
// @access  Public
exports.apply = async (req, res) => {
  try {
    const { name, email, platform, followerCount, engagementRate, videoLinks } = req.body;

    // Basic validation
    if (!name || !email || !platform || !followerCount) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const newApplication = new InfluencerApplication({
      name,
      email,
      platform,
      followerCount,
      engagementRate,
      videoLinks
    });

    await newApplication.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      data: newApplication
    });
  } catch (error) {
    console.error('Error submitting influencer application:', error);
    res.status(500).json({ message: 'Server error while submitting application.' });
  }
};

// @desc    Get influencer dashboard data
// @route   GET /api/influencers/dashboard
// @access  Private (Influencer)
exports.getDashboard = async (req, res) => {
    try {
        // req.influencer is attached by the requireInfluencer middleware
        const influencer = req.influencer;
        const user = req.user;

        res.json({
            success: true,
            data: {
                user: {
                    name: user.name,
                    email: user.email,
                },
                influencer: {
                    affiliateCode: influencer.affiliateCode,
                    stats: influencer.stats,
                    stripeConnected: influencer.stripeOnboardingComplete,
                    stripeAccountId: influencer.stripeAccountId
                }
            }
        });
    } catch (error) {
        console.error('Error fetching influencer dashboard:', error);
        res.status(500).json({ message: 'Server error while fetching dashboard data.' });
    }
};

// @desc    Create Stripe Connect account link
// @route   POST /api/influencers/stripe/connect
// @access  Private (Influencer)
exports.createStripeConnectLink = async (req, res) => {
    try {
        const influencer = req.influencer;
        const user = req.user;

        let stripeAccountId = influencer.stripeAccountId;

        // Create Stripe Connect account if it doesn't exist
        if (!stripeAccountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'US',
                email: user.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true }
                },
                business_type: 'individual',
                metadata: {
                    influencerId: influencer._id.toString(),
                    userId: user._id.toString(),
                    affiliateCode: influencer.affiliateCode
                }
            });

            stripeAccountId = account.id;
            influencer.stripeAccountId = stripeAccountId;
            await influencer.save();

            console.log(`✅ Stripe Connect account created for ${user.email}: ${stripeAccountId}`);
        }

        // Create account link for onboarding
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `${frontendUrl}/creator-studio?tab=payouts&refresh=true`,
            return_url: `${frontendUrl}/creator-studio?tab=payouts&success=true`,
            type: 'account_onboarding'
        });

        res.json({
            success: true,
            url: accountLink.url
        });

    } catch (error) {
        console.error('Stripe Connect link creation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create Stripe Connect link',
            error: error.message
        });
    }
};

// @desc    Get Stripe account status
// @route   GET /api/influencers/stripe/status
// @access  Private (Influencer)
exports.getStripeAccountStatus = async (req, res) => {
    try {
        const influencer = req.influencer;

        if (!influencer.stripeAccountId) {
            return res.json({
                success: true,
                connected: false,
                detailsSubmitted: false,
                chargesEnabled: false,
                payoutsEnabled: false
            });
        }

        // Fetch account status from Stripe
        const account = await stripe.accounts.retrieve(influencer.stripeAccountId);

        // Update influencer record with latest status
        influencer.stripeDetailsSubmitted = account.details_submitted;
        influencer.stripeChargesEnabled = account.charges_enabled;
        influencer.stripePayoutsEnabled = account.payouts_enabled;
        influencer.stripeOnboardingComplete = account.details_submitted && account.payouts_enabled;

        if (influencer.stripeOnboardingComplete && !influencer.stripeConnectedAt) {
            influencer.stripeConnectedAt = new Date();
        }

        await influencer.save();

        res.json({
            success: true,
            connected: true,
            detailsSubmitted: account.details_submitted,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            onboardingComplete: influencer.stripeOnboardingComplete
        });

    } catch (error) {
        console.error('Stripe status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check Stripe account status',
            error: error.message
        });
    }
};

// @desc    Handle Stripe OAuth callback (optional)
// @route   GET /api/influencers/stripe/oauth/callback
// @access  Public
exports.handleStripeOAuthCallback = async (req, res) => {
    try {
        const { code, state } = req.query;

        if (!code) {
            return res.redirect(`${process.env.FRONTEND_URL}/creator-studio?tab=payouts&error=no_code`);
        }

        // Exchange authorization code for account ID
        const response = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code
        });

        const stripeAccountId = response.stripe_user_id;

        // Find influencer by state parameter (if you passed influencer ID as state)
        if (state) {
            const influencer = await Influencer.findById(state);
            if (influencer) {
                influencer.stripeAccountId = stripeAccountId;
                influencer.stripeConnectedAt = new Date();
                await influencer.save();

                console.log(`✅ Stripe OAuth completed for influencer: ${influencer._id}`);
            }
        }

        // Redirect back to creator studio
        res.redirect(`${process.env.FRONTEND_URL}/creator-studio?tab=payouts&success=true`);

    } catch (error) {
        console.error('Stripe OAuth callback error:', error);
        res.redirect(`${process.env.FRONTEND_URL}/creator-studio?tab=payouts&error=oauth_failed`);
    }
};

// @desc    Get influencer earnings summary
// @route   GET /api/influencers/earnings
// @access  Private (Influencer)
exports.getEarnings = async (req, res) => {
    try {
        const user = req.user;

        // Get earnings record for this user
        let earnings = await Earnings.findOne({ user: user._id });

        // If no earnings record exists yet, create one
        if (!earnings) {
            const influencer = req.influencer;
            const referralCode = influencer.affiliateCode;

            earnings = new Earnings({
                user: user._id,
                earnerType: 'influencer',
                referralCode: referralCode,
                commissionRates: {
                    influencer: 15 // 15% commission for influencers
                }
            });
            await earnings.save();
        }

        // Get earnings summary using the static method
        const summary = await Earnings.getEarningsSummary(user._id);

        res.json({
            success: true,
            data: summary
        });

    } catch (error) {
        console.error('Get earnings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch earnings data',
            error: error.message
        });
    }
};
