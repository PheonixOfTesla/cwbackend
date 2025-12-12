// Src/routes/aiCoach.js - AI Coach Routes WITH RATE LIMITING
const express = require('express');
const router = express.Router();
const aiCoachController = require('../controllers/aiCoachController');
const { protect } = require('../middleware/auth');
const {
    aiGenerationLimiter,
    aiQueryLimiter
} = require('../middleware/rateLimiter');

// All routes require authentication
router.use(protect);

// ============================================
// AI COACH PROFILE
// ============================================

// GET /api/ai-coach - Get my AI coach profile
router.get('/', aiCoachController.getMyAICoach);

// PUT /api/ai-coach/preferences - Update AI coach preferences
router.put('/preferences', aiCoachController.updatePreferences);

// GET /api/ai-coach/learnings - Get what AI has learned about you
router.get('/learnings', aiCoachController.getLearnings);

// ============================================
// AI PROGRAM/WORKOUT GENERATION (RATE LIMITED)
// ============================================

// POST /api/ai-coach/generate-program - Generate a full training program (RATE LIMITED: 20/day)
router.post('/generate-program', aiGenerationLimiter, aiCoachController.generateProgram);

// POST /api/ai-coach/generate-workout - Generate a single workout (RATE LIMITED: 20/day)
router.post('/generate-workout', aiGenerationLimiter, aiCoachController.generateWorkout);

// ============================================
// AI Q&A (RATE LIMITED)
// ============================================

// POST /api/ai-coach/ask - Ask the AI coach a question (RATE LIMITED: 30/day)
router.post('/ask', aiQueryLimiter, aiCoachController.askCoach);

// ============================================
// FEEDBACK & LEARNING
// ============================================

// POST /api/ai-coach/rate - Rate an AI response
router.post('/rate', aiCoachController.rateResponse);

// POST /api/ai-coach/log-workout - Log workout completion for AI learning
router.post('/log-workout', aiCoachController.logWorkoutCompletion);

module.exports = router;
