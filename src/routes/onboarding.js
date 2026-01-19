const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const onboardingController = require('../controllers/onboardingController');

// Get onboarding status
// GET /api/onboarding/status
router.get('/status', protect, onboardingController.getStatus);

// Get current step data
// GET /api/onboarding/step/:step
router.get('/step/:step', protect, onboardingController.getStep);

// Save step data
// POST /api/onboarding/step/:step
router.post('/step/:step', protect, onboardingController.saveStep);

// Skip a step
// POST /api/onboarding/skip/:step
router.post('/skip/:step', protect, onboardingController.skipStep);

// Complete onboarding and generate initial program
// POST /api/onboarding/complete
router.post('/complete', protect, onboardingController.completeOnboarding);

// Generate initial program (can be called separately)
// POST /api/onboarding/generate-program
router.post('/generate-program', protect, onboardingController.generateProgram);

module.exports = router;
