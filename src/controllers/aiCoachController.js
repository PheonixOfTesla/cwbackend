// Src/controllers/aiCoachController.js - FORGE AI Coach Controller
// This is THE CORE VALUE PROP - AI that coaches individuals
const AICoach = require('../models/AICoach');
const User = require('../models/User');
const Program = require('../models/Program');
const recoveryService = require('../services/recoveryService');
const prDetectionService = require('../services/prDetectionService');
const aiService = require('../services/aiService');

// FORGE PERSONALITY SYSTEM PROMPT - Your No-BS AI Training Partner
const FORGE_IDENTITY = `You are FORGE - the AI fitness coach forged in the fires of ClockWork. Think of yourself as that friend who's been lifting for years, knows their stuff, and genuinely wants to see you succeed.

PERSONALITY & VIBE:
- Direct and honest, but never harsh - you keep it real because you care
- Celebrate wins like a training partner who just watched you hit a PR ("LFG!" energy, but measured)
- Mix practical wisdom with occasional gym culture references (but don't overdo it)
- You've "seen some shit" in training - share insights from patterns you notice
- Slight edge when needed ("Yeah, skipping leg day again? We need to talk.")
- Use "we" language - you're in the trenches together
- Self-aware that you're an AI, but a damn good one - you process data faster than they can blink and know their patterns before they do

COMMUNICATION STYLE:
- Keep it tight (2-4 sentences, expand when they need the detail)
- Drop their name occasionally - makes it personal
- Specific > Generic ("That 475 squat? Solid. Last week you were at 465 - that's real progress, Elite.")
- Ask good questions, don't interrogate
- Occasional training culture refs: "time under tension", "progressive overload", "earned that pump"
- Use *asterisks* to emphasize the important stuff
- Light profanity is fine if contextually appropriate (keep it PG-13)

YOUR EXPERTISE (What You Know):
- Strength training, powerlifting, bodybuilding - you know the difference between RPE 7 and RPE 9
- Periodization isn't just a fancy word - you actually implement it
- Recovery science: HRV, sleep, readiness - you read the data
- Nutrition that works in real life (not just "chicken and rice bro")
- Competition prep - you understand peak week isn't just "cut water"

WHAT YOU DON'T DO:
- Play doctor - injuries and pain get referred to healthcare pros, always
- Sugar-coat when someone needs real talk (but deliver it with care)
- Use 10 emojis per message like an Instagram fitness influencer
- Promise specific results ("You'll gain 20lbs of muscle!" ❌)
- Ignore their stated limitations, injuries, or life constraints

FORGE'S PHILOSOPHY:
"Every elite athlete started as a beginner. Every PR started with showing up. I'm here to make sure you show up smarter, train harder, and actually hit your goals - not just talk about them."

REMEMBER: You're an advanced AI built into ClockWork, designed to analyze training patterns, read recovery signals, and adapt programs in real-time. You're not just spitting out generic advice - you're processing their data, learning their tendencies, and crafting responses that actually move them forward. You see what they can't see yet. That's your power. Use it.`;

// ============================================
// REQUEST THROTTLING - Prevent rapid-fire API calls
// ============================================
const userLastRequestTime = new Map();
const REQUEST_COOLDOWN_MS = 2000; // 2 seconds between requests

function checkRequestThrottle(userId) {
  const now = Date.now();
  const lastRequest = userLastRequestTime.get(userId);

  if (lastRequest && (now - lastRequest) < REQUEST_COOLDOWN_MS) {
    const waitTime = Math.ceil((REQUEST_COOLDOWN_MS - (now - lastRequest)) / 1000);
    return {
      throttled: true,
      waitTime
    };
  }

  userLastRequestTime.set(userId, now);
  return { throttled: false };
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
    const features = user.getSubscriptionFeatures();

    // Check and expire trial if needed
    await user.checkTrialExpiration();

    // PAYWALL: After 24h trial, block unless they have active subscription
    if (!user.hasActiveSubscription()) {
      const trialHours = user.getTrialRemainingHours();
      return res.status(403).json({
        success: false,
        message: trialHours > 0
          ? `Free trial ends in ${trialHours} hours. Subscribe for full access.`
          : 'Action not available. Subscribe for full access to FORGE AI coaching.',
        trialExpired: true,
        requiresSubscription: true,
        trialRemaining: trialHours
      });
    }

    // ═══════════════════════════════════════════════════════════
    // FORGE PERSONALIZATION: Pull ALL user data
    // ═══════════════════════════════════════════════════════════
    const exercisePrefs = user.exercisePreferences || {};
    const bodyComp = user.bodyComposition || {};
    const compPrep = user.competitionPrep || {};
    const lifestyle = user.lifestyle || {};

    // Determine if cardio is needed
    const needsCardio = bodyComp.goal?.includes('cut') ||
                        (bodyComp.targetWeight && user.profile?.currentWeight > bodyComp.targetWeight);

    // Determine periodization phase from competition prep
    let periodizationPhase = 'general';
    if (compPrep.isCompeting && compPrep.nextCompetitionDate) {
      const weeksOut = Math.ceil((new Date(compPrep.nextCompetitionDate) - new Date()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksOut <= 2) periodizationPhase = 'peaking';
      else if (weeksOut <= 4) periodizationPhase = 'intensity';
      else if (weeksOut <= 8) periodizationPhase = 'strength';
      else periodizationPhase = 'accumulation';
    }

    // Build exclusion list
    const exercisesToExclude = [
      ...(exercisePrefs.hatedExercises || []),
      ...(user.limitations?.exercisesToAvoid || []),
      ...(user.limitations?.injuries?.map(i => i.bodyPart) || [])
    ].filter(Boolean);

    const prompt = `You are FORGE - the elite AI coach for ClockWork. Generate a ${duration || '4-week'} training program.

═══════════════════════════════════════════════════════════
USER PROFILE:
═══════════════════════════════════════════════════════════
- Name: ${user.name}
- Experience Level: ${user.experience?.level || 'intermediate'}
- Years Training: ${user.experience?.yearsTraining || 1}
- Primary Discipline: ${user.experience?.primaryDiscipline || 'general-fitness'}
- Goal: ${user.primaryGoal?.type || 'general-health'}
- Days per week: ${user.schedule?.daysPerWeek || 4}
- Session duration: ${user.schedule?.sessionDuration || 60} minutes
- Preferred days: ${user.schedule?.preferredDays?.join(', ') || 'flexible'}
- Equipment: ${user.equipment?.availableEquipment?.join(', ') || 'full gym'}

═══════════════════════════════════════════════════════════
EXERCISE PREFERENCES (CRITICAL):
═══════════════════════════════════════════════════════════
- FAVORITE exercises (include these): ${exercisePrefs.favoriteExercises?.join(', ') || 'any compound movements'}
- HATED exercises (NEVER include): ${exercisesToExclude.join(', ') || 'none'}
- Training style: ${exercisePrefs.trainingStyle || 'balanced'}
- Preferred split: ${exercisePrefs.preferredSplit || 'upper/lower'}
- Cardio preference: ${exercisePrefs.cardioPreference || 'minimal'}

═══════════════════════════════════════════════════════════
BODY COMPOSITION:
═══════════════════════════════════════════════════════════
- Current weight: ${bodyComp.currentWeight || user.profile?.currentWeight || 'not specified'}
- Target weight: ${bodyComp.targetWeight || 'maintain'}
- Goal: ${bodyComp.goal || 'maintain'}
${needsCardio ? `⚠️ USER IS CUTTING - INCLUDE CARDIO IN PROGRAM
   - Type: ${exercisePrefs.cardioPreference || 'LISS'}
   - Frequency: 3-4x per week
   - Duration: 20-30 min post-workout` : ''}

${compPrep.isCompeting ? `
═══════════════════════════════════════════════════════════
COMPETITION PREP:
═══════════════════════════════════════════════════════════
- Competition Date: ${compPrep.nextCompetitionDate}
- Federation: ${compPrep.federation || 'not specified'}
- Weight Class: ${compPrep.weightClass || 'not specified'}
- Current Phase: ${periodizationPhase.toUpperCase()}
- Events: ${compPrep.events?.join(', ') || 'SBD'}
` : ''}

═══════════════════════════════════════════════════════════
LIFESTYLE FACTORS:
═══════════════════════════════════════════════════════════
- Job activity: ${lifestyle.jobActivity || 'moderate'}
- Stress level: ${lifestyle.stressLevel || 'moderate'}
- Sleep: ${lifestyle.sleepHours || 7} hours/night
${lifestyle.stressLevel === 'high' ? '⚠️ HIGH STRESS - Reduce volume, focus on recovery' : ''}

TRAINING HISTORY:
- Total workouts completed: ${aiCoach.trainingHistory?.totalWorkouts || 0}
- Average completion rate: ${aiCoach.trainingHistory?.averageCompletion || 0}%
- Current streak: ${aiCoach.trainingHistory?.currentStreak || 0} days

${focus ? `FOCUS AREA: ${focus}` : ''}
${intensity ? `INTENSITY LEVEL: ${intensity}` : ''}

IMPORTANT: Use standard exercise names (e.g., "Barbell Bench Press", "Barbell Squat", "Romanian Deadlift") so we can link to video demonstrations.

═══════════════════════════════════════════════════════════
WORKOUT STRUCTURE REQUIREMENTS (CRITICAL):
═══════════════════════════════════════════════════════════
Each workout MUST include:

1. WARMUP (2-3 exercises):
   - Dynamic stretches, mobility work, activation exercises
   - Examples: Band Pull-Aparts, Leg Swings, Cat-Cow, Arm Circles
   - 1-2 sets, 8-12 reps or 30-60 seconds

2. MAIN WORK (5-9 exercises based on goal):
   ${user.primaryGoal?.type === 'build-strength' ? '- Strength: 5-7 compound-focused exercises (heavy weight, lower reps)' : ''}
   ${user.primaryGoal?.type === 'build-muscle' ? '- Hypertrophy: 6-9 exercises (mix of compound and isolation, higher volume)' : ''}
   ${user.primaryGoal?.type === 'lose-fat' ? '- Fat Loss: 6-8 exercises (circuit style, minimal rest, high intensity)' : ''}
   ${user.primaryGoal?.type === 'competition-prep' ? '- Competition: 5-7 exercises (specificity to competition lifts, technical work)' : ''}
   ${!user.primaryGoal?.type || user.primaryGoal?.type === 'general-health' ? '- General: 6-8 exercises (balanced mix of strength and conditioning)' : ''}

3. POST-WORKOUT STRETCH (2-3 exercises):
   - Static stretches targeting muscles worked
   - Examples: Hamstring Stretch, Hip Flexor Stretch, Chest Doorway Stretch
   - Hold 30-60 seconds each

4. CARDIO (if applicable):
   ${needsCardio || exercisePrefs.cardioPreference !== 'none' ? `- Include ${exercisePrefs.cardioPreference || 'LISS'} cardio
   - Duration: 15-30 minutes
   - Frequency: ${needsCardio ? '3-4x per week' : '2-3x per week'}
   - Examples: Treadmill, Rowing, Bike, Stairmaster` : '- Optional: Add 10-15 min cardio based on recovery'}

═══════════════════════════════════════════════════════════
NUTRITION RECOMMENDATIONS (based on onboarding):
═══════════════════════════════════════════════════════════
${bodyComp.goal === 'lose-weight' ? '- CUTTING: Slight caloric deficit, high protein (0.8-1g per lb bodyweight)' : ''}
${bodyComp.goal === 'gain-weight' ? '- BULKING: Caloric surplus, prioritize protein and carbs around training' : ''}
${bodyComp.goal === 'maintain' ? '- MAINTENANCE: Balanced macros, focus on nutrient timing' : ''}
- Dietary preferences: ${user.dietaryPreferences?.join(', ') || 'omnivore'}
- Meal timing: Pre/post workout nutrition critical for performance

Generate a structured program with:
1. Program overview and goals
2. Weekly structure
3. Each workout with WARMUP, MAIN WORK (5-9 exercises), STRETCHES, and CARDIO sections
4. Include exercises, sets, reps, and rest periods for ALL sections
5. Progression plan
6. Deload recommendations
7. Nutrition guidelines based on user goals

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
    const aiResponse = await aiService.generateAIContent(prompt, FORGE_IDENTITY, 8192);
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

    // CRITICAL FIX: Enrich all workouts in program with exercise library links
    if (program.workouts && Array.isArray(program.workouts)) {
      program.workouts = program.workouts.map(workout => enrichWorkoutWithLinks(workout));
      console.log('[FORGE] Enriched program workouts with exercise library links');
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
// GENERATE SINGLE WORKOUT (With Recovery Autoregulation)
// ============================================
exports.generateWorkout = async (req, res) => {
  try {
    const userId = req.user.id;
    const { focus, duration, equipment } = req.body;

    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);
    const features = user.getSubscriptionFeatures();

    // Check and expire trial if needed
    await user.checkTrialExpiration();

    // PAYWALL: After 24h trial, block unless they have active subscription
    if (!user.hasActiveSubscription()) {
      const trialHours = user.getTrialRemainingHours();
      return res.status(403).json({
        success: false,
        message: trialHours > 0
          ? `Free trial ends in ${trialHours} hours. Subscribe for full access.`
          : 'Action not available. Subscribe for full access to FORGE AI coaching.',
        trialExpired: true,
        requiresSubscription: true,
        trialRemaining: trialHours
      });
    }

    // Get recovery/readiness data for autoregulation
    const readiness = await recoveryService.getTrainingReadiness(userId);
    const intensityModifier = readiness.intensityModifier || 1.0;
    const recoveryRecommendation = readiness.recommendation || 'full-intensity';

    // Get exercise preferences
    const exercisePrefs = user.exercisePreferences || {};
    const bodyComp = user.bodyComposition || {};
    const needsCardio = bodyComp.goal?.includes('cut') || (bodyComp.targetWeight && user.profile?.currentWeight > bodyComp.targetWeight);

    const prompt = `Generate a single ${duration || 60}-minute ${focus || 'full body'} workout.

═══════════════════════════════════════════════════════════
RECOVERY-ADJUSTED WORKOUT GENERATION
═══════════════════════════════════════════════════════════

TODAY'S READINESS:
- Recovery Score: ${readiness.readinessScore || 70}/100
- Recommendation: ${recoveryRecommendation}
- Intensity Modifier: ${(intensityModifier * 100).toFixed(0)}%
${readiness.factorSummary ? `- Factors: ${readiness.factorSummary}` : ''}
${readiness.explanation ? `- Note: ${readiness.explanation}` : ''}

USER PROFILE:
- Name: ${user.name}
- Experience: ${user.experience?.level || 'intermediate'}
- Discipline: ${user.experience?.primaryDiscipline || 'general-fitness'}
- Equipment available: ${equipment || user.equipment?.availableEquipment?.join(', ') || 'full gym'}

EXERCISE PREFERENCES:
- Favorite exercises: ${exercisePrefs.favoriteExercises?.join(', ') || 'any'}
- AVOID: ${[...(exercisePrefs.hatedExercises || []), ...(user.limitations?.exercisesToAvoid || [])].join(', ') || 'none'}
- Cardio preference: ${exercisePrefs.cardioPreference || 'mixed'}
- Training style: ${exercisePrefs.trainingStyle || 'balanced'}

${needsCardio ? `
⚠️ INCLUDE CARDIO - User is cutting weight
- Type: ${exercisePrefs.cardioPreference || 'LISS'}
- Duration: 15-25 min post-workout
` : ''}

ADJUSTMENTS FOR TODAY:
${recoveryRecommendation === 'push-hard' ? '- Recovery is excellent - push intensity, consider adding volume' : ''}
${recoveryRecommendation === 'moderate-intensity' ? '- Recovery is moderate - reduce top sets by 5-10%' : ''}
${recoveryRecommendation === 'reduce-volume' ? '- Low recovery - reduce volume by 25%, focus on technique' : ''}
${recoveryRecommendation === 'active-recovery' ? '- Poor recovery - light mobility work only, or full rest' : ''}
${recoveryRecommendation === 'full-intensity' ? '- Normal recovery - train as planned' : ''}

IMPORTANT: Use standard exercise names (e.g., "Barbell Bench Press", "Barbell Squat", "Romanian Deadlift") so we can link to video demonstrations.

═══════════════════════════════════════════════════════════
WORKOUT STRUCTURE REQUIREMENTS (CRITICAL):
═══════════════════════════════════════════════════════════
Generate a complete workout with these sections:

1. WARMUP (2-3 exercises):
   - Dynamic stretches, mobility drills, activation exercises
   - Examples: Band Pull-Aparts, Leg Swings, Cat-Cow Stretch, Arm Circles
   - 1-2 sets, 8-12 reps or 30-60 seconds each

2. MAIN WORKOUT (5-9 exercises based on goal and experience):
   ${user.experience?.level === 'beginner' ? '- Beginner: 5-6 exercises (compound movements, perfect form)' : ''}
   ${user.experience?.level === 'intermediate' ? '- Intermediate: 6-8 exercises (mix compound and isolation)' : ''}
   ${user.experience?.level === 'advanced' ? '- Advanced: 7-9 exercises (higher volume and variety)' : ''}
   ${!user.experience?.level ? '- Default: 6-8 exercises' : ''}
   - Include sets, reps, RPE, rest periods, and coaching notes

3. POST-WORKOUT STRETCH (2-3 exercises):
   - Static stretches targeting muscles worked today
   - Examples: Hamstring Stretch, Hip Flexor Stretch, Chest Stretch, Quad Stretch
   - Hold 30-60 seconds each

4. CARDIO (if needed):
   ${needsCardio ? `- REQUIRED: ${exercisePrefs.cardioPreference || 'LISS'} cardio, 15-25 minutes` : '- Optional: Light cardio if time permits'}

Return JSON:
{
  "workoutName": "string",
  "recoveryAdjusted": ${recoveryRecommendation !== 'full-intensity'},
  "intensityLevel": "${recoveryRecommendation}",
  "warmup": [{"exercise": "string", "sets": "1-2", "duration": "30-60 sec"}],
  "mainWorkout": [{"exercise": "string", "sets": number, "reps": "string", "rpe": number, "rest": "string", "notes": "string"}],
  "stretches": [{"exercise": "string", "duration": "30-60 sec", "notes": "string"}],
  ${needsCardio ? '"cardio": {"type": "string", "duration": "string", "intensity": "string"},' : ''}
  "estimatedDuration": number,
  "difficulty": "beginner|intermediate|advanced",
  "coachingNote": "string - personalized note based on their recovery and goals"
}`;

    // Use AI with automatic fallback
    const aiResponse = await aiService.generateAIContent(prompt, FORGE_IDENTITY, 4096);
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

    // CRITICAL FIX: Enrich workout with exercise library links
    workout = enrichWorkoutWithLinks(workout);
    console.log('[FORGE] Enriched workout with exercise library links');

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
const { ALL_EXERCISES } = require('../data/exerciseLibrary');

// Helper: Match exercise name to library ID for video links
function matchExerciseToLibrary(exerciseName) {
  if (!exerciseName || !ALL_EXERCISES) return null;

  const nameLower = exerciseName.toLowerCase().trim();

  // Direct name match
  let match = ALL_EXERCISES.find(ex => ex.name && ex.name.toLowerCase() === nameLower);
  if (match) return { id: match.id, name: match.name, videoUrl: `/exercises/library/${match.id}` };

  // Fuzzy match - check if library exercise name is contained in user's exercise name or vice versa
  match = ALL_EXERCISES.find(ex => {
    if (!ex.name) return false;
    const libName = ex.name.toLowerCase();
    return nameLower.includes(libName) || libName.includes(nameLower);
  });

  if (match) return { id: match.id, name: match.name, videoUrl: `/exercises/library/${match.id}` };

  // No match found - log for debugging
  console.log(`[FORGE] No exercise match found for: "${exerciseName}"`);
  return null;
}

// Helper: Enrich workout with exercise links
function enrichWorkoutWithLinks(workout) {
  if (!workout || !workout.mainWorkout) return workout;

  workout.mainWorkout = workout.mainWorkout.map(exercise => {
    const match = matchExerciseToLibrary(exercise.exercise);
    if (match) {
      return {
        ...exercise,
        exerciseId: match.id,
        videoUrl: match.videoUrl,
        libraryName: match.name
      };
    }
    return exercise;
  });

  return workout;
}

// Detect if user is asking FORGE to DO something
function detectActionIntent(question, conversationHistory) {
  const q = question.toLowerCase().trim();

  // Confirmation phrases - user saying "yes" to something
  const confirmationPhrases = ['okay', 'ok', 'go', 'yes', 'yep', 'yeah', 'sure', 'do it',
    'let\'s go', 'lets go', 'let\'s do it', 'lets do it', 'create it', 'make it',
    'sounds good', 'perfect', 'absolutely', 'for sure', 'ready', 'start', 'begin'];

  // Program creation phrases
  const programPhrases = ['create', 'generate', 'make', 'build', 'forge', 'program',
    'plan', 'calendar', 'schedule', 'workout', 'training'];

  const isConfirmation = confirmationPhrases.some(p => q === p || q.includes(p));
  const wantsProgram = programPhrases.some(p => q.includes(p));

  // Check recent conversation for program discussion
  const recentContext = conversationHistory?.slice(-6).map(m => m.content?.toLowerCase() || '').join(' ') || '';
  const discussedProgram = programPhrases.some(p => recentContext.includes(p));

  // TRIGGER FULL PROGRAM if:
  // 1. User explicitly asks for program/calendar/workout
  // 2. User confirms (okay/yes/go) after discussing program
  if (wantsProgram || (isConfirmation && discussedProgram)) {
    return 'GENERATE_FULL_PROGRAM';
  }

  return null; // Regular Q&A chat
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

    // Check request throttle (prevent rapid-fire spam that hits rate limits)
    const throttle = checkRequestThrottle(userId);
    if (throttle.throttled) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${throttle.waitTime} seconds before sending another message.`,
        throttled: true,
        waitTime: throttle.waitTime
      });
    }

    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);
    const features = user.getSubscriptionFeatures();

    // Check and expire trial if needed
    await user.checkTrialExpiration();

    // PAYWALL: After 24h trial, block unless they have active subscription
    if (!user.hasActiveSubscription()) {
      const trialHours = user.getTrialRemainingHours();
      return res.status(403).json({
        success: false,
        message: trialHours > 0
          ? `Free trial ends in ${trialHours} hours. Subscribe for full access.`
          : 'Action not available. Subscribe for full access to FORGE AI coaching.',
        trialExpired: true,
        requiresSubscription: true,
        trialRemaining: trialHours
      });
    }

    // ═══════════════════════════════════════════════════════════
    // CHECK FOR ACTIVE PROGRAM
    // ═══════════════════════════════════════════════════════════
    let activeProgram = null;
    if (aiCoach.currentProgramId) {
      activeProgram = await Program.findById(aiCoach.currentProgramId);
    }
    const hasActiveProgram = activeProgram && activeProgram.status === 'active';

    // Detect if this is an action request
    const actionIntent = detectActionIntent(question, conversationHistory);
    let actionResult = null;
    let actionPromptAddition = '';

    // ═══════════════════════════════════════════════════════════
    // GENERATE FULL PROGRAM (Comprehensive 8-week with meals)
    // ═══════════════════════════════════════════════════════════
    if (actionIntent === 'GENERATE_FULL_PROGRAM') {
      try {
        console.log('[FORGE] Executing action: GENERATE_FULL_PROGRAM');

        // If user already has an active program, deactivate it first
        if (hasActiveProgram) {
          console.log('[FORGE] Deactivating existing program:', activeProgram._id);
          activeProgram.status = 'completed';
          activeProgram.endDate = new Date();
          await activeProgram.save();
        }

        // DELEGATE TO BULLETPROOF FACTORY
        const programFactory = require('../services/programFactory');
        const result = await programFactory.createProgramForUser(userId, { source: 'chat' });
        const savedProgram = result.program;

        // Build Action Result for Frontend
        actionResult = {
          action: 'PROGRAM_GENERATED',
          programId: savedProgram._id,
          stats: {
            calendarEventsCreated: result.stats.workouts,
            mealEventsCreated: result.stats.meals,
            totalEventsCreated: result.stats.workouts + result.stats.meals,
            weeksPlanned: savedProgram.durationWeeks
          }
        };

        actionPromptAddition = `\n\n[SYSTEM: You just created a comprehensive ${savedProgram.durationWeeks}-week program with ${result.stats.workouts} workouts and ${result.stats.meals} meals (${result.stats.workouts + result.stats.meals} total events) in the user's calendar. Tell them their program is ready. Explicitly tell them to CLICK THE 'VIEW CALENDAR' BUTTON below to see their full schedule!]`;

      } catch (programErr) {
        console.error('[FORGE] Full program generation error:', programErr);
        actionPromptAddition = `\n\n[SYSTEM: Program generation encountered an error: ${programErr.message}. Apologize and suggest trying again.]`;
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

    // Build prompt with program context if available
    let programContext = '';
    if (hasActiveProgram) {
      const currentPhase = activeProgram.calculateCurrentPhase();
      
      // FETCH TODAY'S SLOTS (Workouts/Meals)
      const today = new Date();
      today.setHours(0,0,0,0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayEvents = await CalendarEvent.find({
        userId,
        date: { $gte: today, $lt: tomorrow }
      }).lean();

      const todayWorkout = todayEvents.find(e => e.type === 'workout');
      const todayMeals = todayEvents.filter(e => e.type === 'nutrition');

      programContext = `

═══════════════════════════════════════════════════════════
ACTIVE PROGRAM: "${activeProgram.name}"
═══════════════════════════════════════════════════════════
- Progress: Week ${activeProgram.currentWeek} of ${activeProgram.durationWeeks} (${activeProgram.percentComplete}% complete)
- Goal: ${activeProgram.goal}
- Current Phase: ${currentPhase?.name || 'standard'}

TODAY'S SCHEDULED SLOTS:
${todayWorkout ? `🏋️ WORKOUT: "${todayWorkout.title}"
   Exercises: ${todayWorkout.exercises?.map(ex => `${ex.name} (${ex.sets}x${ex.reps})`).join(', ') || 'Rest Day'}` : '🏋️ WORKOUT: Rest Day'}

${todayMeals.length > 0 ? `🍎 MEALS: ${todayMeals.map(m => m.title).join(', ')}` : '🍎 MEALS: Flexible nutrition day'}

When answering the user, reference their specific exercises or meals if relevant. Be the coach who actually knows what they're doing today.`;
    } else {
      programContext = `

⚠️ USER HAS NO ACTIVE PROGRAM. They should generate one using "Create my program" or "Generate my training plan". When appropriate, suggest this.`;
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
${programContext}
${conversationContext}
${context ? `CONTEXT FROM APP: ${context}` : ''}

USER'S CURRENT MESSAGE: "${question}"${actionPromptAddition}

Respond as FORGE. Be direct, helpful, and use ALL information from the conversation history. DO NOT repeat questions.`;

    // Use AI with automatic fallback
    const aiResponse = await aiService.generateAIContent(prompt, FORGE_IDENTITY);
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
