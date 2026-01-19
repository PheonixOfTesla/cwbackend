// Src/routes/subscriptions.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const subscriptionController = require('../controllers/subscriptionController');

// Webhook route (raw body required for Stripe signature verification)
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  subscriptionController.handleWebhook
);

// Public routes
router.get('/tiers', subscriptionController.getTierLimits);

// Protected routes
router.use(protect);

router.get('/status', subscriptionController.getStatus);
router.post('/checkout', subscriptionController.createCheckout);
router.post('/portal', subscriptionController.createPortal);
router.post('/cancel', subscriptionController.cancel);
router.post('/reactivate', subscriptionController.reactivate);
router.get('/check/:action', subscriptionController.checkLimit);

module.exports = router;
