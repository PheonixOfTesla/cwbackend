// Src/routes/coach.js - Coach Management Routes WITH RATE LIMITING
const express = require('express');
const router = express.Router();
const coachController = require('../controllers/coachController');
const postController = require('../controllers/postController');
const coachSubscriptionController = require('../controllers/coachSubscriptionController');
const reviewController = require('../controllers/reviewController');
const { protect, requireCoach, optionalAuth } = require('../middleware/auth');
const { coachInviteLimiter } = require('../middleware/rateLimiter');

// ============================================
// PUBLIC ROUTES (No auth required)
// ============================================

// GET /api/coach/list - Get all coaches (for signup)
router.get('/list', coachController.getCoachesList);

// GET /api/coach/:coachId/reviews - Get coach reviews (public)
router.get('/:coachId/reviews', reviewController.getCoachReviews);

// ============================================
// OPTIONAL AUTH ROUTES (Works with or without login)
// ============================================

// GET /api/coach/:coachId/feed - Get coach content feed (public sees public posts, subscribers see more)
router.get('/:coachId/feed', optionalAuth, postController.getCoachFeed);

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

// ============================================
// CONTENT POSTS (Coach creates content)
// ============================================

// POST /api/coach/posts - Create a new post
router.post('/posts', postController.createPost);

// GET /api/coach/posts - Get my posts
router.get('/posts', postController.getMyPosts);

// PUT /api/coach/posts/:postId - Update a post
router.put('/posts/:postId', postController.updatePost);

// DELETE /api/coach/posts/:postId - Delete a post
router.delete('/posts/:postId', postController.deletePost);

// POST /api/coach/posts/:postId/like - Like/unlike a post
router.post('/posts/:postId/like', postController.likePost);

// ============================================
// SUBSCRIPTIONS (OF-style tiers)
// ============================================

// POST /api/coach/:coachId/subscribe - Subscribe to coach
router.post('/:coachId/subscribe', coachSubscriptionController.subscribeToCoach);

// GET /api/coach/:coachId/subscription - Get my subscription status
router.get('/:coachId/subscription', coachSubscriptionController.getSubscription);

// POST /api/coach/:coachId/unsubscribe - Cancel subscription
router.post('/:coachId/unsubscribe', coachSubscriptionController.cancelSubscription);

// GET /api/coach/subscribers - Get my subscribers (coach only)
router.get('/subscribers', coachSubscriptionController.getMySubscribers);

// GET /api/coach/applications - Get pending coaching applications
router.get('/applications', coachSubscriptionController.getPendingApplications);

// POST /api/coach/applications/:subscriptionId - Approve/reject application
router.post('/applications/:subscriptionId', coachSubscriptionController.handleCoachingApplication);

// ============================================
// REVIEWS (Coaching clients only)
// ============================================

// POST /api/coach/:coachId/reviews - Create review
router.post('/:coachId/reviews', reviewController.createReview);

// GET /api/coach/:coachId/my-review - Get my review for this coach
router.get('/:coachId/my-review', reviewController.getMyReview);

// PUT /api/coach/:coachId/reviews - Update my review
router.put('/:coachId/reviews', reviewController.updateReview);

// DELETE /api/coach/:coachId/reviews - Delete my review
router.delete('/:coachId/reviews', reviewController.deleteReview);

// POST /api/coach/reviews/:reviewId/helpful - Mark review helpful
router.post('/reviews/:reviewId/helpful', reviewController.markHelpful);

// POST /api/coach/reviews/:reviewId/respond - Coach respond to review
router.post('/reviews/:reviewId/respond', reviewController.respondToReview);

module.exports = router;
