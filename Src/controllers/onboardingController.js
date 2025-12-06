const Anthropic = require('@anthropic-ai/sdk');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const Goal = require('../models/Goal');

// Initialize Anthropic (Claude) - primary AI provider
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022';

// Step field mappings
const STEP_FIELDS = {
  1: 'profile',
  2: 'experience',
  3: 'primaryGoal',
  4: 'schedule',
  5: 'equipment',
  6: 'limitations',
  7: 'wearables'
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
        name: 'Training Schedule',
        description: 'When can you train?',
        field: 'schedule',
        completed: !!(user.schedule?.daysPerWeek && user.schedule?.preferredDays?.length > 0)
      },
      {
        step: 5,
        name: 'Equipment Access',
        description: 'What equipment do you have?',
        field: 'equipment',
        completed: !!(user.equipment?.trainingLocation)
      },
      {
        step: 6,
        name: 'Injuries & Limitations',
        description: 'Any restrictions we should know?',
        field: 'limitations',
        completed: user.onboarding?.skippedSteps?.includes(6) || user.limitations?.injuries !== undefined
      },
      {
        step: 7,
        name: 'Connect Wearables',
        description: 'Sync your fitness devices (optional)',
        field: 'wearables',
        completed: user.onboarding?.skippedSteps?.includes(7) || user.wearableConnections?.some(w => w.connected)
      }
    ];

    const completedSteps = steps.filter(s => s.completed).length;
    const progress = Math.round((completedSteps / steps.length) * 100);

    res.json({
      success: true,
      data: {
        steps,
        currentStep: user.onboarding?.currentStep || 1,
        completedSteps,
        totalSteps: steps.length,
        progress,
        isComplete: user.onboarding?.completed || false,
        completedAt: user.onboarding?.completedAt
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
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('No AI API key - generating fallback program');
    return generateFallbackProgram(user);
  }

  try {
    const prompt = buildInitialProgramPrompt(user);
    console.log('🤖 Generating initial training program with Claude...');

    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    const aiText = message.content[0].text;

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
 * Build AI prompt for initial program
 */
function buildInitialProgramPrompt(user) {
  const profile = user.profile || {};
  const experience = user.experience || {};
  const primaryGoal = user.primaryGoal || {};
  const schedule = user.schedule || {};
  const equipment = user.equipment || {};
  const limitations = user.limitations || {};

  return `Generate a ${schedule.daysPerWeek || 4}-day training program for a new athlete.

═══════════════════════════════════════════════════════════
ATHLETE PROFILE:
═══════════════════════════════════════════════════════════
- Experience: ${experience.level || 'beginner'} (${experience.yearsTraining || 0} years)
- Discipline: ${experience.primaryDiscipline || 'general-fitness'}
- Current Program: ${experience.currentProgramName || 'None'}

GOAL:
- Type: ${primaryGoal.type || 'general-health'}
${primaryGoal.targetWeight ? `- Target Weight: ${primaryGoal.targetWeight}` : ''}
${primaryGoal.targetBodyFat ? `- Target Body Fat: ${primaryGoal.targetBodyFat}%` : ''}
${primaryGoal.competition?.date ? `- Competition: ${primaryGoal.competition.type} on ${primaryGoal.competition.date}` : ''}
${primaryGoal.strengthTargets?.squat?.target ? `- Squat Target: ${primaryGoal.strengthTargets.squat.target}` : ''}
${primaryGoal.strengthTargets?.bench?.target ? `- Bench Target: ${primaryGoal.strengthTargets.bench.target}` : ''}
${primaryGoal.strengthTargets?.deadlift?.target ? `- Deadlift Target: ${primaryGoal.strengthTargets.deadlift.target}` : ''}

SCHEDULE:
- Days per week: ${schedule.daysPerWeek || 4}
- Preferred days: ${schedule.preferredDays?.join(', ') || 'Monday, Tuesday, Thursday, Friday'}
- Session length: ${schedule.sessionDuration || 60} minutes

EQUIPMENT:
- Location: ${equipment.trainingLocation || 'commercial-gym'}
- Available: ${equipment.availableEquipment?.join(', ') || 'full gym access'}
${equipment.limitations ? `- Limitations: ${equipment.limitations}` : ''}

${limitations.injuries?.length ? `
INJURIES/LIMITATIONS:
${limitations.injuries.map(i => `- ${i.bodyPart}: ${i.description}`).join('\n')}
` : ''}
${limitations.exercisesToAvoid?.length ? `Avoid: ${limitations.exercisesToAvoid.join(', ')}` : ''}

═══════════════════════════════════════════════════════════
GENERATE A 4-WEEK PERIODIZED PROGRAM
═══════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown explanation):
{
  "programName": "string",
  "description": "string - overview of the program",
  "duration": 4,
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "string - week theme",
      "days": [
        {
          "dayOfWeek": "monday",
          "workoutName": "string",
          "type": "workout",
          "exercises": [
            {
              "name": "string",
              "sets": 4,
              "reps": "8-10",
              "rpe": 7,
              "notes": "form cues"
            }
          ]
        }
      ]
    }
  ],
  "progressionScheme": "string - how to progress week to week",
  "deloadWeek": 4
}`;
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
