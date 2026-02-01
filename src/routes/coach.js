const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const { authenticate } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// ============================================
// PUBLIC ROUTES
// ============================================

// Browse coaches marketplace
router.get('/', coachController.browseCoaches);

// Get single coach profile
router.get('/:id', coachController.getCoachProfile);

// Get coach's programs
router.get('/:id/programs', coachController.getCoachPrograms);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

// Submit coach application
router.post('/apply', authenticate, coachController.submitApplication);

// Check own application status
router.get('/application/status', authenticate, coachController.getApplicationStatus);

// ============================================
// COACH PORTAL ROUTES (requires 'coach' role)
// ============================================

// Dashboard stats
router.get('/portal/stats', authenticate, checkRole('coach'), coachController.getPortalStats);

// Profile management
router.get('/portal/profile', authenticate, checkRole('coach'), coachController.getOwnProfile);
router.put('/portal/profile', authenticate, checkRole('coach'), coachController.updateProfile);

// Program management
router.get('/portal/programs', authenticate, checkRole('coach'), coachController.getOwnPrograms);
router.post('/portal/programs', authenticate, checkRole('coach'), coachController.createProgram);
router.put('/portal/programs/:id', authenticate, checkRole('coach'), coachController.updateProgram);
router.delete('/portal/programs/:id', authenticate, checkRole('coach'), coachController.deleteProgram);

// Client management
router.get('/portal/clients', authenticate, checkRole('coach'), coachController.getClients);

// Revenue analytics
router.get('/portal/revenue', authenticate, checkRole('coach'), coachController.getRevenue);

// Stripe Connect
router.post('/portal/stripe/connect', authenticate, checkRole('coach'), coachController.startStripeConnect);
router.get('/portal/stripe/status', authenticate, checkRole('coach'), coachController.getStripeStatus);
router.post('/portal/stripe/dashboard', authenticate, checkRole('coach'), coachController.getStripeDashboard);

// Cal.com
router.post('/portal/calcom/connect', authenticate, checkRole('coach'), coachController.connectCalcom);

module.exports = router;
