// programController.js - FORGE Program Management
const Program = require('../models/Program');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const AICoach = require('../models/AICoach');
const Nutrition = require('../models/Nutrition');
const aiService = require('../services/aiService');

// ============================================
// SHARED CORE FUNCTION - Used by HTTP endpoint AND aiCoachController
// ============================================
/**
 * Generate a complete FORGE program for a user
 * @param {Object} user - Mongoose User document
 * @param {Object} aiCoach - Mongoose AICoach document
 * @returns {Object} { success, error?, program?, stats? }
 */
async function generateProgramCore(user, aiCoach) {
  const userId = user._id;

  // ═══════════════════════════════════════════════════════════
  // GATHER ALL USER DATA
  // ═══════════════════════════════════════════════════════════
  const competitionData = user.competitionPrep || {};
  const bodyCompData = user.bodyComposition || {};
  const lifestyleData = user.lifestyle || {};
  const experienceData = user.experience || {};
  const exercisePrefs = user.exercisePreferences || {};
  const scheduleData = user.schedule || {};
  const equipmentData = user.equipment || {};
  const limitationsData = user.limitations || {};
  const dietaryPrefs = user.dietaryPreferences || {};
  const profileData = user.profile || {};

    // Calculate TDEE if needed
    let tdee = 2000;  // Default fallback
    if (user.profile?.currentWeight && lifestyleData.jobType) {
      // Simplified TDEE calculation (Harris-Benedict formula)
      const weight = user.profile.currentWeight;
      const activity = {
        'sedentary': 1.2,
        'lightly-active': 1.375,
        'moderately-active': 1.55,
        'very-active': 1.725,
        'extremely-active': 1.9
      };
      const multiplier = activity[lifestyleData.jobType] || 1.55;
      tdee = Math.round(weight * 15 * multiplier);  // Simplified
    }

    // ═══════════════════════════════════════════════════════════
    // BUILD COMPREHENSIVE FORGE PROMPT
    // ═══════════════════════════════════════════════════════════
    const prompt = `You are FORGE - the elite AI coach for ClockWork. Your job is to analyze this user's complete data and generate a structured, persistent training program.

═══════════════════════════════════════════════════════════
USER PROFILE: ${user.name}
═══════════════════════════════════════════════════════════
EXPERIENCE:
- Level: ${experienceData.level || 'intermediate'}
- Years Training: ${experienceData.yearsTraining || 1}
- Primary Discipline: ${experienceData.primaryDiscipline || 'general-fitness'}

GOALS:
- Primary Goal: ${user.primaryGoal?.type || 'general-health'}
- Target Weight: ${bodyCompData.targetWeight || 'maintain'}
- Current Weight: ${user.profile?.currentWeight || 'not specified'}
- Timeline: ${user.primaryGoal?.targetDate ? new Date(user.primaryGoal.targetDate).toLocaleDateString() : 'flexible'}

TRAINING SCHEDULE:
- Days per Week: ${scheduleData.daysPerWeek || 4}
- Preferred Days: ${scheduleData.preferredDays?.join(', ') || 'flexible'}
- Session Duration: ${scheduleData.sessionDuration || 60} minutes
- Preferred Time: ${scheduleData.preferredTime || 'flexible'}

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

PERSONAL RECORDS:
${user.personalRecords && user.personalRecords.length > 0
  ? user.personalRecords.map(pr => `- ${pr.exerciseName}: ${pr.weight}lbs x${pr.reps} (1RM: ~${pr.oneRepMax}lbs)`).join('\n')
  : '- Not specified (will be discovered during training)'}

${competitionData.isCompeting ? `
═══════════════════════════════════════════════════════════
COMPETITION PREP (CRITICAL)
═══════════════════════════════════════════════════════════
- Sport: ${competitionData.sport || 'powerlifting'}
- Meet Date: ${competitionData.meetDate ? new Date(competitionData.meetDate).toLocaleDateString() : 'not specified'}
- Federation: ${competitionData.federation || 'not specified'}
- Weight Class: ${competitionData.targetWeightClass || 'current weight'}
- Current Total: ${competitionData.currentTotal || 'not specified'}
- Target Total: ${competitionData.qualifyingTotal || 'not specified'}
- Current Lifts: Squat ${competitionData.previousMeets?.[0]?.squat || 'unknown'}, Bench ${competitionData.previousMeets?.[0]?.bench || 'unknown'}, Deadlift ${competitionData.previousMeets?.[0]?.deadlift || 'unknown'}
` : ''}

═══════════════════════════════════════════════════════════
CRITICAL: COMPREHENSIVE WORKOUT STRUCTURE REQUIREMENTS
═══════════════════════════════════════════════════════════

EVERY SINGLE TRAINING DAY MUST FOLLOW THIS EXACT STRUCTURE:

1. **ACTIVE WARMUP** (5-10 minutes total):
   - Category: "warmup"
   - Include 2-3 mobility exercises appropriate for the day's focus
   - Examples: "Hip Circles: 2 sets × 10 reps each direction", "Arm Circles: 2 sets × 10 reps", "Cat-Cow Stretch: 2 sets × 10 reps"
   - Dynamic stretches and activation drills

2. **WARMUP SETS** (Build up to working weight):
   - Category: "warmup"
   - Include 2-3 ramp-up sets for the main lift
   - Example: "Barbell Squat Warmup: 3 sets × 5 reps @ 50%, 65%, 75% of working weight - 1 min rest"
   - Light weight progression to prepare nervous system

3. **MAIN LIFTS** (Heavy compound movements):
   - Category: "main-lift"
   - Include 2-4 primary compound exercises per day
   - MUST include: sets, reps, rest period, RPE, percentageOfMax (relative to 1RM)
   - Example: "Barbell Squat: 5 sets × 3 reps @ RPE 8 (85% 1RM) - 3-5 min rest"
   - Example: "Barbell Bench Press: 4 sets × 5 reps @ RPE 7 (80% 1RM) - 3 min rest"
   - Proper recovery time between sets

4. **ACCESSORY EXERCISES** (Supporting movements):
   - Category: "accessory"
   - Include 4-6 accessory exercises per day
   - Target muscles that support main lifts
   - Example: "Leg Press: 3 sets × 8-12 reps @ RPE 7 - 90 sec rest"
   - Example: "Hamstring Curls: 3 sets × 10-15 reps @ RPE 7 - 60 sec rest"
   - Example: "Calf Raises: 3 sets × 15-20 reps @ RPE 6 - 45 sec rest"
   - Include unilateral work, isolation exercises, and core work

5. **COOLDOWN/STRETCHING** (5-10 minutes):
   - Category: "cooldown"
   - Static stretching targeting muscles worked
   - Example: "Static Stretching: Hold each stretch 30-60 seconds - focus on quads, hamstrings, hip flexors, glutes, chest, shoulders"

TOTAL EXERCISES PER WORKOUT: 12-18 exercises minimum
- Warmup/mobility: 3-4 exercises
- Warmup sets: 2-3 exercises
- Main lifts: 2-4 exercises
- Accessories: 4-6 exercises
- Cooldown: 1-2 exercises

═══════════════════════════════════════════════════════════
NUTRITION PLAN REQUIREMENTS
═══════════════════════════════════════════════════════════

Generate a COMPLETE meal plan with nutritionPlan.mealPlan containing:

{
  "breakfast": {
    "name": "Meal name",
    "description": "What's in it",
    "calories": 600,
    "protein": 40,
    "carbs": 60,
    "fat": 15,
    "ingredients": ["egg", "oats", "banana"],
    "prepTime": 15
  },
  "snack1": { ... },
  "lunch": { ... },
  "snack2": { ... },
  "dinner": { ... }
}

Each meal must have: name, description, calories, protein, carbs, fat, ingredients array, prepTime

═══════════════════════════════════════════════════════════
PROGRAM DURATION REQUIREMENTS
═══════════════════════════════════════════════════════════

- MINIMUM: 8 weeks for all programs
- COMPETITION PREP: 12 weeks minimum if elite competitor within 16 weeks of meet
- Generate ${scheduleData.daysPerWeek || 4} training days per week
- ${scheduleData.daysPerWeek || 4} × 8 weeks MINIMUM = ${(scheduleData.daysPerWeek || 4) * 8} total training days
- EVERY week must have complete workouts with full structure (warmup, main, accessories, cooldown)

═══════════════════════════════════════════════════════════
YOUR TASK: Generate a structured program in JSON format
═══════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no explanations). Use this exact structure:

{
  "name": "Descriptive program name (e.g., '8-Week Powerlifting Peak', 'Competition Prep Block')",
  "durationWeeks": 8-12,
  "periodization": {
    "model": "linear|block|undulating|conjugate|autoregulated",
    "phases": [
      {
        "name": "accumulation|strength|intensity|peak|deload|transition",
        "startWeek": 1,
        "endWeek": 3,
        "volumeLevel": "low|moderate|high",
        "intensityRange": [70, 85],
        "rpeTarget": 6,
        "deloadWeek": false
      }
    ]
  },
  "nutritionPlan": {
    "calorieTarget": ${bodyCompData.goal === 'lose-fat' ? Math.round(tdee - 500) : bodyCompData.goal === 'bulk' ? Math.round(tdee + 500) : tdee},
    "macros": {
      "protein": ${Math.round(user.profile?.currentWeight * 1.0 || 180)},
      "carbs": ${Math.round((tdee * 0.40) / 4)},
      "fat": ${Math.round((tdee * 0.30) / 9)}
    },
    "mealPlan": {
      "breakfast": {
        "name": "High Protein Breakfast",
        "description": "Scrambled eggs with oats and fruit",
        "calories": 600,
        "protein": 40,
        "carbs": 60,
        "fat": 15,
        "ingredients": ["4 eggs", "1 cup oats", "1 banana", "1 cup berries"],
        "prepTime": 15
      },
      "snack1": {
        "name": "Greek Yogurt Bowl",
        "description": "Greek yogurt with granola and honey",
        "calories": 250,
        "protein": 25,
        "carbs": 30,
        "fat": 5,
        "ingredients": ["1 cup greek yogurt", "1/3 cup granola", "1 tbsp honey"],
        "prepTime": 5
      },
      "lunch": {
        "name": "Grilled Chicken & Rice",
        "description": "Chicken breast with brown rice and vegetables",
        "calories": 700,
        "protein": 50,
        "carbs": 70,
        "fat": 12,
        "ingredients": ["8 oz chicken breast", "1 cup brown rice", "broccoli", "olive oil"],
        "prepTime": 25
      },
      "snack2": {
        "name": "Protein Shake",
        "description": "Whey protein with banana and peanut butter",
        "calories": 300,
        "protein": 30,
        "carbs": 35,
        "fat": 8,
        "ingredients": ["1 scoop whey protein", "1 banana", "1 tbsp peanut butter", "8 oz milk"],
        "prepTime": 5
      },
      "dinner": {
        "name": "Salmon & Sweet Potato",
        "description": "Grilled salmon with sweet potato and green beans",
        "calories": 650,
        "protein": 45,
        "carbs": 55,
        "fat": 18,
        "ingredients": ["8 oz salmon", "1 large sweet potato", "green beans", "olive oil"],
        "prepTime": 30
      }
    }
  },
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
              "name": "Bodyweight Squats",
              "category": "warmup",
              "sets": 2,
              "reps": "10",
              "rest": "30 sec",
              "notes": "Movement pattern"
            },
            {
              "name": "Barbell Squat Warmup",
              "category": "warmup",
              "sets": 3,
              "reps": "5",
              "rest": "1 min",
              "notes": "Bar, 135lbs, 225lbs"
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
            },
            {
              "name": "Front Squat",
              "category": "main-lift",
              "sets": 3,
              "reps": "5",
              "rest": "3 min",
              "rpe": 7,
              "percentageOfMax": 75,
              "notes": "Quad focus"
            },
            {
              "name": "Leg Press",
              "category": "accessory",
              "sets": 3,
              "reps": "10-12",
              "rest": "90 sec",
              "rpe": 7,
              "notes": "Hypertrophy"
            },
            {
              "name": "Bulgarian Split Squats",
              "category": "accessory",
              "sets": 3,
              "reps": "8-10 each",
              "rest": "90 sec",
              "rpe": 7,
              "notes": "Unilateral"
            },
            {
              "name": "Hamstring Curls",
              "category": "accessory",
              "sets": 3,
              "reps": "12-15",
              "rest": "60 sec",
              "rpe": 6,
              "notes": "Knee health"
            },
            {
              "name": "Calf Raises",
              "category": "accessory",
              "sets": 3,
              "reps": "15-20",
              "rest": "45 sec",
              "rpe": 6,
              "notes": "Full ROM"
            },
            {
              "name": "Planks",
              "category": "accessory",
              "sets": 3,
              "reps": "45-60 sec hold",
              "rest": "60 sec",
              "notes": "Core"
            },
            {
              "name": "Static Stretching",
              "category": "cooldown",
              "sets": 1,
              "reps": "5-10 min",
              "rest": "0 sec",
              "notes": "30-60 sec each: quads, hamstrings, hip flexors, glutes"
            }
          ]
        }
      ],
      "restDays": ["wednesday", "sunday"],
      "deloadWeek": false
    }
  ]
}

CRITICAL VALIDATION RULES:
1. durationWeeks MUST be 8-12 (NEVER less than 8)
2. EVERY trainingDay MUST have 12-18 exercises total
3. EVERY trainingDay MUST have exercises in ALL categories: warmup, main-lift, accessory, cooldown
4. EVERY main-lift exercise MUST have rpe and percentageOfMax specified
5. nutritionPlan MUST include mealPlan with ALL 5 meals: breakfast, snack1, lunch, snack2, dinner
6. Each meal MUST have: name, description, calories, protein, carbs, fat, ingredients, prepTime
7. Generate ${scheduleData.daysPerWeek || 4} training days per week × 8 weeks minimum = ${(scheduleData.daysPerWeek || 4) * 8} total training days
8. If ${competitionData.isCompeting ? 'COMPETITION - Use 12 weeks minimum, build in deload weeks' : 'NO COMPETITION - Use 8 weeks minimum with steady progression'}`;

    // ═══════════════════════════════════════════════════════════
    // CALL FORGE TO GENERATE PROGRAM
    // ═══════════════════════════════════════════════════════════
    console.log('[FORGE] Generating program for user:', userId);

    const aiResponse = await aiService.generateAIContent(prompt, 'You are FORGE, the AI training coach', 16384);

    // Parse JSON response
    let programData;
    try {
      // Extract JSON from response (handle cases where AI wraps in markdown)
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse.text;
      programData = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('[FORGE] Failed to parse program JSON:', parseErr);
      return {
        success: false,
        statusCode: 400,
        message: 'Failed to generate valid program structure',
        error: 'Program generation produced invalid JSON'
      };
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDATE PROGRAM STRUCTURE
    // ═══════════════════════════════════════════════════════════
    const expectedDaysPerWeek = scheduleData.daysPerWeek || 4;

    // Validate duration
    if (!programData.durationWeeks || programData.durationWeeks < 8) {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid program duration',
        error: `Program must be at least 8 weeks. AI generated ${programData.durationWeeks} weeks.`
      };
    }

    // Validate weekly templates exist
    if (!programData.weeklyTemplates || programData.weeklyTemplates.length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid program structure',
        error: 'No weekly templates found in program'
      };
    }

    // Validate each week has correct number of training days
    for (const weekTemplate of programData.weeklyTemplates) {
      if (!weekTemplate.trainingDays || weekTemplate.trainingDays.length === 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Invalid program structure',
          error: `Week ${weekTemplate.weekNumber} has no training days. Expected ${expectedDaysPerWeek}.`
        };
      }

      if (weekTemplate.trainingDays.length !== expectedDaysPerWeek) {
        return {
          success: false,
          statusCode: 400,
          message: 'Invalid program structure',
          error: `Week ${weekTemplate.weekNumber} has ${weekTemplate.trainingDays.length} days, expected ${expectedDaysPerWeek}.`
        };
      }

      // Validate each training day has exercises
      for (const day of weekTemplate.trainingDays) {
        if (!day.exercises || day.exercises.length < 12) {
          return {
            success: false,
            statusCode: 400,
            message: 'Invalid program structure',
            error: `${day.dayOfWeek} in week ${weekTemplate.weekNumber} has ${day.exercises?.length || 0} exercises. Minimum is 12.`
          };
        }

        // Validate exercise categories
        const categories = new Set(day.exercises.map(e => e.category));
        const requiredCategories = ['warmup', 'main-lift', 'accessory', 'cooldown'];
        const hasAllCategories = requiredCategories.every(cat => categories.has(cat));

        if (!hasAllCategories) {
          return {
            success: false,
            statusCode: 400,
            message: 'Invalid program structure',
            error: `${day.dayOfWeek} in week ${weekTemplate.weekNumber} missing required exercise categories. Has: ${[...categories].join(', ')}. Need: ${requiredCategories.join(', ')}`
          };
        }
      }
    }

    // Validate nutrition plan
    if (!programData.nutritionPlan || !programData.nutritionPlan.mealPlan) {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid program structure',
        error: 'Nutrition plan with meal plan is required'
      };
    }

    const requiredMeals = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
    const mealPlan = programData.nutritionPlan.mealPlan;
    for (const mealType of requiredMeals) {
      if (!mealPlan[mealType]) {
        return {
          success: false,
          statusCode: 400,
          message: 'Invalid program structure',
          error: `Missing meal: ${mealType}. Required meals: ${requiredMeals.join(', ')}`
        };
      }

      const meal = mealPlan[mealType];
      if (!meal.name || !meal.description || !meal.calories || !meal.protein || !meal.carbs || !meal.fat || !meal.ingredients || !meal.prepTime) {
        return {
          success: false,
          statusCode: 400,
          message: 'Invalid program structure',
          error: `${mealType} is missing required fields: name, description, calories, protein, carbs, fat, ingredients, prepTime`
        };
      }
    }

    console.log('[FORGE] Program validation passed');

    // ═══════════════════════════════════════════════════════════
    // CREATE PROGRAM IN DATABASE
    // ═══════════════════════════════════════════════════════════
    const program = new Program({
      userId,
      name: programData.name || `${user.primaryGoal?.type || 'General'} Program`,
      goal: user.primaryGoal?.type || 'general-health',
      status: 'active',
      startDate: new Date(),
      durationWeeks: programData.durationWeeks || 4,
      currentWeek: 1,
      periodization: programData.periodization || { model: 'linear', phases: [] },
      weeklyTemplates: programData.weeklyTemplates || [],
      nutritionPlan: programData.nutritionPlan || {},
      competitionPrep: competitionData.isCompeting ? {
        competitionDate: competitionData.meetDate,
        federation: competitionData.federation,
        weightClass: competitionData.targetWeightClass,
        currentLifts: user.personalRecords
          ?.filter(pr => ['Barbell Squat', 'Barbell Bench Press', 'Barbell Deadlift'].some(ex => pr.exerciseName?.includes(ex)))
          ?.reduce((acc, pr) => {
            const lift = pr.exerciseName.toLowerCase();
            if (lift.includes('squat')) acc.squat = pr.oneRepMax;
            if (lift.includes('bench')) acc.bench = pr.oneRepMax;
            if (lift.includes('deadlift')) acc.deadlift = pr.oneRepMax;
            return acc;
          }, {}) || {}
      } : {},
      autoregulation: { enabled: true },
      aiGenerated: true,
      aiRationale: `Generated from user profile: ${experienceData.level} level, ${user.primaryGoal?.type} goal, ${scheduleData.daysPerWeek} days/week`
    });

    const savedProgram = await program.save();
    console.log('[FORGE] Program created:', savedProgram._id);

    // ═══════════════════════════════════════════════════════════
    // UPDATE AICOACH TO REFERENCE NEW PROGRAM
    // ═══════════════════════════════════════════════════════════
    aiCoach.currentProgramId = savedProgram._id;
    await aiCoach.save();

    // ═══════════════════════════════════════════════════════════
    // PROPAGATE PROGRAM TO CALENDAR
    // ═══════════════════════════════════════════════════════════
    const calendarEvents = await savedProgram.generateCalendarEvents();
    console.log('[FORGE] Calendar events generated:', calendarEvents.length);

    // ═══════════════════════════════════════════════════════════
    // UPDATE NUTRITION TARGETS
    // ═══════════════════════════════════════════════════════════
    const nutrition = await Nutrition.getOrCreateForUser(userId);
    let mealEvents = [];
    if (programData.nutritionPlan) {
      nutrition.targets = {
        calories: programData.nutritionPlan.calorieTarget,
        protein: programData.nutritionPlan.macros?.protein || 0,
        carbs: programData.nutritionPlan.macros?.carbs || 0,
        fat: programData.nutritionPlan.macros?.fat || 0,
        calculatedAt: new Date()
      };
      await nutrition.save();
      console.log('[FORGE] Nutrition targets updated');

      // ✅ GENERATE MEAL CALENDAR EVENTS
      if (programData.nutritionPlan.mealPlan) {
        mealEvents = await generateMealCalendarEvents(
          userId,
          savedProgram,
          programData.nutritionPlan.mealPlan
        );
        console.log(`[FORGE] Meal events generated: ${mealEvents.length}`);
      }
    }

    // Calculate exercise count from first workout
    const firstWorkout = savedProgram.weeklyTemplates?.[0]?.trainingDays?.[0];
    const exercisesPerWorkout = firstWorkout?.exercises?.length || 0;

    // ═══════════════════════════════════════════════════════════
    // RETURN PROGRAM DETAILS
    // ═══════════════════════════════════════════════════════════
    return {
      success: true,
      message: 'Program generated successfully',
      program: {
        _id: savedProgram._id,
        name: savedProgram.name,
        goal: savedProgram.goal,
        durationWeeks: savedProgram.durationWeeks,
        startDate: savedProgram.startDate,
        periodization: savedProgram.periodization,
        nutritionPlan: savedProgram.nutritionPlan,
        stats: {
          calendarEventsCreated: calendarEvents.length,
          mealEventsCreated: mealEvents.length,
          totalEventsCreated: calendarEvents.length + mealEvents.length,
          weeksPlanned: savedProgram.weeklyTemplates.length,
          trainingDaysPerWeek: savedProgram.weeklyTemplates[0]?.trainingDays?.length || 0,
          exercisesPerWorkout: exercisesPerWorkout
        }
      }
    };

  } catch (error) {
    console.error('[FORGE] Program generation error:', error);
    return {
      success: false,
      statusCode: 500,
      message: 'Failed to generate program',
      error: error.message
    };
  }
}

// ============================================
// HTTP ENDPOINT WRAPPER - calls generateProgramCore
// ============================================
exports.generateProgram = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    // Subscription check
    if (!user.hasActiveSubscription()) {
      const trialHours = user.getTrialRemainingHours();
      return res.status(403).json({
        success: false,
        message: 'Subscription required',
        trialRemaining: trialHours
      });
    }

    // Call core function
    const result = await generateProgramCore(user, aiCoach);

    // Translate result to HTTP response
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(result.statusCode || 400).json(result);
    }

  } catch (error) {
    console.error('[FORGE] HTTP endpoint error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET ACTIVE PROGRAM
// ============================================
exports.getActiveProgram = async (req, res) => {
  try {
    const userId = req.user.id;
    const program = await Program.getActiveForUser(userId)
      .populate('userId', 'name email');

    if (!program) {
      return res.json({
        success: true,
        program: null,
        message: 'No active program. Generate one to get started!'
      });
    }

    res.json({
      success: true,
      program: {
        _id: program._id,
        name: program.name,
        goal: program.goal,
        status: program.status,
        startDate: program.startDate,
        endDate: program.endDate,
        durationWeeks: program.durationWeeks,
        currentWeek: program.currentWeek,
        percentComplete: program.percentComplete,
        weeksRemaining: program.weeksRemaining,
        periodization: program.periodization,
        nutritionPlan: program.nutritionPlan,
        competitionPrep: program.competitionPrep,
        weeklyTemplates: program.weeklyTemplates.map(w => ({
          weekNumber: w.weekNumber,
          trainingDays: w.trainingDays.length,
          restDays: w.restDays,
          deloadWeek: w.deloadWeek
        }))
      }
    });

  } catch (error) {
    console.error('Get active program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// PROGRESS PROGRAM TO NEXT WEEK
// ============================================
exports.progressProgram = async (req, res) => {
  try {
    const userId = req.user.id;
    const program = await Program.getActiveForUser(userId);

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'No active program'
      });
    }

    await program.progressToNextWeek();

    res.json({
      success: true,
      message: `Program advanced to week ${program.currentWeek}`,
      program: {
        currentWeek: program.currentWeek,
        weeksRemaining: program.weeksRemaining,
        percentComplete: program.percentComplete,
        status: program.status,
        currentPhase: program.calculateCurrentPhase()?.name
      }
    });

  } catch (error) {
    console.error('Progress program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to progress program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET CALENDAR EVENTS FOR PROGRAM
// ============================================
exports.getProgramCalendarEvents = async (req, res) => {
  try {
    const userId = req.user.id;
    const { programId } = req.params;

    const events = await CalendarEvent.find({
      userId,
      programId
    }).sort('date').lean();

    res.json({
      success: true,
      events: events.map(e => ({
        _id: e._id,
        title: e.title,
        date: e.date,
        type: e.type,
        weekNumber: e.weekNumber,
        periodizationPhase: e.periodizationPhase,
        exercises: e.exercises?.length || 0,
        status: e.status
      }))
    });

  } catch (error) {
    console.error('Get program calendar events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get calendar events',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// PAUSE/RESUME PROGRAM
// ============================================
exports.updateProgramStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { programId } = req.params;
    const { status } = req.body;

    if (!['active', 'paused', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const program = await Program.findOne({ _id: programId, userId });

    if (!program) {
      return res.status(404).json({
        success: false,
        message: 'Program not found'
      });
    }

    program.status = status;
    await program.save();

    res.json({
      success: true,
      message: `Program ${status}`,
      program: {
        _id: program._id,
        status: program.status
      }
    });

  } catch (error) {
    console.error('Update program status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// HELPER: Generate Meal Calendar Events
// ============================================
async function generateMealCalendarEvents(userId, program, mealPlan) {
  const CalendarEvent = require('../models/CalendarEvent');
  const events = [];

  const mealTypes = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
  const mealTimes = {
    breakfast: '08:00',
    snack1: '10:30',
    lunch: '12:30',
    snack2: '15:30',
    dinner: '18:30'
  };

  // Generate meals for each day of the program
  for (let week = 0; week < program.durationWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      const eventDate = new Date(program.startDate);
      eventDate.setDate(eventDate.getDate() + (week * 7) + day);

      // Skip past dates (compare dates only, not timestamps)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(eventDate);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate < today) continue;

      // Create CalendarEvent for each meal
      for (const mealType of mealTypes) {
        const mealData = mealPlan[mealType];

        if (mealData) {
          events.push({
            userId,
            type: 'nutrition',
            title: mealData.name || `${mealType.charAt(0).toUpperCase() + mealType.slice(1)}`,
            date: eventDate,
            startTime: mealTimes[mealType],
            mealData: {
              mealType: mealType,
              name: mealData.name,
              description: mealData.description,
              calories: mealData.calories,
              protein: mealData.protein,
              carbs: mealData.carbs,
              fat: mealData.fat,
              ingredients: mealData.ingredients,
              prepTime: mealData.prepTime,
              imageUrl: mealData.imageUrl || null
            },
            programId: program._id,
            aiGenerated: true,
            aiReason: `Meal plan from Program: ${program.name}`,
            status: 'scheduled'
          });
        }
      }
    }
  }

  // Bulk insert meal events
  if (events.length > 0) {
    const created = await CalendarEvent.insertMany(events);
    console.log(`[FORGE] Created ${created.length} meal calendar events`);
    return created;
  }

  return [];
}

// Export the core function for use by aiCoachController
exports.generateProgramCore = generateProgramCore;

module.exports = exports;
