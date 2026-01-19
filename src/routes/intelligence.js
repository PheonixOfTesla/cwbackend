// Src/routes/intelligence.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const intelligenceController = require('../controllers/intelligenceController');

// ============================================
// AI INTELLIGENCE ENDPOINTS
// ============================================

/**
 * GET /api/intelligence/:userId
 * Fetch comprehensive health metrics and AI-powered insights
 * 
 * Returns:
 * - Wearable data (steps, sleep, HRV, recovery score)
 * - Recent workout data
 * - Latest measurements
 * - Nutrition adherence
 * - Active goals progress
 * - AI-generated insights and recommendations
 */
router.get('/:userId', protect, intelligenceController.getHealthMetrics);

// ============================================
// DOCUMENTATION ROUTE
// ============================================
router.get('/', (req, res) => {
  res.json({
    name: 'Intelligence Engine API',
    version: '1.0.0',
    description: 'AI-powered health insights and recommendations',
    endpoints: {
      getMetrics: {
        method: 'GET',
        path: '/api/intelligence/:userId',
        authentication: 'required',
        description: 'Get comprehensive health metrics with AI insights',
        response: {
          metrics: {
            steps: 'number',
            sleep: 'number (minutes)',
            recoveryScore: 'number (0-100)',
            hrv: 'number (ms)',
            restingHR: 'number (bpm)',
            trainingLoad: 'number (0-100)',
            workoutsThisWeek: 'number',
            workoutCompletionRate: 'number (percentage)',
            weight: 'number',
            bodyFat: 'number',
            proteinTarget: 'number',
            proteinCurrent: 'number',
            caloriesTarget: 'number',
            caloriesCurrent: 'number',
            activeGoalsCount: 'number',
            goals: 'array'
          },
          insights: 'string (AI-generated or rule-based)',
          dataQuality: {
            wearable: 'boolean',
            workouts: 'boolean',
            measurements: 'boolean',
            nutrition: 'boolean',
            goals: 'boolean'
          },
          lastUpdated: 'timestamp'
        }
      }
    },
    features: [
      'Real-time wearable data integration',
      'Workout pattern analysis',
      'Recovery score calculation',
      'Nutrition adherence tracking',
      'Goal progress monitoring',
      'AI-powered insights via Google Gemini',
      'Smart fallback insights when AI unavailable',
      'Comprehensive health dashboard data'
    ],
    configuration: {
      aiProvider: 'Google Generative AI (Gemini Pro)',
      apiKey: process.env.GOOGLE_AI_API_KEY ? 'configured' : 'missing',
      fallbackMode: !process.env.GOOGLE_AI_API_KEY ? 'active' : 'inactive'
    }
  });
});

module.exports = router;