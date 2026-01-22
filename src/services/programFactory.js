const mongoose = require('mongoose');
const Program = require('../models/Program');
const CalendarEvent = require('../models/CalendarEvent');
const Nutrition = require('../models/Nutrition');
const User = require('../models/User');
const AICoach = require('../models/AICoach');
const aiService = require('./aiService');

// ============================================
// SHARED PROGRAM FACTORY
// Centralizes generation, validation, and propagation
// to ensure "Bulletproof" consistency.
// ============================================

/**
 * Core function to generate a program from user data
 * @param {string} userId 
 * @param {Object} options - { type: 'full' | 'workout', overridePrompt: string, source: 'chat' | 'ui' }
 */
exports.createProgramForUser = async (userId, options = {}) => {
  console.log(`[ProgramFactory] Starting generation for user ${userId} (Source: ${options.source || 'unknown'})`);
  
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // 1. GATHER DATA (Centralized data gathering)
  const context = await gatherUserContext(user);
  
  // 2. BUILD PROMPT
  const prompt = options.overridePrompt || buildForgePrompt(user, context);

  // 3. CALL AI
  // 8-week programs need massive context, using 16k tokens
  const aiResponse = await aiService.generateAIContent(prompt, 'You are FORGE, the elite AI coach', 16384);
  
  // 4. PARSE & CLEAN JSON
  const programData = parseAIResponse(aiResponse.text);

  // 5. VALIDATE STRUCTURE (The "Bulletproof" Check)
  validateProgramStructure(programData, context.daysPerWeek);

  // 6. SAVE TO DB & PROPAGATE (Transactional if possible, but sequential for now)
  const savedProgram = await saveAndPropagate(user, programData, options.source);

  return savedProgram;
};

// ═══════════════════════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════════════════════

async function gatherUserContext(user) {
  // Centralized "Truth" about the user
  const schedule = user.schedule || {};
  
  // Calculate TDEE
  let tdee = 2000;
  if (user.profile?.currentWeight) {
    const weight = user.profile.currentWeight;
    const activityMap = {
      'sedentary': 1.2, 'lightly-active': 1.375, 'moderately-active': 1.55, 
      'very-active': 1.725, 'extremely-active': 1.9
    };
    // Default to moderately active if undefined
    const multiplier = activityMap[user.lifestyle?.jobType] || 1.55;
    tdee = Math.round(weight * 15 * multiplier); 
  }

  // Adjust for goal
  if (user.primaryGoal?.type === 'lose-fat') tdee = Math.round(tdee * 0.8);
  if (user.primaryGoal?.type === 'build-muscle') tdee = Math.round(tdee * 1.1);

  return {
    tdee,
    daysPerWeek: schedule.daysPerWeek || 4,
    experienceLevel: user.experience?.level || 'intermediate',
    goal: user.primaryGoal?.type || 'general-health'
  };
}

function parseAIResponse(text) {
  try {
    // Robust Regex to find the largest JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in AI response');
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('[ProgramFactory] JSON Parse Error. Raw text snippet:', text.slice(0, 200));
    throw new Error('Failed to parse AI generated program. The AI output was not valid JSON.');
  }
}

function validateProgramStructure(data, expectedDays) {
  // CRITICAL VALIDATION RULES
  if (!data.durationWeeks || data.durationWeeks < 4) {
    throw new Error(`Program duration too short: ${data.durationWeeks} weeks. Minimum 4.`);
  }

  if (!data.weeklyTemplates || data.weeklyTemplates.length === 0) {
    throw new Error('No weekly templates generated.');
  }

  // Check first week for structure validity
  const week1 = data.weeklyTemplates[0];
  if (!week1.trainingDays || week1.trainingDays.length !== expectedDays) {
    // We allow a small margin of error or warn, but strict mode throws
    console.warn(`[ProgramFactory] Warning: Expected ${expectedDays} training days, got ${week1.trainingDays?.length}`);
  }

  // Check for nutrition
  if (!data.nutritionPlan?.mealPlan?.breakfast) {
    throw new Error('Incomplete nutrition plan. Missing breakfast.');
  }
}

async function saveAndPropagate(user, data, source) {
  // A. Create Program
  const program = new Program({
    userId: user._id,
    name: data.name || 'FORGE Generated Program',
    goal: user.primaryGoal?.type || 'general-health',
    status: 'active',
    startDate: new Date(),
    durationWeeks: data.durationWeeks,
    currentWeek: 1,
    periodization: data.periodization || { model: 'linear', phases: [] },
    weeklyTemplates: data.weeklyTemplates,
    nutritionPlan: data.nutritionPlan,
    aiGenerated: true,
    aiRationale: `Generated via ${source || 'system'}`
  });

  const savedProgram = await program.save();
  console.log(`[ProgramFactory] Program ${savedProgram._id} saved.`);

  // B. Update AI Coach
  const aiCoach = await AICoach.getOrCreateForUser(user._id);
  aiCoach.currentProgramId = savedProgram._id;
  await aiCoach.save();

  // C. Propagate Workouts (Using Model Method)
  const workoutEvents = await savedProgram.generateCalendarEvents();
  console.log(`[ProgramFactory] Propagated ${workoutEvents.length} workout events.`);

  // D. Propagate Meals (Centralized Logic)
  const mealEvents = await generateMealEvents(user._id, savedProgram, data.nutritionPlan.mealPlan);
  console.log(`[ProgramFactory] Propagated ${mealEvents.length} meal events.`);

  // E. Update Nutrition Targets
  await updateNutritionTargets(user._id, data.nutritionPlan);

  // F. Propagate Habits
  const habitsCreated = await generateHabits(user._id, data.habitPlan);
  console.log(`[ProgramFactory] Propagated ${habitsCreated.length} habits.`);

  return {
    program: savedProgram,
    stats: {
      workouts: workoutEvents.length,
      meals: mealEvents.length,
      habits: habitsCreated.length
    }
  };
}

async function generateMealEvents(userId, program, mealPlan) {
  if (!mealPlan) return [];
  
  const events = [];
  const mealTypes = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
  const mealTimes = {
    breakfast: '08:00', snack1: '10:30', lunch: '12:30', snack2: '15:30', dinner: '18:30'
  };

  // Generate for full duration
  for (let week = 0; week < program.durationWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      const eventDate = new Date(program.startDate);
      eventDate.setDate(eventDate.getDate() + (week * 7) + day);
      
      // Skip past
      const today = new Date();
      today.setHours(0,0,0,0);
      if (eventDate < today) continue;

      mealTypes.forEach(type => {
        if (mealPlan[type]) {
          events.push({
            userId,
            type: 'nutrition',
            title: mealPlan[type].name || type,
            date: new Date(eventDate),
            startTime: mealTimes[type],
            mealData: { mealType: type, ...mealPlan[type] },
            programId: program._id,
            aiGenerated: true,
            status: 'scheduled'
          });
        }
      });
    }
  }

  if (events.length > 0) {
    return await CalendarEvent.insertMany(events);
  }
  return [];
}

async function updateNutritionTargets(userId, nutritionPlan) {
  const nutrition = await Nutrition.getOrCreateForUser(userId);
  nutrition.targets = {
    calories: nutritionPlan.calorieTarget,
    protein: nutritionPlan.macros?.protein || 0,
    carbs: nutritionPlan.macros?.carbs || 0,
    fat: nutritionPlan.macros?.fat || 0,
    calculatedAt: new Date()
  };
  await nutrition.save();
}

async function generateHabits(userId, habitPlan) {
  if (!habitPlan || !Array.isArray(habitPlan)) return [];

  const Habit = require('../models/Habit');
  
  const createdHabits = [];
  
  // Valid enums from Habit model
  const VALID_FREQUENCIES = ['daily', 'weekdays', 'weekends', 'specific-days', 'x-per-week'];
  const VALID_TRACKING = ['boolean', 'quantity', 'duration', 'rating'];

  for (const h of habitPlan) {
    // Check if habit already exists
    const exists = await Habit.findOne({ userId, name: h.name, isActive: true });
    if (exists) continue;

    // SANITIZE DATA
    let frequency = (h.frequency || 'daily').toLowerCase();
    let trackingType = (h.trackingType || 'boolean').toLowerCase();
    let timesPerWeek = h.timesPerWeek || 7;

    // Fix common AI hallucinations
    if (frequency === 'weekly' || frequency === 'once a week') {
      frequency = 'x-per-week';
      timesPerWeek = 1;
    }
    if (!VALID_FREQUENCIES.includes(frequency)) {
      frequency = 'daily'; // Fallback
    }
    if (!VALID_TRACKING.includes(trackingType)) {
      trackingType = 'boolean'; // Fallback
    }

    try {
      const newHabit = await Habit.create({
        userId,
        name: h.name,
        description: h.description,
        category: h.category || 'custom',
        frequency,
        timesPerWeek,
        trackingType,
        targetValue: h.targetValue || 1,
        unit: h.unit || '',
        icon: h.icon || 'check-circle',
        color: h.color || '#f97316'
      });
      createdHabits.push(newHabit);
    } catch (err) {
      console.warn(`[ProgramFactory] Skipped invalid habit "${h.name}":`, err.message);
    }
  }

  return createdHabits;
}

// Re-export the builder function if the controller wants to see the prompt
function buildForgePrompt(user, context) {
  // Unpack context
  const { tdee, daysPerWeek, experienceLevel, goal } = context;
  
  // Unpack user data
  const competitionData = user.competitionPrep || {};
  const bodyCompData = user.bodyComposition || {};
  const lifestyleData = user.lifestyle || {};
  const experienceData = user.experience || {};
  const exercisePrefs = user.exercisePreferences || {};
  const equipmentData = user.equipment || {};

  // Calculate macros
  const weight = user.profile?.currentWeight || 180;
  let proteinPerLb = 1.0;
  if (goal === 'build-muscle' || goal === 'build-strength') proteinPerLb = 1.2;
  const protein = Math.round(weight * proteinPerLb);
  const fat = Math.round((tdee * 0.30) / 9);
  const carbs = Math.round((tdee - (protein * 4) - (fat * 9)) / 4);

  return `You are FORGE - the elite AI coach for ClockWork. Your job is to analyze this user's complete data and generate a structured, persistent training program.

═══════════════════════════════════════════════════════════
USER PROFILE: ${user.name}
═══════════════════════════════════════════════════════════
EXPERIENCE:
- Level: ${experienceLevel}
- Years Training: ${experienceData.yearsTraining || 1}
- Primary Discipline: ${experienceData.primaryDiscipline || 'general-fitness'}

GOALS:
- Primary Goal: ${goal}
- Target Weight: ${bodyCompData.targetWeight || 'maintain'}
- Current Weight: ${user.profile?.currentWeight || 'not specified'}
- Timeline: ${user.primaryGoal?.targetDate ? new Date(user.primaryGoal.targetDate).toLocaleDateString() : 'flexible'}

TRAINING SCHEDULE:
- Days per Week: ${daysPerWeek}
- Preferred Days: ${user.schedule?.preferredDays?.join(', ') || 'flexible'}
- Session Duration: ${user.schedule?.sessionDuration || 60} minutes

EQUIPMENT:
- Location: ${equipmentData.trainingLocation || 'commercial gym'}
- Available: ${equipmentData.availableEquipment?.join(', ') || 'full commercial gym'}
- Limitations: ${equipmentData.limitations || 'none'}

EXERCISE PREFERENCES:
- FAVORITE exercises: ${exercisePrefs.favoriteExercises?.join(', ') || 'any compound movements'}
- HATED exercises (NEVER include): ${exercisePrefs.hatedExercises?.join(', ') || 'none'}
- Preferred Split: ${exercisePrefs.preferredSplit || 'upper/lower'}
- Training Style: ${exercisePrefs.trainingStyle || 'balanced'}
- Cardio Preference: ${exercisePrefs.cardioPreference || 'minimal'}

LIFESTYLE:
- Stress Level: ${lifestyleData.stressLevel || 'moderate'}
- Sleep Hours: ${lifestyleData.sleepHours || 7}
- Sleep Quality: ${lifestyleData.sleepQuality || 'good'}
- Job Type: ${lifestyleData.jobType || 'moderate'}

INJURY HISTORY:
${user.limitations?.injuries && user.limitations.injuries.length > 0
  ? user.limitations.injuries.map(i => `- ${i.bodyPart}: ${i.description}`).join('\n')
  : '- No known injuries'}

${competitionData.isCompeting ? `
═══════════════════════════════════════════════════════════
COMPETITION PREP (CRITICAL)
═══════════════════════════════════════════════════════════
- Sport: ${competitionData.sport || 'powerlifting'}
- Meet Date: ${competitionData.meetDate ? new Date(competitionData.meetDate).toLocaleDateString() : 'not specified'}
- Federation: ${competitionData.federation || 'not specified'}
- Weight Class: ${competitionData.targetWeightClass || 'current weight'}
` : ''}

═══════════════════════════════════════════════════════════
CRITICAL: COMPREHENSIVE WORKOUT STRUCTURE REQUIREMENTS
═══════════════════════════════════════════════════════════

EVERY SINGLE TRAINING DAY MUST FOLLOW THIS EXACT STRUCTURE:

1. **ACTIVE WARMUP** (5-10 minutes total):
   - Category: "warmup"
   - Include 2-3 mobility exercises appropriate for the day's focus
   - Examples: "Hip Circles: 2 sets × 10 reps", "Arm Circles: 2 sets × 10 reps"

2. **WARMUP SETS** (Build up to working weight):
   - Category: "warmup"
   - Include 2-3 ramp-up sets for the main lift

3. **MAIN LIFTS** (Heavy compound movements):
   - Category: "main-lift"
   - Include 2-4 primary compound exercises per day
   - MUST include: sets, reps, rest period, RPE, percentageOfMax (relative to 1RM)
   - Example: "Barbell Squat: 5 sets × 3 reps @ RPE 8 (85% 1RM) - 3-5 min rest"

4. **ACCESSORY EXERCISES** (Supporting movements):
   - Category: "accessory"
   - Include 4-6 accessory exercises per day
   - Target muscles that support main lifts

5. **COOLDOWN/STRETCHING** (5-10 minutes):
   - Category: "cooldown"
   - Static stretching targeting muscles worked

TOTAL EXERCISES PER WORKOUT: 12-18 exercises minimum

═══════════════════════════════════════════════════════════
NUTRITION PLAN REQUIREMENTS
═══════════════════════════════════════════════════════════

Generate a COMPLETE meal plan with nutritionPlan.mealPlan containing:
{
  "breakfast": { "name": "...", "description": "...", "calories": 600, "protein": 40, "carbs": 60, "fat": 15, "ingredients": ["..."], "prepTime": 15 },
  "snack1": { ... },
  "lunch": { ... },
  "snack2": { ... },
  "dinner": { ... }
}

═══════════════════════════════════════════════════════════
HABIT PLAN REQUIREMENTS
═══════════════════════════════════════════════════════════

Generate a list of 3-5 daily habits to support this program.
{
  "habitPlan": [
    {
      "name": "Morning Mobility",
      "description": "5 mins of flow",
      "category": "recovery",
      "frequency": "daily",
      "trackingType": "boolean"
    },
    ...
  ]
}

═══════════════════════════════════════════════════════════
YOUR TASK: Generate a structured program in JSON format
═══════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no explanations). Use this exact structure:

{
  "name": "Descriptive program name",
  "durationWeeks": 8,
  "periodization": {
    "model": "linear|block|undulating",
    "phases": [
      {
        "name": "accumulation|strength|intensity|peak|deload",
        "startWeek": 1,
        "endWeek": 3,
        "volumeLevel": "moderate",
        "intensityRange": [70, 85],
        "rpeTarget": 6,
        "deloadWeek": false
      }
    ]
  },
  "nutritionPlan": {
    "calorieTarget": ${tdee},
    "macros": {
      "protein": ${protein},
      "carbs": ${carbs},
      "fat": ${fat}
    },
    "mealPlan": { ... (as defined above) ... }
  },
  "habitPlan": [
    {
       "name": "string",
       "description": "string",
       "category": "training|nutrition|recovery|mindset",
       "frequency": "daily|weekdays",
       "trackingType": "boolean|quantity",
       "targetValue": 1,
       "unit": "string"
    }
  ],
  "weeklyTemplates": [
    {
      "weekNumber": 1,
      "trainingDays": [
        {
          "dayOfWeek": "monday",
          "title": "Heavy Squat Day",
          "focus": "squat",
          "duration": 75,
          "exercises": [
            {
              "name": "Hip Circles",
              "category": "warmup",
              "sets": 2,
              "reps": "10 each direction",
              "rest": "0 sec",
              "notes": "Mobility prep"
            },
            {
              "name": "Barbell Squat",
              "category": "main-lift",
              "sets": 5,
              "reps": "3",
              "rest": "3-5 min",
              "rpe": 8,
              "percentageOfMax": 85,
              "notes": "Main lift"
            }
            ... (ensure 12-18 exercises total)
          ]
        }
      ],
      "restDays": ["wednesday", "sunday"],
      "deloadWeek": false
    }
  ]
}

CRITICAL VALIDATION RULES:
1. durationWeeks MUST be 4-12
2. EVERY trainingDay MUST have 12-18 exercises total
3. EVERY trainingDay MUST have exercises in ALL categories: warmup, main-lift, accessory, cooldown
4. EVERY main-lift exercise MUST have rpe and percentageOfMax specified
5. nutritionPlan MUST include mealPlan with ALL 5 meals: breakfast, snack1, lunch, snack2, dinner
6. habitPlan MUST include 3-5 high-impact habits
7. Generate ${daysPerWeek} training days per week`;
}
