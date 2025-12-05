const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const billingController = require('../controllers/billingController');

// Process class payment
router.post('/pay/class', protect, billingController.processClassPayment);

// Get user payment history
router.get('/payments/user/:userId?', protect, billingController.getUserPayments);

// Get gym revenue (admin/owner only)
router.get('/revenue/gym/:gymId', protect, checkRole(['admin', 'owner']), billingController.getGymRevenue);

// Refund payment (admin/owner only)
router.post('/refund/:paymentId', protect, checkRole(['admin', 'owner']), billingController.refundPayment);

module.exports = router;