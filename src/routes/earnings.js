// Src/routes/earnings.js - Earnings & Referral Routes
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
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
router.get('/summary', protect, earningsController.getSummary);

// Get referral code
router.get('/referral-code', protect, earningsController.getReferralCode);

// Get referrals list
router.get('/referrals', protect, earningsController.getReferrals);

// Track signup (called during registration)
router.post('/track/signup', earningsController.trackSignup);

// Track conversion (called when someone subscribes)
router.post('/track/conversion', earningsController.trackConversion);

// ═══════════════════════════════════════════════════════════
// STRIPE CONNECT ROUTES
// ═══════════════════════════════════════════════════════════

// Start Stripe Connect onboarding
router.post('/stripe/connect', protect, earningsController.startStripeOnboarding);

// Get Stripe Connect status
router.get('/stripe/status', protect, earningsController.getStripeStatus);

// ═══════════════════════════════════════════════════════════
// PAYOUT ROUTES
// ═══════════════════════════════════════════════════════════

// Request a payout
router.post('/payout', protect, earningsController.requestPayout);

// Get payout history
router.get('/payouts', protect, earningsController.getPayoutHistory);

// Update payout preferences
router.put('/payout-preferences', protect, earningsController.updatePayoutPreferences);

// ═══════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════

router.get('/leaderboard', earningsController.getLeaderboard);

module.exports = router;
