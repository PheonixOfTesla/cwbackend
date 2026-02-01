const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const coachController = require('../controllers/coachController');

// All admin routes require authentication and admin/owner role
router.use(authenticate);
router.use(checkRole('admin', 'owner'));

// ============================================
// COACH MANAGEMENT
// ============================================

// Get pending coach applications
router.get('/coach-applications', coachController.getPendingApplications);

// Approve/reject application
router.put('/coach-applications/:id', coachController.reviewApplication);

// Get all coaches
router.get('/coaches', coachController.getAllCoaches);

// Get platform revenue from coaching
router.get('/coach-revenue', coachController.getPlatformRevenue);

module.exports = router;
