// Src/routes/earnings.js - Earnings & Referral Routes
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/auth');
const earningsController = require('../controllers/earningsController');

// ═══════════════════════════════════════════════════════════
// PUBLIC ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════

// Validate referral code
router.get('/validate/:code', earningsController.validateCode);

// Track referral click (when someone visits with ref code)
router.post('/track/click/:code', earningsController.trackClick);

// ═══════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════

// Get earnings summary (dashboard data)
router.get('/summary', requireAuth, earningsController.getSummary);

// Get referral code
router.get('/referral-code', requireAuth, earningsController.getReferralCode);

// Get referrals list
router.get('/referrals', requireAuth, earningsController.getReferrals);

// Track signup (called during registration)
router.post('/track/signup', earningsController.trackSignup);

// Track conversion (called when someone subscribes)
router.post('/track/conversion', earningsController.trackConversion);

// ═══════════════════════════════════════════════════════════
// STRIPE CONNECT ROUTES
// ═══════════════════════════════════════════════════════════

// Start Stripe Connect onboarding
router.post('/stripe/connect', requireAuth, earningsController.startStripeOnboarding);

// Get Stripe Connect status
router.get('/stripe/status', requireAuth, earningsController.getStripeStatus);

// ═══════════════════════════════════════════════════════════
// PAYOUT ROUTES
// ═══════════════════════════════════════════════════════════

// Request a payout
router.post('/payout', requireAuth, earningsController.requestPayout);

// Get payout history
router.get('/payouts', requireAuth, earningsController.getPayoutHistory);

// Update payout preferences
router.put('/payout-preferences', requireAuth, earningsController.updatePayoutPreferences);

// ═══════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════

router.get('/leaderboard', earningsController.getLeaderboard);

module.exports = router;
