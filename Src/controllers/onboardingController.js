const OpenAI = require('openai');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const Goal = require('../models/Goal');

// Initialize OpenRouter with Kimi K2 - 100% FREE
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
const AI_MODEL = 'moonshot/moonshot-v1-128k'; // Kimi K2 - FREE

// Step field mappings - GOD TIER personalization
const STEP_FIELDS = {
  1: 'profile',
  2: 'experience',
  3: 'primaryGoal',
  4: 'competitionPrep',    // NEW - Competition details (if competing)
  5: 'bodyComposition',    // NEW - Weight goals, body comp targets
  6: 'schedule',
  7: 'equipment',
  8: 'exercisePreferences', // NEW - Favorite/hated exercises, cardio prefs
  9: 'dietaryPreferences',  // NEW - Diet type, allergies, cuisine prefs
  10: 'lifestyle',          // NEW - Job type, stress, sleep, hobbies
  11: 'limitations',
  12: 'wearables'
};

/**
 * Get onboarding status
 * GET /api/onboarding/status
 */
exports.getStatus = async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is competing to determine if competition step is needed
    const isCompeting = user.primaryGoal?.type === 'competition-prep' || user.competitionPrep?.isCompeting;

    const steps = [
      {
        step: 1,
        name: 'Profile Setup',
        description: 'Basic information about you',
        field: 'profile',
        completed: !!(user.profile?.gender && user.profile?.height)
      },
      {
        step: 2,
        name: 'Training Experience',
        description: 'Your fitness background',
        field: 'experience',
        completed: !!(user.experience?.level && user.experience?.primaryDiscipline)
      },
      {
        step: 3,
        name: 'Set Your Goal',
        description: 'What do you want to achieve?',
        field: 'primaryGoal',
        completed: !!(user.primaryGoal?.type)
      },
      {
        step: 4,
        name: 'Competition Details',
        description: 'Tell us about your upcoming meet',
        field: 'competitionPrep',
        completed: !isCompeting || !!(user.competitionPrep?.meetDate),
        conditional: true,
        showIf: isCompeting
      },
      {
        step: 5,
        name: 'Body Composition',
        description: 'Your weight and physique goals',
        field: 'bodyComposition',
        completed: !!(user.bodyComposition?.goal) || user.onboarding?.skippedSteps?.includes(5)
      },
      {
        step: 6,
        name: 'Training Schedule',
        description: 'When can you train?',
        field: 'schedule',
        completed: !!(user.schedule?.daysPerWeek && user.schedule?.preferredDays?.length > 0)
      },
      {
        step: 7,
        name: 'Equipment Access',
        description: 'What equipment do you have?',
        field: 'equipment',
        completed: !!(user.equipment?.trainingLocation)
      },
      {
        step: 8,
        name: 'Exercise Preferences',
        description: 'What exercises do you love or hate?',
        field: 'exercisePreferences',
        completed: user.onboarding?.skippedSteps?.includes(8) || !!(user.exercisePreferences?.preferredSplit)
      },
      {
        step: 9,
        name: 'Dietary Preferences',
        description: 'Your nutrition style and restrictions',
        field: 'dietaryPreferences',
        completed: user.onboarding?.skippedSteps?.includes(9) || !!(user.dietaryPreferences?.dietType)
      },
      {
        step: 10,
        name: 'Lifestyle Factors',
        description: 'Your work, stress, and sleep patterns',
        field: 'lifestyle',
        completed: user.onboarding?.skippedSteps?.includes(10) || !!(user.lifestyle?.jobType)
      },
      {
        step: 11,
        name: 'Injuries & Limitations',
        description: 'Any restrictions we should know?',
        field: 'limitations',
        completed: user.onboarding?.skippedSteps?.includes(11) || user.limitations?.injuries !== undefined
      },
      {
        step: 12,
        name: 'Connect Wearables',
        description: 'Sync your fitness devices (optional)',
        field: 'wearables',
        completed: user.onboarding?.skippedSteps?.includes(12) || user.wearableConnections?.some(w => w.connected)
      }
    ];

    // Filter out conditional steps that shouldn't show
    const visibleSteps = steps.filter(s => !s.conditional || s.showIf);

    const completedSteps = visibleSteps.filter(s => s.completed).length;
    const progress = Math.round((completedSteps / visibleSteps.length) * 100);

    res.json({
      success: true,
      data: {
        steps: visibleSteps,
        currentStep: user.onboarding?.currentStep || 1,
        completedSteps,
        totalSteps: visibleSteps.length,
        progress,
        isComplete: user.onboarding?.completed || false,
        completedAt: user.onboarding?.completedAt,
        isCompeting
      }
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get current step data
 * GET /api/onboarding/step/:step
 */
exports.getStep = async (req, res) => {
  try {
    const { step } = req.params;
    const userId = req.query.userId || req.user.id;
    const stepNum = parseInt(step);

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const field = STEP_FIELDS[stepNum];
    if (!field) {
      return res.status(400).json({
        success: false,
        message: 'Invalid step number'
      });
    }

    res.json({
      success: true,
      data: {
        step: stepNum,
        field,
        currentData: user[field] || {},
        isSkipped: user.onboarding?.skippedSteps?.includes(stepNum) || false
      }
    });
  } catch (error) {
    console.error('Get step error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Save step data
 * POST /api/onboarding/step/:step
 */
exports.saveStep = async (req, res) => {
  try {
    const { step } = req.params;
    const userId = req.body.userId || req.user.id;
    const stepNum = parseInt(step);

    const field = STEP_FIELDS[stepNum];
    if (!field) {
      return res.status(400).json({
        success: false,
        message: 'Invalid step number'
      });
    }

    const updateData = {
      [field]: req.body.data || req.body,
      'onboarding.currentStep': Math.max(stepNum + 1, 1)
    };

    // Remove nested data key if present
    if (updateData[field].data) {
      updateData[field] = updateData[field].data;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        step: stepNum,
        nextStep: stepNum + 1,
        savedData: user[field]
      },
      message: `Step ${stepNum} saved successfully`
    });
  } catch (error) {
    console.error('Save step error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Skip a step
 * POST /api/onboarding/skip/:step
 */
exports.skipStep = async (req, res) => {
  try {
    const { step } = req.params;
    const userId = req.body.userId || req.user.id;
    const stepNum = parseInt(step);

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: { 'onboarding.skippedSteps': stepNum },
        $set: { 'onboarding.currentStep': stepNum + 1 }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        step: stepNum,
        nextStep: stepNum + 1,
        skippedSteps: user.onboarding?.skippedSteps
      },
      message: `Step ${stepNum} skipped`
    });
  } catch (error) {
    console.error('Skip step error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Complete onboarding and generate initial program
 * POST /api/onboarding/complete
 */
exports.completeOnboarding = async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;

    // Update user's onboarding status
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'onboarding.completed': true,
          'onboarding.completedAt': new Date()
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Set elite mode based on experience level
    if (user.experience?.level === 'advanced' || user.experience?.level === 'elite') {
      user.eliteMode = {
        enabled: true,
        showRPE: true,
        showPercentages: true,
        showVolumeMetrics: true,
        showFatigueRatios: user.experience.level === 'elite',
        competitionMode: user.primaryGoal?.type === 'competition-prep'
      };
      await user.save();
    }

    // Generate initial training program with AI
    let program = null;
    let calendarEvents = [];

    try {
      program = await generateInitialProgram(user);
      if (program) {
        calendarEvents = await createCalendarFromProgram(userId, program);
      }
    } catch (programError) {
      console.error('Program generation error:', programError);
      // Continue without program - user can generate later
    }

    // Create initial goal from primaryGoal
    let createdGoal = null;
    if (user.primaryGoal?.type) {
      try {
        const goalData = buildGoalFromOnboarding(user);
        createdGoal = await Goal.create({
          ...goalData,
          clientId: userId,
          createdBy: userId
        });
      } catch (goalError) {
        console.error('Goal creation error:', goalError);
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          experience: user.experience,
          primaryGoal: user.primaryGoal,
          schedule: user.schedule,
          eliteMode: user.eliteMode,
          onboarding: user.onboarding
        },
        program,
        calendarEvents,
        goal: createdGoal
      },
      message: 'Onboarding complete! Your training program is ready.'
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Generate initial program with AI
 * POST /api/onboarding/generate-program
 */
exports.generateProgram = async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const program = await generateInitialProgram(user);

    if (!program) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate program'
      });
    }

    // Create calendar events from program
    const calendarEvents = await createCalendarFromProgram(userId, program);

    res.json({
      success: true,
      data: {
        program,
        calendarEvents
      },
      message: `Generated ${program.programName} with ${calendarEvents.length} training days`
    });
  } catch (error) {
    console.error('Generate program error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Generate initial program using AI
 */
async function generateInitialProgram(user) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('No AI API key - generating fallback program');
    return generateFallbackProgram(user);
  }

  try {
    const prompt = buildInitialProgramPrompt(user);
    console.log('🤖 Generating initial training program with Kimi K2 (FREE)...');

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    const aiText = completion.choices[0].message.content;

    // Parse JSON from response
    const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                      aiText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
    const program = JSON.parse(jsonStr.trim());

    console.log(`✅ Generated program: ${program.programName}`);
    return program;
  } catch (error) {
    console.error('AI program generation error:', error);
    return generateFallbackProgram(user);
  }
}

/**
 * Build AI prompt for initial program - GOD TIER PERSONALIZATION
 * Sport-specific, periodized, recovery-aware
 */
function buildInitialProgramPrompt(user) {
  const profile = user.profile || {};
  const experience = user.experience || {};
  const primaryGoal = user.primaryGoal || {};
  const schedule = user.schedule || {};
  const equipment = user.equipment || {};
  const limitations = user.limitations || {};
  const exercisePrefs = user.exercisePreferences || {};
  const bodyComp = user.bodyComposition || {};
  const lifestyle = user.lifestyle || {};
  const competition = user.competitionPrep || {};
  const dietary = user.dietaryPreferences || {};

  // Calculate key metrics
  const isPowerlifter = experience.primaryDiscipline === 'powerlifting';
  const isBodybuilder = experience.primaryDiscipline === 'bodybuilding';
  const isCompeting = competition.isCompeting;
  const currentWeight = profile.currentWeight || bodyComp.currentWeight || 0;
  const targetWeight = bodyComp.targetWeight || 0;
  const needsWeightLoss = targetWeight > 0 && currentWeight > targetWeight;
  const weightToLose = needsWeightLoss ? currentWeight - targetWeight : 0;

  // Calculate weeks to competition
  let weeksOut = null;
  if (isCompeting && competition.meetDate) {
    const meetDate = new Date(competition.meetDate);
    const now = new Date();
    weeksOut = Math.ceil((meetDate - now) / (7 * 24 * 60 * 60 * 1000));
  }

  // Determine periodization phase based on weeks out
  let periodizationPhase = 'accumulation';
  let volumeLevel = 'high';
  let intensityRange = '65-75%';

  if (weeksOut !== null) {
    if (weeksOut <= 2) {
      periodizationPhase = 'peak-week';
      volumeLevel = 'minimal';
      intensityRange = '95-105%';
    } else if (weeksOut <= 4) {
      periodizationPhase = 'peaking';
      volumeLevel = 'low';
      intensityRange = '90-100%';
    } else if (weeksOut <= 8) {
      periodizationPhase = 'intensity';
      volumeLevel = 'moderate';
      intensityRange = '82-92%';
    } else if (weeksOut <= 12) {
      periodizationPhase = 'strength';
      volumeLevel = 'moderate-high';
      intensityRange = '75-85%';
    }
  }

  // Get current totals for powerlifters
  const currentSquat = primaryGoal.strengthTargets?.squat?.current || 0;
  const currentBench = primaryGoal.strengthTargets?.bench?.current || 0;
  const currentDeadlift = primaryGoal.strengthTargets?.deadlift?.current || 0;
  const currentTotal = currentSquat + currentBench + currentDeadlift;

  return `You are FORGE, an elite AI coach creating the PERFECT personalized training program.

═══════════════════════════════════════════════════════════
FORGE AI - GOD TIER PROGRAM GENERATION
═══════════════════════════════════════════════════════════

ATHLETE PROFILE:
- Name: ${user.name || 'Athlete'}
- Experience: ${experience.level || 'intermediate'} (${experience.yearsTraining || 1} years training)
- Primary Discipline: ${experience.primaryDiscipline || 'general-fitness'}
- Current Program: ${experience.currentProgramName || 'None'}
- Training Style Preference: ${exercisePrefs.trainingStyle || 'balanced'}

${isCompeting ? `
═══════════════════════════════════════════════════════════
⚠️ COMPETITION PREP - CRITICAL CONTEXT ⚠️
═══════════════════════════════════════════════════════════
- Sport: ${competition.sport || 'powerlifting'}
- Federation: ${competition.federation || 'Not specified'}
- Meet Name: ${competition.meetName || 'Upcoming meet'}
- Meet Date: ${competition.meetDate ? new Date(competition.meetDate).toDateString() : 'TBD'}
- WEEKS OUT: ${weeksOut !== null ? weeksOut : 'Unknown'} weeks
- Current Weight Class: ${competition.currentWeightClass || 'Open'}
- Target Weight Class: ${competition.targetWeightClass || competition.currentWeightClass || 'Open'}
- Weigh-in Type: ${competition.weighInType || '24-hour'}
- Attempt Selection Style: ${competition.attemptSelectionPreference || 'moderate'}
${competition.equipped ? '- EQUIPPED DIVISION (Gear: squat suit, bench shirt, knee wraps)' : '- RAW DIVISION'}

CURRENT PERIODIZATION PHASE: ${periodizationPhase.toUpperCase()}
VOLUME LEVEL: ${volumeLevel}
INTENSITY RANGE: ${intensityRange}
` : ''}

BODY COMPOSITION:
- Current Weight: ${currentWeight} lbs
- Target Weight: ${targetWeight || 'Not set'} lbs
${needsWeightLoss ? `
⚠️ WEIGHT CUT REQUIRED: ${weightToLose} lbs to lose
- Goal: ${bodyComp.goal || 'moderate-cut'}
- Weekly Target: ${bodyComp.weeklyWeightChangeTarget || 1} lbs/week
- Strategy: ${bodyComp.weightCutStrategy || 'gradual'}
- Deadline: ${bodyComp.deadline ? new Date(bodyComp.deadline).toDateString() : 'None set'}
` : ''}
- Current Body Fat: ${bodyComp.currentBodyFat || 'Unknown'}%
- Target Body Fat: ${bodyComp.targetBodyFat || 'Not set'}%

CURRENT STRENGTH LEVELS${isPowerlifter ? ' (Powerlifting)' : ''}:
- Squat: ${currentSquat || 'N/A'} lbs ${primaryGoal.strengthTargets?.squat?.target ? `→ Target: ${primaryGoal.strengthTargets.squat.target} lbs` : ''}
- Bench: ${currentBench || 'N/A'} lbs ${primaryGoal.strengthTargets?.bench?.target ? `→ Target: ${primaryGoal.strengthTargets.bench.target} lbs` : ''}
- Deadlift: ${currentDeadlift || 'N/A'} lbs ${primaryGoal.strengthTargets?.deadlift?.target ? `→ Target: ${primaryGoal.strengthTargets.deadlift.target} lbs` : ''}
- Current Total: ${currentTotal || 'N/A'} lbs ${primaryGoal.strengthTargets?.total?.target ? `→ Target: ${primaryGoal.strengthTargets.total.target} lbs` : ''}
${competition.qualifyingTotal ? `- Qualifying Total Needed: ${competition.qualifyingTotal} lbs` : ''}

SCHEDULE:
- Days per week: ${schedule.daysPerWeek || 4}
- Preferred days: ${schedule.preferredDays?.join(', ') || 'Monday, Tuesday, Thursday, Friday'}
- Session length: ${schedule.sessionDuration || 75} minutes
- Preferred time: ${schedule.preferredTime || 'flexible'}

EQUIPMENT ACCESS:
- Location: ${equipment.trainingLocation || 'commercial-gym'}
- Available: ${equipment.availableEquipment?.join(', ') || 'Full gym access'}
${equipment.limitations ? `- Limitations: ${equipment.limitations}` : ''}

EXERCISE PREFERENCES:
- Favorite exercises: ${exercisePrefs.favoriteExercises?.join(', ') || 'None specified'}
- AVOID these exercises: ${[...(exercisePrefs.hatedExercises || []), ...(limitations.exercisesToAvoid || [])].join(', ') || 'None'}
- Cardio preference: ${exercisePrefs.cardioPreference || 'mixed'}
- Preferred cardio activities: ${exercisePrefs.cardioActivities?.join(', ') || 'walking, cycling'}
- Mobility focus areas: ${exercisePrefs.mobilityFocus?.join(', ') || 'general'}
- Preferred split: ${exercisePrefs.preferredSplit || 'ai-decides'}

LIFESTYLE FACTORS:
- Job type: ${lifestyle.jobType || 'sedentary'} (affects NEAT/recovery)
- Stress level: ${lifestyle.stressLevel || 'moderate'}
- Sleep: ${lifestyle.sleepHours || 7} hours/night (${lifestyle.sleepQuality || 'fair'} quality)
- Work schedule: ${lifestyle.workSchedule || '9-5'}
- Other activities: ${lifestyle.hobbies?.join(', ') || 'None specified'}

${limitations.injuries?.length ? `
INJURIES/LIMITATIONS (RESPECT THESE):
${limitations.injuries.map(i => `- ${i.bodyPart}: ${i.description} (${i.severity || 'moderate'})`).join('\n')}
` : ''}

═══════════════════════════════════════════════════════════
PROGRAM REQUIREMENTS - MUST FOLLOW
═══════════════════════════════════════════════════════════

${isPowerlifter ? `
FOR POWERLIFTING - MANDATORY STRUCTURE:
1. Each workout MUST have 5-8 exercises minimum:
   - Main competition lift OR close variation
   - Secondary movement (paused, tempo, deficit, close-grip, etc.)
   - 2-3 accessories targeting weak points
   - 1-2 prehab/mobility movements
   - Optional: ${needsWeightLoss ? 'CARDIO (required for weight cut)' : 'Cardio if time permits'}

2. PERIODIZATION (Based on ${weeksOut !== null ? `${weeksOut} weeks out` : 'general prep'}):
${weeksOut !== null && weeksOut <= 4 ? `   - PEAKING PHASE: Competition lifts only, low volume, high intensity
   - Focus on singles at competition commands
   - Reduce accessories, prioritize recovery` :
weeksOut !== null && weeksOut <= 8 ? `   - INTENSITY PHASE: Building to heavy singles/doubles
   - Moderate volume, increasing intensity
   - Practice opener attempts` :
weeksOut !== null && weeksOut <= 12 ? `   - STRENGTH PHASE: 3-5 rep range focus
   - Build intensity while managing fatigue
   - Maintain accessories but reduce volume` :
`   - ACCUMULATION PHASE: Higher volume, moderate intensity
   - Build work capacity and muscle
   - Address weak points with accessories`}

3. VOLUME GUIDELINES:
   - Main lifts: ${weeksOut && weeksOut <= 4 ? '2-3' : weeksOut && weeksOut <= 8 ? '3-4' : '4-5'} working sets
   - Variations: ${weeksOut && weeksOut <= 4 ? '2' : '3'} sets
   - Accessories: 3-4 sets each
   - Total session sets: 18-25 (${schedule.sessionDuration || 75} min session)
` : ''}

${isBodybuilder ? `
FOR BODYBUILDING - MANDATORY STRUCTURE:
1. Each workout MUST have 5-7 exercises
2. Hit each muscle group 2x per week minimum
3. Include intensity techniques (drop sets, supersets, rest-pause)
4. Focus on mind-muscle connection
5. Rep ranges: 8-15 for hypertrophy, 15-25 for pump work
` : ''}

${needsWeightLoss ? `
═══════════════════════════════════════════════════════════
⚠️ WEIGHT CUT PROTOCOL - INCLUDE CARDIO ⚠️
═══════════════════════════════════════════════════════════
User needs to lose ${weightToLose} lbs. MUST include cardio:
- Type: ${exercisePrefs.cardioPreference === 'none' ? 'LISS (walking/incline treadmill)' : exercisePrefs.cardioPreference}
- Frequency: ${weightToLose > 10 ? '4-5x/week' : '2-3x/week'}
- Duration: ${weightToLose > 10 ? '30-40 min' : '20-30 min'}
- Timing: Post-workout OR fasted AM
- Calorie target: 200-400 kcal per session
- Preferred activities: ${exercisePrefs.cardioActivities?.join(', ') || 'walking, cycling'}
` : ''}

═══════════════════════════════════════════════════════════
OUTPUT FORMAT - RETURN ONLY VALID JSON
═══════════════════════════════════════════════════════════

{
  "programName": "string - creative, personalized name",
  "description": "string - 2-3 sentences explaining the program and why it fits THIS athlete",
  "duration": 4,
  "periodizationPhase": "${periodizationPhase}",
  "weeklyVolume": {
    "totalSets": "number - total working sets per week",
    "perMuscleGroup": "object - sets per muscle group"
  },
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "string - specific focus for this week",
      "intensityRange": "${intensityRange}",
      "volumeLevel": "${volumeLevel}",
      "notes": "string - coaching notes for the week",
      "days": [
        {
          "dayOfWeek": "monday",
          "workoutName": "string - descriptive name",
          "type": "strength|hypertrophy|cardio|recovery",
          "estimatedDuration": 75,
          "warmup": "string - brief warmup protocol",
          "exercises": [
            {
              "name": "string - exact exercise name",
              "category": "main-lift|variation|accessory|prehab|cardio",
              "sets": 4,
              "reps": "5" or "8-10",
              "rpe": 7,
              "percentageOf1RM": 75,
              "rest": "3-4 min",
              "tempo": "controlled" or "explosive" or "3-1-2-0",
              "notes": "string - form cues, focus points",
              "targetMuscles": ["array", "of", "muscles"],
              "supersetWith": "string - exercise name if superset" or null
            }
          ],
          "cooldown": "string - mobility/stretching focus"
        }
      ]
    }
  ],
  ${needsWeightLoss ? `"cardioRecommendations": {
    "frequency": "3-4x per week",
    "type": "${exercisePrefs.cardioPreference || 'LISS'}",
    "activities": ["${(exercisePrefs.cardioActivities || ['walking', 'incline treadmill']).join('", "')}"],
    "duration": "25-35 minutes",
    "timing": "post-workout or separate sessions",
    "weeklyCalorieTarget": 800-1200,
    "heartRateZone": "Zone 2 (60-70% max HR)"
  },` : ''}
  "progressionScheme": "string - detailed progression protocol week to week",
  "deloadProtocol": "string - when and how to deload",
  "autoregulationNotes": "string - how to adjust based on recovery/fatigue",
  "nutritionNotes": "string - align with their ${bodyComp.goal || 'maintenance'} goal and ${dietary.dietType || 'flexible'} diet"
}

CRITICAL REMINDERS:
1. MINIMUM 5-6 exercises per workout for serious athletes
2. ${needsWeightLoss ? 'INCLUDE CARDIO - they need to lose weight!' : 'Cardio optional based on goals'}
3. Use their FAVORITE exercises when possible: ${exercisePrefs.favoriteExercises?.join(', ') || 'none specified'}
4. AVOID: ${[...(exercisePrefs.hatedExercises || []), ...(limitations.exercisesToAvoid || [])].join(', ') || 'nothing specific'}
5. Match the ${schedule.sessionDuration || 75}-minute session length
6. ${isCompeting ? `They are ${weeksOut} weeks out - program accordingly!` : 'General prep phase'}`;
}

/**
 * Generate fallback program without AI
 */
function generateFallbackProgram(user) {
  const discipline = user.experience?.primaryDiscipline || 'general-fitness';
  const daysPerWeek = user.schedule?.daysPerWeek || 4;
  const preferredDays = user.schedule?.preferredDays || ['monday', 'tuesday', 'thursday', 'friday'];

  const programs = {
    powerlifting: {
      programName: 'ClockWork Strength Builder',
      description: 'Focused on building strength in the main compound lifts',
      days: [
        { dayOfWeek: preferredDays[0] || 'monday', workoutName: 'Heavy Squat Day', type: 'workout' },
        { dayOfWeek: preferredDays[1] || 'tuesday', workoutName: 'Heavy Bench Day', type: 'workout' },
        { dayOfWeek: preferredDays[2] || 'thursday', workoutName: 'Heavy Deadlift Day', type: 'workout' },
        { dayOfWeek: preferredDays[3] || 'friday', workoutName: 'Accessories & Volume', type: 'workout' }
      ]
    },
    bodybuilding: {
      programName: 'ClockWork Hypertrophy',
      description: 'Push/Pull/Legs split optimized for muscle growth',
      days: [
        { dayOfWeek: preferredDays[0] || 'monday', workoutName: 'Push Day', type: 'workout' },
        { dayOfWeek: preferredDays[1] || 'tuesday', workoutName: 'Pull Day', type: 'workout' },
        { dayOfWeek: preferredDays[2] || 'thursday', workoutName: 'Legs Day', type: 'workout' },
        { dayOfWeek: preferredDays[3] || 'friday', workoutName: 'Upper Body', type: 'workout' }
      ]
    },
    'general-fitness': {
      programName: 'ClockWork Foundations',
      description: 'Balanced full-body program for overall fitness',
      days: [
        { dayOfWeek: preferredDays[0] || 'monday', workoutName: 'Full Body A', type: 'workout' },
        { dayOfWeek: preferredDays[1] || 'wednesday', workoutName: 'Cardio & Core', type: 'cardio' },
        { dayOfWeek: preferredDays[2] || 'friday', workoutName: 'Full Body B', type: 'workout' },
        { dayOfWeek: preferredDays[3] || 'sunday', workoutName: 'Active Recovery', type: 'rest-day' }
      ]
    }
  };

  const program = programs[discipline] || programs['general-fitness'];
  return {
    ...program,
    duration: 4,
    weeks: [
      { weekNumber: 1, focus: 'Foundation', days: program.days.slice(0, daysPerWeek) },
      { weekNumber: 2, focus: 'Volume', days: program.days.slice(0, daysPerWeek) },
      { weekNumber: 3, focus: 'Intensity', days: program.days.slice(0, daysPerWeek) },
      { weekNumber: 4, focus: 'Deload', days: program.days.slice(0, daysPerWeek) }
    ],
    progressionScheme: 'Linear progression with deload on week 4',
    deloadWeek: 4
  };
}

/**
 * Create calendar events from generated program
 */
async function createCalendarFromProgram(userId, program) {
  const events = [];
  const startDate = getNextMonday();

  // Create events for the first 4 weeks
  for (const week of (program.weeks || [])) {
    for (const day of (week.days || [])) {
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayIndex = daysOfWeek.indexOf(day.dayOfWeek?.toLowerCase());
      if (dayIndex === -1) continue;

      const eventDate = new Date(startDate);
      eventDate.setDate(eventDate.getDate() + ((week.weekNumber - 1) * 7) + dayIndex);

      events.push({
        userId,
        type: day.type || 'workout',
        title: day.workoutName || `Week ${week.weekNumber} - ${day.dayOfWeek}`,
        description: day.exercises ?
          day.exercises.map(e => `${e.name}: ${e.sets}x${e.reps}`).join('\n') :
          `Focus: ${week.focus}`,
        date: eventDate,
        startTime: '09:00',
        duration: 60,
        aiGenerated: true,
        aiReason: `Generated from ${program.programName}`,
        status: 'scheduled'
      });
    }
  }

  if (events.length > 0) {
    return await CalendarEvent.insertMany(events);
  }

  return [];
}

/**
 * Get next Monday for program start
 */
function getNextMonday() {
  const today = new Date();
  const day = today.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Build goal from onboarding data
 */
function buildGoalFromOnboarding(user) {
  const goalType = user.primaryGoal?.type;
  const targetDate = user.primaryGoal?.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const goalTemplates = {
    'build-strength': {
      name: 'Increase Total Strength',
      target: user.primaryGoal?.strengthTargets?.total?.target || 1000,
      current: user.primaryGoal?.strengthTargets?.total?.current || 0,
      unit: 'lbs'
    },
    'build-muscle': {
      name: 'Build Lean Muscle',
      target: user.primaryGoal?.targetWeight || (user.profile?.currentWeight || 0) + 10,
      current: user.profile?.currentWeight || 0,
      unit: 'lbs'
    },
    'lose-fat': {
      name: 'Reach Target Weight',
      target: user.primaryGoal?.targetWeight || (user.profile?.currentWeight || 0) - 20,
      current: user.profile?.currentWeight || 0,
      unit: 'lbs'
    },
    'general-health': {
      name: 'Consistent Training',
      target: 48,
      current: 0,
      unit: 'workouts'
    }
  };

  const template = goalTemplates[goalType] || goalTemplates['general-health'];

  return {
    name: template.name,
    target: template.target,
    current: template.current,
    deadline: targetDate,
    category: 'fitness',
    isHabit: false,
    notes: `Goal set during onboarding. Discipline: ${user.experience?.primaryDiscipline || 'general'}`
  };
}

module.exports = exports;
