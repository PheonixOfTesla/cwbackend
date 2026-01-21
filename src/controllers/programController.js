// programController.js - FORGE Program Management
const Program = require('../models/Program');
const CalendarEvent = require('../models/CalendarEvent');
const User = require('../models/User');
const AICoach = require('../models/AICoach');
const Nutrition = require('../models/Nutrition');
const aiService = require('../services/aiService');

// ============================================
// GENERATE PROGRAM (Main FORGE Analysis)
// ============================================
exports.generateProgram = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    const aiCoach = await AICoach.getOrCreateForUser(userId);

    if (!user.hasActiveSubscription()) {
      const trialHours = user.getTrialRemainingHours();
      return res.status(403).json({
        success: false,
        message: 'Subscription required',
        trialRemaining: trialHours
      });
    }

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
YOUR TASK: Generate a structured program in JSON format
═══════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no explanations). Use this exact structure:

{
  "name": "Descriptive program name (e.g., '8-Week Powerlifting Peak', 'Competition Prep Block')",
  "durationWeeks": 4-12,
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
    }
  },
  "weeklyTemplates": [
    {
      "weekNumber": 1,
      "trainingDays": [
        {
          "dayOfWeek": "monday|tuesday|wednesday|thursday|friday|saturday|sunday",
          "title": "Day title (e.g., 'Heavy Squat Day')",
          "focus": "squat|bench|deadlift|upper|lower|accessories",
          "duration": 60,
          "exercises": [
            {
              "name": "Exercise Name",
              "category": "main-lift|accessory|warmup|cooldown",
              "sets": 3,
              "reps": "3-5",
              "rest": "3-5 min",
              "rpe": 7,
              "percentageOfMax": 80,
              "notes": "Optional notes"
            }
          ]
        }
      ],
      "restDays": ["wednesday", "sunday"],
      "deloadWeek": false
    }
  ]
}

CRITICAL RULES:
1. If ${competitionData.isCompeting ? 'ELITE COMPETITOR - Calculate weeks to competition and use appropriate periodization (peak/intensity/strength/accumulation phases)' : 'USER IS NOT COMPETING - Use general periodization'}
2. NEVER include exercises from the HATED list
3. ALWAYS include exercises from the FAVORITE list when possible
4. Match session duration to ${scheduleData.sessionDuration || 60} minutes
5. Respect equipment constraints - only suggest available equipment
6. If cutting (lose-fat goal), add cardio and adjust volume/intensity
7. If competing, build in deload weeks every 4-5 weeks
8. Generate ${scheduleData.daysPerWeek || 4} training days per week across ${Math.ceil((scheduleData.daysPerWeek || 4) / 7 * 14) || 2} weeks minimum
9. Every exercise must have name, sets, reps, and rest values`;

    // ═══════════════════════════════════════════════════════════
    // CALL FORGE TO GENERATE PROGRAM
    // ═══════════════════════════════════════════════════════════
    console.log('[FORGE] Generating program for user:', userId);

    const aiResponse = await aiService.generateAIContent(prompt, 'You are FORGE, the AI training coach');

    // Parse JSON response
    let programData;
    try {
      // Extract JSON from response (handle cases where AI wraps in markdown)
      const jsonMatch = aiResponse.text.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse.text;
      programData = JSON.parse(jsonString);
    } catch (parseErr) {
      console.error('[FORGE] Failed to parse program JSON:', parseErr);
      return res.status(400).json({
        success: false,
        message: 'Failed to generate valid program structure',
        error: 'Program generation produced invalid JSON'
      });
    }

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
    }

    // ═══════════════════════════════════════════════════════════
    // RETURN PROGRAM DETAILS
    // ═══════════════════════════════════════════════════════════
    res.json({
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
          weeksPlanned: savedProgram.weeklyTemplates.length,
          trainingDaysPerWeek: savedProgram.weeklyTemplates[0]?.trainingDays?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('[FORGE] Program generation error:', error);
    res.status(500).json({
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

module.exports = exports;
