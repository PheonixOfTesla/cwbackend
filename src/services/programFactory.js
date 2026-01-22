// Src/services/programFactory.js - BULLETPROOF Program Factory
// This NEVER fails. User ALWAYS gets a program.

const mongoose = require('mongoose');
const Program = require('../models/Program');
const CalendarEvent = require('../models/CalendarEvent');
const Nutrition = require('../models/Nutrition');
const User = require('../models/User');
const AICoach = require('../models/AICoach');
const aiService = require('./aiService');

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION - BULLETPROOF, NEVER FAILS
// ═══════════════════════════════════════════════════════════

/**
 * Create a program for the user - GUARANTEED TO WORK
 * 1. Tries AI generation
 * 2. Falls back to personalized template if AI fails
 * 3. Always saves to calendar
 */
exports.createProgramForUser = async (userId, options = {}) => {
  console.log(`[ProgramFactory] Starting generation for user ${userId}`);

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // 1. GATHER USER DATA (This never fails - just reads from DB)
  const context = gatherUserContext(user);
  console.log(`[ProgramFactory] User context: ${context.daysPerWeek} days/week, goal: ${context.goal}, TDEE: ${context.tdee}`);

  // 2. TRY AI GENERATION, FALL BACK TO TEMPLATE
  let programData;
  let aiGenerated = false;

  try {
    console.log('[ProgramFactory] Attempting AI generation...');
    const prompt = buildSimplePrompt(user, context);
    const aiResponse = await aiService.generateAIContent(prompt, 'You are FORGE. Return ONLY valid JSON.', 8192);

    if (aiResponse.fallback) {
      // AI service returned its own fallback
      console.log('[ProgramFactory] Using AI service fallback');
      programData = JSON.parse(aiResponse.text);
    } else {
      // Parse AI response
      programData = parseAIResponse(aiResponse.text);
      aiGenerated = true;
      console.log(`[ProgramFactory] AI generation success via ${aiResponse.source}`);
    }
  } catch (error) {
    console.warn(`[ProgramFactory] AI failed: ${error.message}. Using personalized template.`);
    programData = buildPersonalizedFallback(user, context);
  }

  // 3. VALIDATE & FIX (Don't throw, just fix)
  programData = ensureValidStructure(programData, context);

  // 4. SAVE TO DATABASE
  const result = await saveAndPropagate(user, programData, options.source, aiGenerated);

  console.log(`[ProgramFactory] SUCCESS: ${result.stats.workouts} workouts, ${result.stats.meals} meals, ${result.stats.habits} habits`);
  return result;
};

// ═══════════════════════════════════════════════════════════
// GATHER USER CONTEXT (From onboarding data)
// ═══════════════════════════════════════════════════════════

function gatherUserContext(user) {
  const schedule = user.schedule || {};
  const profile = user.profile || {};
  const lifestyle = user.lifestyle || {};
  const goal = user.primaryGoal?.type || 'general-health';

  // Calculate TDEE
  const weight = profile.currentWeight || 180;
  const activityMultipliers = {
    'sedentary': 1.2,
    'lightly-active': 1.375,
    'moderately-active': 1.55,
    'very-active': 1.725,
    'extremely-active': 1.9
  };
  const multiplier = activityMultipliers[lifestyle.jobType] || 1.55;
  let tdee = Math.round(weight * 15 * multiplier);

  // Adjust for goal
  if (goal === 'lose-fat') tdee = Math.round(tdee * 0.8);
  if (goal === 'build-muscle') tdee = Math.round(tdee * 1.1);

  // Calculate macros
  const proteinPerLb = (goal === 'build-muscle' || goal === 'build-strength') ? 1.2 : 1.0;
  const protein = Math.round(weight * proteinPerLb);
  const fat = Math.round((tdee * 0.30) / 9);
  const carbs = Math.round((tdee - (protein * 4) - (fat * 9)) / 4);

  return {
    weight,
    tdee,
    protein,
    carbs,
    fat,
    daysPerWeek: schedule.daysPerWeek || 4,
    preferredDays: schedule.preferredDays || ['monday', 'tuesday', 'thursday', 'friday'],
    experienceLevel: user.experience?.level || 'intermediate',
    discipline: user.experience?.primaryDiscipline || 'general-fitness',
    goal,
    equipment: user.equipment?.availableEquipment || ['barbell', 'dumbbells', 'cable-machine'],
    favoriteExercises: user.exercisePreferences?.favoriteExercises || [],
    hatedExercises: user.exercisePreferences?.hatedExercises || [],
    injuries: user.limitations?.injuries || []
  };
}

// ═══════════════════════════════════════════════════════════
// SIMPLE AI PROMPT (Smaller = More Reliable)
// ═══════════════════════════════════════════════════════════

function buildSimplePrompt(user, ctx) {
  return `Generate a ${ctx.daysPerWeek}-day/week ${ctx.discipline} program for ${user.name}.

USER DATA:
- Goal: ${ctx.goal}
- Experience: ${ctx.experienceLevel}
- Equipment: ${ctx.equipment.join(', ')}
- Favorites: ${ctx.favoriteExercises.join(', ') || 'none'}
- Avoid: ${ctx.hatedExercises.join(', ') || 'none'}
- Injuries: ${ctx.injuries.map(i => i.bodyPart).join(', ') || 'none'}
- Calories: ${ctx.tdee} (P:${ctx.protein}g C:${ctx.carbs}g F:${ctx.fat}g)

EXERCISE CATEGORIES:
- "warmup": Active warmups to prepare the body (3 exercises)
- "primary": Main compound lifts (1-2 exercises)
- "accessory": Supporting movements (3-5 exercises)

OUTPUT JSON ONLY:
{
  "name": "Program Name",
  "durationWeeks": 8,
  "periodization": { "model": "linear", "phases": [{"name": "accumulation", "weeks": [1,2,3,4]}, {"name": "intensity", "weeks": [5,6,7]}, {"name": "deload", "weeks": [8]}] },
  "nutritionPlan": {
    "calorieTarget": ${ctx.tdee},
    "macros": { "protein": ${ctx.protein}, "carbs": ${ctx.carbs}, "fat": ${ctx.fat} },
    "mealPlan": {
      "breakfast": { "name": "...", "foods": ["..."], "calories": ... },
      "snack1": { "name": "...", "foods": ["..."], "calories": ... },
      "lunch": { "name": "...", "foods": ["..."], "calories": ... },
      "snack2": { "name": "...", "foods": ["..."], "calories": ... },
      "dinner": { "name": "...", "foods": ["..."], "calories": ... }
    }
  },
  "habitPlan": [
    { "name": "Habit Name", "frequency": "daily", "trackingType": "boolean" }
  ],
  "weeklyTemplates": [
    {
      "weekNumber": 1,
      "trainingDays": [
        {
          "dayOfWeek": "${ctx.preferredDays[0] || 'monday'}",
          "focus": "Upper Power",
          "exercises": [
            { "name": "Arm Circles", "category": "warmup", "sets": 2, "reps": "10 each", "notes": "Warm up shoulders" },
            { "name": "Bench Press", "category": "primary", "sets": 4, "reps": "6-8", "rpe": 8 },
            { "name": "Incline Dumbbell Press", "category": "accessory", "sets": 3, "reps": "10-12", "rpe": 7 }
          ]
        }
      ]
    }
  ]
}`;
}

// ═══════════════════════════════════════════════════════════
// PARSE AI RESPONSE
// ═══════════════════════════════════════════════════════════

function parseAIResponse(text) {
  // Find JSON in response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }
  return JSON.parse(jsonMatch[0]);
}

// ═══════════════════════════════════════════════════════════
// PERSONALIZED FALLBACK (When AI fails)
// ═══════════════════════════════════════════════════════════

function buildPersonalizedFallback(user, ctx) {
  // Build workout templates based on user's discipline and schedule
  const templates = buildWorkoutTemplates(ctx);

  return {
    name: `${user.name}'s ${capitalize(ctx.discipline)} Program`,
    durationWeeks: 8,
    periodization: {
      model: "linear",
      phases: [
        { name: "accumulation", weeks: [1, 2, 3, 4] },
        { name: "intensity", weeks: [5, 6, 7] },
        { name: "deload", weeks: [8] }
      ]
    },
    nutritionPlan: {
      calorieTarget: ctx.tdee,
      macros: { protein: ctx.protein, carbs: ctx.carbs, fat: ctx.fat },
      mealPlan: {
        breakfast: { name: "Power Breakfast", foods: ["Eggs", "Oatmeal", "Banana"], calories: Math.round(ctx.tdee * 0.2) },
        snack1: { name: "Mid-Morning Fuel", foods: ["Greek Yogurt", "Almonds"], calories: Math.round(ctx.tdee * 0.12) },
        lunch: { name: "Balanced Lunch", foods: ["Chicken Breast", "Rice", "Vegetables"], calories: Math.round(ctx.tdee * 0.25) },
        snack2: { name: "Pre-Workout", foods: ["Protein Shake", "Apple"], calories: Math.round(ctx.tdee * 0.13) },
        dinner: { name: "Recovery Dinner", foods: ["Salmon", "Sweet Potato", "Broccoli"], calories: Math.round(ctx.tdee * 0.3) }
      }
    },
    habitPlan: [
      { name: "Drink Water", frequency: "daily", trackingType: "boolean", description: "Stay hydrated throughout the day" },
      { name: "Get 8 Hours Sleep", frequency: "daily", trackingType: "quantity", targetValue: 8, unit: "hours" },
      { name: "Hit Protein Goal", frequency: "daily", trackingType: "quantity", targetValue: ctx.protein, unit: "g" },
      { name: "Morning Mobility", frequency: "daily", trackingType: "boolean", description: "5-10 min mobility routine" }
    ],
    weeklyTemplates: templates
  };
}

function buildWorkoutTemplates(ctx) {
  const templates = [];

  // Get appropriate exercises for user's discipline
  const exerciseBank = getExerciseBank(ctx.discipline, ctx.equipment, ctx.hatedExercises);

  for (let week = 1; week <= 8; week++) {
    const isDeload = week === 4 || week === 8;
    const trainingDays = [];

    // Build each training day
    for (let i = 0; i < ctx.daysPerWeek; i++) {
      const dayOfWeek = ctx.preferredDays[i] || ['monday', 'tuesday', 'thursday', 'friday'][i];
      const focus = getDayFocus(i, ctx.discipline, ctx.daysPerWeek);

      trainingDays.push({
        dayOfWeek,
        focus,
        exercises: buildDayExercises(focus, exerciseBank, ctx.experienceLevel, isDeload)
      });
    }

    templates.push({
      weekNumber: week,
      deloadWeek: isDeload,
      trainingDays,
      restDays: getRestDays(ctx.preferredDays)
    });
  }

  return templates;
}

function getExerciseBank(discipline, equipment, hatedExercises) {
  const hated = hatedExercises.map(e => e.toLowerCase());

  const banks = {
    powerlifting: {
      'upper-push': ['Barbell Bench Press', 'Incline Bench Press', 'Close Grip Bench Press', 'Overhead Press', 'Dumbbell Press', 'Floor Press', 'Dips'],
      'upper-pull': ['Barbell Row', 'Pull-ups', 'Lat Pulldown', 'Cable Row', 'Face Pulls', 'Pendlay Row', 'Chin-ups'],
      'lower-quad': ['Barbell Squat', 'Front Squat', 'Leg Press', 'Bulgarian Split Squat', 'Lunges', 'Hack Squat', 'Goblet Squat'],
      'lower-hip': ['Conventional Deadlift', 'Romanian Deadlift', 'Sumo Deadlift', 'Hip Thrust', 'Good Mornings', 'Stiff Leg Deadlift', 'Block Pulls'],
      'accessory': ['Dumbbell Curl', 'Tricep Pushdown', 'Lateral Raise', 'Rear Delt Fly', 'Plank', 'Hammer Curl', 'Rope Pushdown', 'Cable Curl'],
      'core': ['Plank', 'Ab Wheel', 'Hanging Leg Raise', 'Cable Crunch', 'Russian Twist']
    },
    bodybuilding: {
      'chest': ['Barbell Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Dips', 'Pec Deck', 'Decline Press', 'Incline Fly'],
      'back': ['Pull-ups', 'Barbell Row', 'Lat Pulldown', 'Cable Row', 'Dumbbell Row', 'T-Bar Row', 'Straight Arm Pulldown'],
      'shoulders': ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Rear Delt Fly', 'Face Pulls', 'Arnold Press', 'Cable Lateral Raise'],
      'legs': ['Barbell Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curl', 'Leg Extension', 'Calf Raise', 'Walking Lunges', 'Sissy Squat'],
      'arms': ['Barbell Curl', 'Tricep Pushdown', 'Hammer Curl', 'Skull Crushers', 'Cable Curl', 'Preacher Curl', 'Overhead Tricep Extension'],
      'core': ['Cable Crunch', 'Hanging Leg Raise', 'Decline Sit-ups', 'Ab Wheel', 'Plank']
    },
    'general-fitness': {
      'upper': ['Push-ups', 'Dumbbell Press', 'Dumbbell Row', 'Lat Pulldown', 'Shoulder Press', 'Cable Fly', 'Face Pulls'],
      'upper-push': ['Push-ups', 'Dumbbell Press', 'Shoulder Press', 'Incline Press', 'Dips', 'Cable Fly'],
      'upper-pull': ['Dumbbell Row', 'Lat Pulldown', 'Cable Row', 'Face Pulls', 'Pull-ups', 'Rear Delt Fly'],
      'lower': ['Goblet Squat', 'Romanian Deadlift', 'Lunges', 'Leg Press', 'Calf Raise', 'Step-ups', 'Hip Thrust'],
      'core': ['Plank', 'Dead Bug', 'Russian Twist', 'Bird Dog', 'Ab Wheel', 'Mountain Climbers'],
      'full': ['Kettlebell Swing', 'Dumbbell Clean', 'Burpees', 'Mountain Climbers', 'Box Jumps', 'Thrusters'],
      'accessory': ['Dumbbell Curl', 'Tricep Pushdown', 'Lateral Raise', 'Rear Delt Fly', 'Plank', 'Calf Raise']
    }
  };

  const bank = banks[discipline] || banks['general-fitness'];

  // Filter out hated exercises
  Object.keys(bank).forEach(category => {
    bank[category] = bank[category].filter(ex => !hated.includes(ex.toLowerCase()));
  });

  return bank;
}

function getDayFocus(dayIndex, discipline, daysPerWeek) {
  const splits = {
    powerlifting: {
      3: ['Squat Focus', 'Bench Focus', 'Deadlift Focus'],
      4: ['Squat/Quads', 'Bench/Push', 'Deadlift/Pull', 'Upper Volume'],
      5: ['Squat Heavy', 'Bench Heavy', 'Deadlift Heavy', 'Upper Volume', 'Lower Volume'],
      6: ['Squat Heavy', 'Bench Heavy', 'Deadlift Heavy', 'Squat Volume', 'Bench Volume', 'Accessories']
    },
    bodybuilding: {
      3: ['Push', 'Pull', 'Legs'],
      4: ['Chest/Triceps', 'Back/Biceps', 'Legs', 'Shoulders/Arms'],
      5: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms'],
      6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']
    },
    'general-fitness': {
      3: ['Full Body A', 'Full Body B', 'Full Body C'],
      4: ['Upper Body', 'Lower Body', 'Upper Body', 'Lower Body'],
      5: ['Upper Push', 'Lower', 'Upper Pull', 'Lower', 'Full Body'],
      6: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']
    }
  };

  const disciplineSplits = splits[discipline] || splits['general-fitness'];
  const daySplit = disciplineSplits[daysPerWeek] || disciplineSplits[4];
  return daySplit[dayIndex % daySplit.length];
}

function buildDayExercises(focus, exerciseBank, experienceLevel, isDeload) {
  const exercises = [];
  const rpeBase = isDeload ? 6 : 8;
  const setsMultiplier = isDeload ? 0.6 : 1;

  // ═══════════════════════════════════════════════════════════
  // 1. WARMUPS - Always first (get the body ready)
  // ═══════════════════════════════════════════════════════════
  const focusLower = focus.toLowerCase();

  // Select warmups based on workout focus
  let warmups = [];
  if (focusLower.includes('lower') || focusLower.includes('leg') || focusLower.includes('squat') || focusLower.includes('deadlift')) {
    warmups = [
      { name: 'Leg Swings', sets: 2, reps: '10 each leg', category: 'warmup', notes: 'Front-to-back and side-to-side' },
      { name: 'Bodyweight Squats', sets: 2, reps: '10', category: 'warmup', notes: 'Slow and controlled' },
      { name: 'Hip Circles', sets: 2, reps: '10 each direction', category: 'warmup', notes: 'Open up the hips' }
    ];
  } else if (focusLower.includes('upper') || focusLower.includes('push') || focusLower.includes('bench') || focusLower.includes('chest')) {
    warmups = [
      { name: 'Arm Circles', sets: 2, reps: '10 each direction', category: 'warmup', notes: 'Small to large circles' },
      { name: 'Band Pull-Aparts', sets: 2, reps: '15', category: 'warmup', notes: 'Activate rear delts' },
      { name: 'Push-up Plus', sets: 2, reps: '10', category: 'warmup', notes: 'Protract shoulders at top' }
    ];
  } else if (focusLower.includes('pull') || focusLower.includes('back')) {
    warmups = [
      { name: 'Cat-Cow Stretch', sets: 2, reps: '10', category: 'warmup', notes: 'Mobilize the spine' },
      { name: 'Band Pull-Aparts', sets: 2, reps: '15', category: 'warmup', notes: 'Activate rear delts' },
      { name: 'Scapular Pull-ups', sets: 2, reps: '10', category: 'warmup', notes: 'Engage lats' }
    ];
  } else {
    // Full body / general warmup
    warmups = [
      { name: 'Jumping Jacks', sets: 2, reps: '20', category: 'warmup', notes: 'Get heart rate up' },
      { name: 'World\'s Greatest Stretch', sets: 2, reps: '5 each side', category: 'warmup', notes: 'Full body mobility' },
      { name: 'Inchworms', sets: 2, reps: '8', category: 'warmup', notes: 'Hamstrings and core activation' }
    ];
  }

  // Add warmups to exercises array
  exercises.push(...warmups);

  // ═══════════════════════════════════════════════════════════
  // 2. PRIMARY LIFTS - Main compound movements (1-2 exercises)
  // ═══════════════════════════════════════════════════════════
  let primaryCategories = [];
  if (focusLower.includes('squat') || focusLower.includes('quad') || focusLower.includes('legs') || focusLower.includes('lower')) {
    primaryCategories = ['lower-quad', 'lower-hip', 'legs', 'lower'];
  } else if (focusLower.includes('bench') || focusLower.includes('push') || focusLower.includes('chest')) {
    primaryCategories = ['upper-push', 'chest'];
  } else if (focusLower.includes('deadlift') || focusLower.includes('pull') || focusLower.includes('back')) {
    primaryCategories = ['lower-hip', 'upper-pull', 'back'];
  } else if (focusLower.includes('upper')) {
    primaryCategories = ['upper-push', 'upper-pull'];
  } else if (focusLower.includes('full')) {
    primaryCategories = ['upper', 'lower', 'full'];
  } else if (focusLower.includes('shoulder') || focusLower.includes('arm')) {
    primaryCategories = ['shoulders', 'upper-push'];
  }

  // Collect primary exercises
  let primaryExercises = [];
  primaryCategories.forEach(cat => {
    if (exerciseBank[cat]) {
      primaryExercises = primaryExercises.concat(exerciseBank[cat]);
    }
  });
  primaryExercises = [...new Set(primaryExercises)];

  // Add 1-2 primary lifts
  const primaryCount = 2;
  for (let i = 0; i < Math.min(primaryCount, primaryExercises.length); i++) {
    exercises.push({
      name: primaryExercises[i],
      category: 'primary',
      sets: Math.round(4 * setsMultiplier),
      reps: '5-6',
      rpe: rpeBase,
      rest: '3-4 min',
      notes: 'Focus on form and control'
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 3. ACCESSORIES - Supporting movements (3-5 exercises)
  // ═══════════════════════════════════════════════════════════
  const exerciseCounts = {
    'complete-beginner': 2,
    'beginner': 3,
    'intermediate': 4,
    'advanced': 5,
    'elite': 6
  };
  const accessoryCount = exerciseCounts[experienceLevel] || 4;

  // Get accessory exercises (different from primaries)
  let accessoryCategories = ['accessory'];
  if (focusLower.includes('lower') || focusLower.includes('leg')) {
    accessoryCategories = ['lower-quad', 'lower-hip', 'legs', 'lower', 'core', 'accessory'];
  } else if (focusLower.includes('upper') || focusLower.includes('push') || focusLower.includes('pull')) {
    accessoryCategories = ['upper-push', 'upper-pull', 'shoulders', 'arms', 'accessory'];
  } else {
    accessoryCategories = ['upper', 'lower', 'core', 'accessory'];
  }

  let accessoryExercises = [];
  accessoryCategories.forEach(cat => {
    if (exerciseBank[cat]) {
      accessoryExercises = accessoryExercises.concat(exerciseBank[cat]);
    }
  });

  // Remove duplicates and already-used primaries
  const usedNames = primaryExercises.slice(0, primaryCount);
  accessoryExercises = [...new Set(accessoryExercises)].filter(e => !usedNames.includes(e));

  for (let i = 0; i < Math.min(accessoryCount, accessoryExercises.length); i++) {
    exercises.push({
      name: accessoryExercises[i],
      category: 'accessory',
      sets: Math.round(3 * setsMultiplier),
      reps: '8-12',
      rpe: rpeBase - 1,
      rest: '90 sec',
      notes: 'Control the weight'
    });
  }

  return exercises;
}

function getRestDays(preferredDays) {
  const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return allDays.filter(d => !preferredDays.includes(d));
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

// ═══════════════════════════════════════════════════════════
// VALIDATION & FIXING (Don't throw, fix issues)
// ═══════════════════════════════════════════════════════════

function ensureValidStructure(data, context) {
  // Ensure duration
  if (!data.durationWeeks || data.durationWeeks < 4) {
    data.durationWeeks = 8;
  }

  // Ensure periodization
  if (!data.periodization) {
    data.periodization = {
      model: 'linear',
      phases: [
        { name: "accumulation", startWeek: 1, endWeek: 4 },
        { name: "intensity", startWeek: 5, endWeek: 7 },
        { name: "deload", startWeek: 8, endWeek: 8 }
      ]
    };
  }

  // Normalize phases (Fix AI schema mismatches)
  if (data.periodization.phases && Array.isArray(data.periodization.phases)) {
    data.periodization.phases = data.periodization.phases.map(p => {
      // Fix weeks array -> start/end
      if (p.weeks && Array.isArray(p.weeks) && p.weeks.length > 0) {
        p.startWeek = Math.min(...p.weeks);
        p.endWeek = Math.max(...p.weeks);
      }
      
      // Ensure required fields
      if (!p.startWeek) p.startWeek = 1;
      if (!p.endWeek) p.endWeek = 1;

      // Fix intensityRange (must be [min, max] numbers)
      if (!p.intensityRange || !Array.isArray(p.intensityRange) || p.intensityRange.length !== 2) {
        p.intensityRange = [70, 80]; // Default safe range
      }

      return p;
    });
  }

  // Ensure nutrition plan
  if (!data.nutritionPlan || !data.nutritionPlan.mealPlan) {
    data.nutritionPlan = {
      calorieTarget: context.tdee,
      macros: { protein: context.protein, carbs: context.carbs, fat: context.fat },
      mealPlan: {
        breakfast: { name: "Breakfast", foods: ["Eggs", "Toast"], calories: Math.round(context.tdee * 0.2) },
        snack1: { name: "Snack", foods: ["Yogurt"], calories: Math.round(context.tdee * 0.12) },
        lunch: { name: "Lunch", foods: ["Chicken", "Rice"], calories: Math.round(context.tdee * 0.25) },
        snack2: { name: "Snack", foods: ["Protein Bar"], calories: Math.round(context.tdee * 0.13) },
        dinner: { name: "Dinner", foods: ["Fish", "Vegetables"], calories: Math.round(context.tdee * 0.3) }
      }
    };
  }

  // Ensure habit plan
  if (!data.habitPlan || !Array.isArray(data.habitPlan)) {
    data.habitPlan = [
      { name: "Drink Water", frequency: "daily", trackingType: "boolean" },
      { name: "Get 8 Hours Sleep", frequency: "daily", trackingType: "quantity", targetValue: 8 }
    ];
  }

  // Ensure weekly templates
  if (!data.weeklyTemplates || data.weeklyTemplates.length === 0) {
    data.weeklyTemplates = buildWorkoutTemplates(context);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════
// SAVE & PROPAGATE TO CALENDAR
// ═══════════════════════════════════════════════════════════

async function saveAndPropagate(user, data, source, aiGenerated) {
  // A. Create Program document
  const program = new Program({
    userId: user._id,
    name: data.name || 'FORGE Program',
    goal: user.primaryGoal?.type || 'general-health',
    status: 'active',
    startDate: new Date(),
    durationWeeks: data.durationWeeks,
    currentWeek: 1,
    periodization: data.periodization,
    weeklyTemplates: data.weeklyTemplates,
    nutritionPlan: data.nutritionPlan,
    aiGenerated,
    aiRationale: `Generated via ${source || 'system'}${aiGenerated ? '' : ' (fallback template)'}`
  });

  const savedProgram = await program.save();
  console.log(`[ProgramFactory] Program ${savedProgram._id} saved.`);

  // B. Update AI Coach reference
  const aiCoach = await AICoach.getOrCreateForUser(user._id);
  aiCoach.currentProgramId = savedProgram._id;
  await aiCoach.save();

  // C. Generate workout calendar events
  let workoutEvents = [];
  try {
    workoutEvents = await savedProgram.generateCalendarEvents();
  } catch (err) {
    console.warn('[ProgramFactory] Workout event generation failed:', err.message);
    workoutEvents = await manualGenerateWorkoutEvents(user._id, savedProgram);
  }

  // D. Generate meal calendar events
  const mealEvents = await generateMealEvents(user._id, savedProgram, data.nutritionPlan?.mealPlan);

  // E. Update nutrition targets
  await updateNutritionTargets(user._id, data.nutritionPlan);

  // F. Generate habits
  const habits = await generateHabits(user._id, data.habitPlan);

  return {
    program: savedProgram,
    stats: {
      workouts: workoutEvents.length,
      meals: mealEvents.length,
      habits: habits.length
    }
  };
}

async function manualGenerateWorkoutEvents(userId, program) {
  const events = [];
  const startDate = new Date(program.startDate);

  for (const week of program.weeklyTemplates) {
    for (const day of week.trainingDays || []) {
      const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        .indexOf(day.dayOfWeek?.toLowerCase());
      if (dayIndex === -1) continue;

      const eventDate = new Date(startDate);
      eventDate.setDate(eventDate.getDate() + ((week.weekNumber - 1) * 7) + dayIndex);

      events.push({
        userId,
        type: 'workout',
        title: day.focus || day.dayOfWeek || `Week ${week.weekNumber} Workout`,
        date: eventDate,
        startTime: '09:00',
        exercises: day.exercises || [],
        programId: program._id,
        weekNumber: week.weekNumber,
        periodizationPhase: week.deloadWeek ? 'deload' : (week.weekNumber <= 4 ? 'accumulation' : 'intensity'),
        aiGenerated: true,
        status: 'scheduled'
      });
    }
  }

  if (events.length > 0) {
    return await CalendarEvent.insertMany(events);
  }
  return [];
}

async function generateMealEvents(userId, program, mealPlan) {
  if (!mealPlan) return [];

  const events = [];
  const mealTypes = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
  const mealTimes = {
    breakfast: '08:00', snack1: '10:30', lunch: '12:30', snack2: '15:30', dinner: '18:30'
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let week = 0; week < program.durationWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      const eventDate = new Date(program.startDate);
      eventDate.setDate(eventDate.getDate() + (week * 7) + day);

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
  if (!nutritionPlan) return;

  try {
    const nutrition = await Nutrition.getOrCreateForUser(userId);
    nutrition.targets = {
      calories: nutritionPlan.calorieTarget || 2000,
      protein: nutritionPlan.macros?.protein || 150,
      carbs: nutritionPlan.macros?.carbs || 200,
      fat: nutritionPlan.macros?.fat || 70,
      calculatedAt: new Date()
    };
    await nutrition.save();
  } catch (err) {
    console.warn('[ProgramFactory] Nutrition update failed:', err.message);
  }
}

async function generateHabits(userId, habitPlan) {
  if (!habitPlan || !Array.isArray(habitPlan)) return [];

  const Habit = require('../models/Habit');
  const created = [];

  const VALID_FREQUENCIES = ['daily', 'weekdays', 'weekends', 'specific-days', 'x-per-week'];
  const VALID_TRACKING = ['boolean', 'quantity', 'duration', 'rating'];

  for (const h of habitPlan) {
    try {
      // Check if exists
      const exists = await Habit.findOne({ userId, name: h.name, isActive: true });
      if (exists) continue;

      // Sanitize
      let frequency = (h.frequency || 'daily').toLowerCase();
      let trackingType = (h.trackingType || 'boolean').toLowerCase();

      if (frequency === 'weekly') frequency = 'x-per-week';
      if (!VALID_FREQUENCIES.includes(frequency)) frequency = 'daily';
      if (!VALID_TRACKING.includes(trackingType)) trackingType = 'boolean';

      const newHabit = await Habit.create({
        userId,
        name: h.name,
        description: h.description || '',
        category: h.category || 'custom',
        frequency,
        timesPerWeek: h.timesPerWeek || 7,
        trackingType,
        targetValue: h.targetValue || 1,
        unit: h.unit || '',
        icon: 'check-circle',
        color: '#f97316'
      });
      created.push(newHabit);
    } catch (err) {
      console.warn(`[ProgramFactory] Habit "${h.name}" failed:`, err.message);
    }
  }

  return created;
}
