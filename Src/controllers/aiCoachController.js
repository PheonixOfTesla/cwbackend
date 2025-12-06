// Src/controllers/aiCoachController.js - AI Coach Controller
// This is THE CORE VALUE PROP - AI that coaches individuals
const AICoach = require('../models/AICoach');
const User = require('../models/User');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini (same as pal-backend)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Model configurations - Gemini 2.0 (works with Gemini API keys)
const GEMINI_MODELS = ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-exp-1206'];

// Helper: Generate content with Gemini fallback
async function generateAIContent(prompt) {
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      console.log(`[AI Coach] Response from ${modelName}`);
      return { text: response.text(), source: modelName };
    } catch (error) {
      console.warn(`[AI Coach] ${modelName} failed:`, error.message);
      continue;
    }
  }
  throw new Error('AI service temporarily unavailable');
}

// ============================================
// GET MY AI COACH
// ============================================
exports.getMyAICoach = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get or create AI Coach for this user
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    res.json({
      success: true,
      aiCoach: {
        communicationStyle: aiCoach.communicationStyle,
        trainingPhilosophy: aiCoach.trainingPhilosophy,
        preferences: aiCoach.preferences,
        trainingHistory: aiCoach.trainingHistory,
        performanceMetrics: aiCoach.performanceMetrics,
        currentProgram: aiCoach.currentProgram,
        aiStats: {
          totalQueries: aiCoach.aiStats.totalQueries,
          queriesThisMonth: aiCoach.aiStats.queriesThisMonth,
          averageSatisfaction: aiCoach.aiStats.averageSatisfaction
        },
        recentLearnings: aiCoach.learnings.slice(-5)
      }
    });

  } catch (error) {
    console.error('Get AI Coach error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get AI Coach',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPDATE AI COACH PREFERENCES
// ============================================
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { communicationStyle, trainingPhilosophy, preferences } = req.body;

    const aiCoach = await AICoach.getOrCreateForUser(userId);

    if (communicationStyle) {
      aiCoach.communicationStyle = communicationStyle;
    }

    if (trainingPhilosophy) {
      Object.assign(aiCoach.trainingPhilosophy, trainingPhilosophy);
    }

    if (preferences) {
      Object.assign(aiCoach.preferences, preferences);
    }

    await aiCoach.save();

    res.json({
      success: true,
      message: 'AI Coach preferences updated',
      aiCoach: {
        communicationStyle: aiCoach.communicationStyle,
        trainingPhilosophy: aiCoach.trainingPhilosophy,
        preferences: aiCoach.preferences
      }
    });

  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GENERATE WORKOUT PROGRAM
// ============================================
exports.generateProgram = async (req, res) => {
  try {
    const userId = req.user.id;
    const { duration, focus, intensity } = req.body;

    // Get user data
    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    // Check subscription limits
    const features = user.getSubscriptionFeatures();
    if (aiCoach.aiStats.queriesThisMonth >= features.aiQueriesPerMonth) {
      return res.status(403).json({
        success: false,
        message: 'Monthly AI query limit reached. Upgrade to Pro for more.',
        limit: features.aiQueriesPerMonth,
        used: aiCoach.aiStats.queriesThisMonth
      });
    }

    // Build context for AI
    const userContext = {
      name: user.name,
      experience: user.experience,
      primaryGoal: user.primaryGoal,
      schedule: user.schedule,
      equipment: user.equipment,
      limitations: user.limitations,
      aiCoachContext: aiCoach.aiContext
    };

    const prompt = `You are an elite fitness coach AI for ClockWork. Generate a ${duration || '4-week'} training program.

USER PROFILE:
- Name: ${userContext.name}
- Experience Level: ${userContext.experience?.level || 'beginner'}
- Primary Discipline: ${userContext.experience?.primaryDiscipline || 'general-fitness'}
- Goal: ${userContext.primaryGoal?.type || 'general-health'}
- Days per week: ${userContext.schedule?.daysPerWeek || 3}
- Session duration: ${userContext.schedule?.sessionDuration || 60} minutes
- Equipment: ${userContext.equipment?.availableEquipment?.join(', ') || 'basic gym'}
- Injuries to avoid: ${userContext.limitations?.injuries?.map(i => i.bodyPart).join(', ') || 'none'}

AI COACH PREFERENCES:
- Communication style: ${aiCoach.communicationStyle}
- Program style: ${aiCoach.trainingPhilosophy?.programStyle}
- Volume preference: ${aiCoach.trainingPhilosophy?.volumePreference}
- Favorite exercises: ${aiCoach.preferences?.favoriteExercises?.join(', ') || 'none specified'}
- Exercises to avoid: ${aiCoach.preferences?.avoidExercises?.join(', ') || 'none'}

TRAINING HISTORY:
- Total workouts completed: ${aiCoach.trainingHistory?.totalWorkouts || 0}
- Average completion rate: ${aiCoach.trainingHistory?.averageCompletion || 0}%
- Current streak: ${aiCoach.trainingHistory?.currentStreak || 0} days

${focus ? `FOCUS AREA: ${focus}` : ''}
${intensity ? `INTENSITY LEVEL: ${intensity}` : ''}

Generate a structured program with:
1. Program overview and goals
2. Weekly structure
3. Each workout with exercises, sets, reps, and rest periods
4. Progression plan
5. Deload recommendations

Return as JSON with this structure:
{
  "programName": "string",
  "duration": "4 weeks",
  "overview": "string",
  "weeklyStructure": [...],
  "workouts": [...],
  "progressionPlan": "string",
  "deloadRecommendations": "string"
}`;

    // Use AI with automatic fallback for program generation
    const aiResponse = await generateAIContent(prompt);
    let programText = aiResponse.text;
    console.log(`[AI Coach] Program generated from ${aiResponse.source}`);

    // Try to parse as JSON
    let program;
    try {
      // Extract JSON from response if wrapped in markdown
      const jsonMatch = programText.match(/```json\n?([\s\S]*?)\n?```/) ||
                       programText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        program = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        program = { raw: programText };
      }
    } catch (e) {
      program = { raw: programText };
    }

    // Update AI coach stats
    await aiCoach.incrementQueryCount();

    // Update current program
    aiCoach.currentProgram = {
      name: program.programName || 'Custom Program',
      startDate: new Date(),
      weekNumber: 1,
      phase: 'accumulation',
      programGoal: focus || user.primaryGoal?.type
    };
    await aiCoach.save();

    res.json({
      success: true,
      program,
      aiStats: {
        queriesUsed: aiCoach.aiStats.queriesThisMonth,
        queriesRemaining: features.aiQueriesPerMonth - aiCoach.aiStats.queriesThisMonth
      }
    });

  } catch (error) {
    console.error('Generate program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GENERATE SINGLE WORKOUT
// ============================================
exports.generateWorkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { focus, duration, equipment } = req.body;

    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    // Check limits
    const features = user.getSubscriptionFeatures();
    if (aiCoach.aiStats.queriesThisMonth >= features.aiQueriesPerMonth) {
      return res.status(403).json({
        success: false,
        message: 'Monthly AI query limit reached',
        limit: features.aiQueriesPerMonth
      });
    }

    const prompt = `Generate a single ${duration || 60}-minute ${focus || 'full body'} workout.

User profile:
- Experience: ${user.experience?.level || 'beginner'}
- Equipment available: ${equipment || user.equipment?.availableEquipment?.join(', ') || 'full gym'}
- Exercises to avoid: ${user.limitations?.exercisesToAvoid?.join(', ') || 'none'}
- AI preferences: ${aiCoach.preferences?.favoriteExercises?.join(', ') || 'any'}

Return JSON:
{
  "workoutName": "string",
  "warmup": [{"exercise": "string", "duration": "string"}],
  "mainWorkout": [{"exercise": "string", "sets": number, "reps": "string", "rest": "string", "notes": "string"}],
  "cooldown": [{"exercise": "string", "duration": "string"}],
  "estimatedDuration": number,
  "difficulty": "beginner|intermediate|advanced"
}`;

    // Use AI with automatic fallback
    const aiResponse = await generateAIContent(prompt);
    let workoutText = aiResponse.text;
    console.log(`[AI Coach] Workout generated from ${aiResponse.source}`);

    let workout;
    try {
      const jsonMatch = workoutText.match(/```json\n?([\s\S]*?)\n?```/) ||
                       workoutText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        workout = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        workout = { raw: workoutText };
      }
    } catch (e) {
      workout = { raw: workoutText };
    }

    await aiCoach.incrementQueryCount();

    res.json({
      success: true,
      workout,
      aiStats: {
        queriesUsed: aiCoach.aiStats.queriesThisMonth,
        queriesRemaining: features.aiQueriesPerMonth - aiCoach.aiStats.queriesThisMonth
      }
    });

  } catch (error) {
    console.error('Generate workout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate workout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ASK COACH (General Q&A)
// ============================================
exports.askCoach = async (req, res) => {
  try {
    const userId = req.user.id;
    const { question, context } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    // Check limits
    const features = user.getSubscriptionFeatures();
    if (aiCoach.aiStats.queriesThisMonth >= features.aiQueriesPerMonth) {
      return res.status(403).json({
        success: false,
        message: 'Monthly AI query limit reached'
      });
    }

    const prompt = `You are an AI fitness coach for ${user.name}. Answer their question in a ${aiCoach.communicationStyle} tone.

USER CONTEXT:
- Experience: ${user.experience?.level || 'unknown'}
- Goal: ${user.primaryGoal?.type || 'general fitness'}
- Training style: ${aiCoach.trainingPhilosophy?.programStyle || 'general'}

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

QUESTION: ${question}

Provide a helpful, actionable answer. Be concise but thorough. Never give medical advice - refer to a doctor for health concerns.`;

    // Use AI with automatic fallback
    const aiResponse = await generateAIContent(prompt);
    const answer = aiResponse.text;
    console.log(`[AI Coach] Response from ${aiResponse.source}`);

    await aiCoach.incrementQueryCount();

    // Check for learnable patterns
    if (question.toLowerCase().includes('prefer') || question.toLowerCase().includes('like')) {
      // Potential learning opportunity - would need more logic
    }

    res.json({
      success: true,
      answer,
      aiStats: {
        queriesUsed: aiCoach.aiStats.queriesThisMonth,
        queriesRemaining: features.aiQueriesPerMonth - aiCoach.aiStats.queriesThisMonth
      }
    });

  } catch (error) {
    console.error('Ask coach error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get answer',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET AI COACH LEARNINGS
// ============================================
exports.getLearnings = async (req, res) => {
  try {
    const userId = req.user.id;
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    res.json({
      success: true,
      learnings: aiCoach.learnings,
      adaptations: aiCoach.adaptations.slice(-20)
    });

  } catch (error) {
    console.error('Get learnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get learnings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// RATE AI RESPONSE
// ============================================
exports.rateResponse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rating, queryType } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    const aiCoach = await AICoach.getOrCreateForUser(userId);

    aiCoach.aiStats.satisfactionRatings.push({
      rating,
      queryType: queryType || 'general',
      date: new Date()
    });

    // Keep only last 100 ratings
    if (aiCoach.aiStats.satisfactionRatings.length > 100) {
      aiCoach.aiStats.satisfactionRatings = aiCoach.aiStats.satisfactionRatings.slice(-100);
    }

    // Calculate average
    const ratings = aiCoach.aiStats.satisfactionRatings.map(r => r.rating);
    aiCoach.aiStats.averageSatisfaction = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    await aiCoach.save();

    res.json({
      success: true,
      message: 'Rating recorded',
      averageSatisfaction: aiCoach.aiStats.averageSatisfaction
    });

  } catch (error) {
    console.error('Rate response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// LOG WORKOUT COMPLETION (Updates AI learning)
// ============================================
exports.logWorkoutCompletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const { duration, completionRate, dayOfWeek, timeOfDay, feedback } = req.body;

    const aiCoach = await AICoach.getOrCreateForUser(userId);

    // Update stats
    await aiCoach.updateWorkoutStats({
      duration,
      completionRate
    });

    // Update preferred days
    if (dayOfWeek && !aiCoach.trainingHistory.preferredDays.includes(dayOfWeek)) {
      aiCoach.trainingHistory.preferredDays.push(dayOfWeek);
    }

    // Update peak time
    if (timeOfDay) {
      aiCoach.trainingHistory.peakPerformanceTime = timeOfDay;
    }

    // Update streak
    const lastWorkout = aiCoach.trainingHistory.lastWorkoutDate;
    const now = new Date();
    if (lastWorkout) {
      const daysDiff = Math.floor((now - lastWorkout) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 2) {
        aiCoach.trainingHistory.currentStreak += 1;
        if (aiCoach.trainingHistory.currentStreak > aiCoach.trainingHistory.longestStreak) {
          aiCoach.trainingHistory.longestStreak = aiCoach.trainingHistory.currentStreak;
        }
      } else {
        aiCoach.trainingHistory.currentStreak = 1;
      }
    } else {
      aiCoach.trainingHistory.currentStreak = 1;
    }

    // Log adaptation if feedback provided
    if (feedback) {
      await aiCoach.logAdaptation(
        'workout_feedback',
        feedback,
        completionRate > 80 ? 8 : 5
      );
    }

    await aiCoach.save();

    res.json({
      success: true,
      message: 'Workout logged',
      stats: {
        totalWorkouts: aiCoach.trainingHistory.totalWorkouts,
        currentStreak: aiCoach.trainingHistory.currentStreak,
        averageCompletion: aiCoach.trainingHistory.averageCompletion
      }
    });

  } catch (error) {
    console.error('Log workout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log workout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;
