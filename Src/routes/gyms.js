const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const gymController = require('../controllers/gymController');

// ============================================
// MASTER DASHBOARD ROUTES (Owner/Engineer Only)
// ============================================

// Get all gyms (islands)
router.get('/', protect, checkRole(['owner', 'engineer']), gymController.getAllGyms);

// Create gym (island)
router.post('/create', protect, checkRole(['owner', 'engineer']), gymController.createGym);

// Delete gym (island)
router.delete('/:id', protect, checkRole(['owner', 'engineer']), gymController.deleteGym);

// ============================================
// GYM-SPECIFIC ROUTES (Owner/Admin of that gym)
// ============================================

// Get gym details
router.get('/:id', protect, gymController.getGymById);

// Update gym
router.put('/:id', protect, checkRole(['owner', 'admin']), gymController.updateGym);

// Get setup progress
router.get('/:id/progress', protect, gymController.getGymProgress);

// Update setup step
router.put('/:id/progress', protect, gymController.updateSetupProgress);

// Get gym analytics
router.get('/:id/analytics', protect, gymController.getGymAnalytics);

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

// Upgrade tier
router.put('/:id/upgrade', protect, checkRole(['owner']), gymController.upgradeTier);

// Activate subscription (after Stripe payment)
router.post('/:id/activate', protect, gymController.activateSubscription);

module.exports = router;