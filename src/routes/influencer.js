const express = require('express');
const router = express.Router();
const {
    apply,
    getDashboard,
    createStripeConnectLink,
    getStripeAccountStatus,
    handleStripeOAuthCallback,
    getEarnings
} = require('../controllers/influencerController');
const { protect } = require('../middleware/auth');
const { requireInfluencer } = require('../middleware/influencerAuth');

// @route   POST /api/influencers/apply
router.post('/apply', apply);

// @route   GET /api/influencers/dashboard
router.get('/dashboard', protect, requireInfluencer, getDashboard);

// @route   GET /api/influencers/earnings
// @desc    Get influencer earnings and revenue breakdown
router.get('/earnings', protect, requireInfluencer, getEarnings);

// @route   POST /api/influencers/stripe/connect
// @desc    Create Stripe Connect account link for influencer
router.post('/stripe/connect', protect, requireInfluencer, createStripeConnectLink);

// @route   GET /api/influencers/stripe/status
// @desc    Get Stripe account connection status
router.get('/stripe/status', protect, requireInfluencer, getStripeAccountStatus);

// @route   GET /api/influencers/stripe/oauth/callback
// @desc    Handle Stripe OAuth callback (optional but recommended)
router.get('/stripe/oauth/callback', handleStripeOAuthCallback);

module.exports = router;
