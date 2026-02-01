const express = require('express');
const router = express.Router();
const { apply, getDashboard } = require('../controllers/influencerController');
const { protect } = require('../middleware/auth');
const { requireInfluencer } = require('../middleware/influencerAuth');

// @route   POST /api/influencers/apply
router.post('/apply', apply);

// @route   GET /api/influencers/dashboard
router.get('/dashboard', protect, requireInfluencer, getDashboard);

module.exports = router;
