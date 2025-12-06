// Src/controllers/aiCoachController.js - FORGE AI Coach Controller
// This is THE CORE VALUE PROP - AI that coaches individuals
const AICoach = require('../models/AICoach');
const User = require('../models/User');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic (Claude) - primary and ONLY AI provider
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022'; // Haiku 3.5 - fast & cost-effective

// FORGE PERSONALITY SYSTEM PROMPT - Encouraging but Practical
const FORGE_IDENTITY = `You are FORGE - your AI fitness coach built into ClockWork.

PERSONALITY:
- Encouraging and supportive, but always practical and honest
- Celebrate every win, no matter how small - progress is progress
- Give actionable advice, not just motivation
- Use "we" language - you're on this journey together with them
- Be warm but not fake - no toxic positivity or empty hype
- When they're struggling, acknowledge it AND offer real solutions
- Reference their actual data/progress when encouraging them

COMMUNICATION:
- Keep it concise (2-4 sentences usually, expand when needed)
- Use their name occasionally to make it personal
- Specific praise beats generic praise ("Great job hitting 475 on squat!" not "You're doing great!")
- Always end with a clear next step or thoughtful question
- Light humor is welcome but never at their expense
- Use *asterisks* for emphasis on key points

EXPERTISE:
- Strength training, powerlifting, bodybuilding
- Recovery and periodization strategies
- Practical nutrition guidance (not prescriptive macros without assessment)
- Interpreting wearable and recovery data
- Competition prep and peaking

NEVER:
- Give medical advice - always refer to healthcare professionals
- Be condescending or dismissive of their efforts
- Use excessive emojis or act overly peppy
- Make promises about specific results or timelines
- Ignore their stated limitations or injuries

REMEMBER: You're their coach and partner in this. Build the relationship. When they succeed, you succeed together.`;



// Helper: Generate content with Claude (Anthropic only) + 30s timeout
const AI_TIMEOUT_MS = 30000; // 30 seconds

async function generateAIContent(prompt, systemPrompt = null) {
  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS);
    });

    // Race between API call and timeout
    const message = await Promise.race([
      anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: systemPrompt || FORGE_IDENTITY,
        messages: [{ role: 'user', content: prompt }]
      }),
      timeoutPromise
    ]);

    console.log('[FORGE] Response from Claude Haiku 3.5');
    return { text: message.content[0].text, source: 'claude' };
  } catch (error) {
    if (error.message === 'AI_TIMEOUT') {
      console.error('[FORGE] Claude timeout after 30s');
      throw new Error('FORGE is taking too long - please try again');
    }
    console.error('[FORGE] Claude error:', error.message);
    throw new Error('FORGE is temporarily unavailable - please try again');
  }
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
// ACTION DETECTION HELPERS
// ============================================
const CalendarEvent = require('../models/CalendarEvent');

// Detect if user is asking FORGE to DO something
function detectActionIntent(question) {
  const q = question.toLowerCase();

  // Calendar/Schedule actions
  if (q.includes('calendar') || q.includes('schedule') || q.includes('add workout') ||
      q.includes('create workout') || q.includes('put') && (q.includes('calendar') || q.includes('schedule')) ||
      q.includes('propagate') || q.includes('generate') && (q.includes('week') || q.includes('program') || q.includes('plan'))) {
    return 'GENERATE_CALENDAR';
  }

  // Single workout generation
  if ((q.includes('workout') || q.includes('routine')) &&
      (q.includes('give me') || q.includes('create') || q.includes('make') || q.includes('generate'))) {
    return 'GENERATE_WORKOUT';
  }

  // Modify existing workout
  if (q.includes('modify') || q.includes('adjust') || q.includes('change') || q.includes('swap')) {
    return 'MODIFY_WORKOUT';
  }

  return null; // Regular Q&A
}

// ============================================
// ASK COACH (General Q&A + Actions) WITH CONVERSATION MEMORY
// ============================================
exports.askCoach = async (req, res) => {
  try {
    const userId = req.user.id;
    const { question, context, conversationHistory } = req.body;

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

    // Detect if this is an action request
    const actionIntent = detectActionIntent(question);
    let actionResult = null;
    let actionPromptAddition = '';

    // Execute actions if detected
    if (actionIntent === 'GENERATE_CALENDAR') {
      try {
        console.log('[FORGE] Executing action: GENERATE_CALENDAR');

        // Generate a training week
        const weekStart = new Date();
        weekStart.setHours(0, 0, 0, 0);

        // Build simple program based on user profile
        const daysPerWeek = user.schedule?.daysPerWeek || 4;
        const preferredDays = user.schedule?.preferredDays || ['monday', 'tuesday', 'thursday', 'friday'];
        const goal = user.primaryGoal?.type || 'general-health';

        const workoutTemplates = {
          'build-strength': ['Heavy Squat Day', 'Heavy Bench Day', 'Heavy Deadlift Day', 'Accessories'],
          'build-muscle': ['Push Day', 'Pull Day', 'Legs Day', 'Upper Hypertrophy'],
          'lose-fat': ['Full Body HIIT', 'Upper Body Circuit', 'Lower Body Burn', 'Cardio & Core'],
          'general-health': ['Full Body A', 'Cardio', 'Full Body B', 'Active Recovery'],
          'competition-prep': ['Squat Focus', 'Bench Focus', 'Deadlift Focus', 'Technique Work']
        };

        const templates = workoutTemplates[goal] || workoutTemplates['general-health'];
        const events = [];
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        for (let i = 0; i < Math.min(daysPerWeek, preferredDays.length); i++) {
          const dayName = preferredDays[i]?.toLowerCase();
          const dayIndex = daysOfWeek.indexOf(dayName);
          if (dayIndex === -1) continue;

          const eventDate = new Date(weekStart);
          const currentDayIndex = weekStart.getDay();
          const daysToAdd = (dayIndex - currentDayIndex + 7) % 7;
          eventDate.setDate(eventDate.getDate() + daysToAdd);

          events.push({
            userId,
            type: 'workout',
            title: templates[i % templates.length],
            description: `AI-generated ${goal.replace('-', ' ')} workout`,
            date: eventDate,
            startTime: user.schedule?.preferredTime || '09:00',
            duration: user.schedule?.sessionDuration || 60,
            aiGenerated: true,
            aiReason: 'Generated by FORGE via chat',
            status: 'scheduled'
          });
        }

        if (events.length > 0) {
          const created = await CalendarEvent.insertMany(events);
          actionResult = {
            action: 'CALENDAR_GENERATED',
            eventsCreated: created.length,
            events: created.map(e => ({ title: e.title, date: e.date }))
          };
          actionPromptAddition = `\n\n[SYSTEM: You just created ${created.length} workouts in the user's calendar for this week. Let them know what you did!]`;
        }
      } catch (actionErr) {
        console.error('[FORGE] Action error:', actionErr);
        actionPromptAddition = `\n\n[SYSTEM: You tried to add workouts to the calendar but encountered an error. Apologize and suggest they try the Generate button on the Calendar page instead.]`;
      }
    }

    // Build conversation history string
    let conversationContext = '';
    if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      conversationContext = `
---
CONVERSATION HISTORY (REMEMBER THIS - DO NOT ASK QUESTIONS THAT WERE ALREADY ANSWERED):
${conversationHistory.map(msg => `${msg.role === 'user' ? 'USER' : 'FORGE'}: ${msg.content}`).join('\n')}
---
`;
    }

    const prompt = `${FORGE_IDENTITY}

CRITICAL RULES:
1. NEVER ask a question that was already answered in the conversation history
2. If the user already told you their lifts, competition, timeline, etc. - REMEMBER IT
3. When you have the info you need, TAKE ACTION - propose a program, give specific advice
4. Be a COACH, not an interrogator. Use the information they gave you.

---

USER PROFILE (${user.name}):
- Experience Level: ${user.experience?.level || 'not specified'}
- Primary Goal: ${user.primaryGoal?.type || 'general fitness'}
- Training Style: ${aiCoach.trainingPhilosophy?.programStyle || 'general'}
- Workouts Completed: ${aiCoach.trainingHistory?.totalWorkouts || 0}
- Current Streak: ${aiCoach.trainingHistory?.currentStreak || 0} days
- Training Days: ${user.schedule?.daysPerWeek || 4} days/week
- Preferred Days: ${user.schedule?.preferredDays?.join(', ') || 'flexible'}
${conversationContext}
${context ? `CONTEXT FROM APP: ${context}` : ''}

USER'S CURRENT MESSAGE: "${question}"${actionPromptAddition}

Respond as FORGE. Be direct, helpful, and use ALL information from the conversation history. DO NOT repeat questions.`;

    // Use AI with automatic fallback
    const aiResponse = await generateAIContent(prompt);
    const answer = aiResponse.text;
    console.log(`[AI Coach] Response from ${aiResponse.source}`);

    await aiCoach.incrementQueryCount();

    res.json({
      success: true,
      answer,
      action: actionResult, // Include action results for frontend
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
