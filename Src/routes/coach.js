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

// DELETE /api/coach/clients/:clientId - Remove a client
router.delete('/clients/:clientId', coachController.removeClient);

// PUT /api/coach/clients/:clientId/notes - Update client notes
router.put('/clients/:clientId/notes', coachController.updateClientNotes);

// GET /api/coach/clients/:clientId/progress - Get client progress
router.get('/clients/:clientId/progress', coachController.getClientProgress);

// POST /api/coach/clients/:clientId/assign-program - Assign program to client
router.post('/clients/:clientId/assign-program', coachController.assignProgram);

// ============================================
// INVITATION HANDLING (Client side)
// ============================================

// POST /api/coach/accept-invitation/:invitationCode - Accept coach invitation
router.post('/accept-invitation/:invitationCode', coachController.acceptInvitation);

module.exports = router;
