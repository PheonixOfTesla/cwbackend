// Src/routes/coach.js - Coach Management Routes WITH RATE LIMITING
const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const { protect, requireCoach } = require('../middleware/auth');
const { coachInviteLimiter } = require('../middleware/rateLimiter');

// ============================================
// PUBLIC ROUTES (No auth required)
// ============================================

// GET /api/coach/list - Get all coaches (for signup)
router.get('/list', coachController.getCoachesList);

// All routes below require authentication
router.use(protect);

// ============================================
// COACH PROFILE
// ============================================

// GET /api/coach/profile - Get my coach profile
router.get('/profile', coachController.getCoachProfile);

// PUT /api/coach/profile - Update my coach profile
router.put('/profile', coachController.updateCoachProfile);

// POST /api/coach/profile/picture - Upload profile picture
router.post('/profile/picture', coachController.uploadProfilePicture);

// ============================================
// COACH DASHBOARD
// ============================================

// GET /api/coach/dashboard - Get coach dashboard stats
router.get('/dashboard', coachController.getDashboardStats);

// GET /api/coach/clients - Get all my clients
router.get('/clients', coachController.getMyClients);

// ============================================
// CLIENT MANAGEMENT (RATE LIMITED)
// ============================================

// POST /api/coach/invite - Invite a new client (RATE LIMITED: 10/hour)
router.post('/invite', coachInviteLimiter, coachController.inviteClient);

// PUT /api/coach/clients/:relationshipId/approve - Approve pending client
router.put('/clients/:relationshipId/approve', coachController.approveClient);

// DELETE /api/coach/clients/:relationshipId - Remove/reject a client
router.delete('/clients/:relationshipId', coachController.removeClient);

// PUT /api/coach/clients/:clientId/notes - Update client notes
router.put('/clients/:clientId/notes', coachController.updateClientNotes);

// GET /api/coach/clients/:clientId/progress - Get client progress
router.get('/clients/:clientId/progress', coachController.getClientProgress);

// ============================================
// WORKOUT CREATION & ASSIGNMENT
// ============================================

// POST /api/coach/clients/:clientId/workouts - Create workout for client
router.post('/clients/:clientId/workouts', coachController.createWorkout);

// GET /api/coach/clients/:clientId/workouts - Get client's workouts
router.get('/clients/:clientId/workouts', coachController.getClientWorkouts);

// POST /api/coach/clients/:clientId/assign-program - Assign program to client
router.post('/clients/:clientId/assign-program', coachController.assignProgram);

// ============================================
// SCHEDULING & PAYMENTS
// ============================================

// PUT /api/coach/scheduling - Update scheduling preferences
router.put('/scheduling', coachController.updateScheduling);

// PUT /api/coach/payment-methods - Update payment methods
router.put('/payment-methods', coachController.updatePaymentMethods);

// GET /api/coach/:coachId/availability - Get coach availability (public)
router.get('/:coachId/availability', coachController.getAvailability);

// GET /api/coach/sessions - Get my sessions
router.get('/sessions', coachController.getSessions);

// ============================================
// INVITATION HANDLING (Client side)
// ============================================

// POST /api/coach/accept-invitation/:invitationCode - Accept coach invitation
router.post('/accept-invitation/:invitationCode', coachController.acceptInvitation);

module.exports = router;
