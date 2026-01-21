const CalendarEvent = require('../models/CalendarEvent');
const CheckIn = require('../models/CheckIn');
const WearableData = require('../models/WearableData');
const User = require('../models/User');
const Workout = require('../models/Workout');
const aiService = require('../services/aiService');

// Helper function to normalize event type to valid enum values
// Placed at top so it can be used by both generateWeek and generateMonth
function normalizeEventType(type) {
  const typeMap = {
    'rest': 'rest-day',
    'rest day': 'rest-day',
    'restday': 'rest-day',
    'recovery': 'rest-day',
    'active recovery': 'rest-day',
    'active-recovery': 'rest-day',
    'off': 'rest-day',
    'off-day': 'rest-day',
    'deload': 'deload',
    'deload-day': 'deload',
    'competition': 'competition',
    'comp': 'competition',
    'meet': 'competition',
    'weigh-in': 'weigh-in',
    'weighin': 'weigh-in',
    'check-in': 'check-in',
    'checkin': 'check-in',
    'cardio': 'cardio',
    'conditioning': 'cardio',
    'workout': 'workout',
    'training': 'workout',
    'strength': 'workout',
    'hypertrophy': 'workout'
  };

  const normalized = type?.toLowerCase()?.trim();
  return typeMap[normalized] || 'workout'; // Default to workout if unknown
}

/**
 * Get calendar events for a date range
 * GET /api/calendar/:userId?start=2025-01-01&end=2025-01-31
 */
exports.getCalendar = async (req, res) => {
  try {
    const { userId } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        success: false,
        message: 'Start and end dates are required'
      });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);

    const events = await CalendarEvent.find({
      userId,
      date: { $gte: startDate, $lte: endDate }
    })
    .populate('workoutId')
    .sort('date startTime');

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get today's events
 * GET /api/calendar/:userId/today
 */
exports.getTodayEvents = async (req, res) => {
  try {
    const { userId } = req.params;
    const events = await CalendarEvent.getTodayEvents(userId);

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get today events error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get upcoming events
 * GET /api/calendar/:userId/upcoming?limit=5
 */
exports.getUpcoming = async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const events = await CalendarEvent.getUpcoming(userId, limit);

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Create a calendar event
 * POST /api/calendar
 */
exports.createEvent = async (req, res) => {
  try {
    const eventData = {
      ...req.body,
      userId: req.body.userId || req.user.id
    };

    const event = await CalendarEvent.create(eventData);

    res.status(201).json({
      success: true,
      data: event,
      message: 'Event created successfully'
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update a calendar event
 * PUT /api/calendar/:eventId
 */
exports.updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await CalendarEvent.findByIdAndUpdate(
      eventId,
      req.body,
      { new: true, runValidators: true }
    ).populate('workoutId');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: event,
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete a calendar event
 * DELETE /api/calendar/:eventId
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await CalendarEvent.findByIdAndDelete(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: event,
      message: 'Event deleted successfully'
    });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Mark event as completed
 * POST /api/calendar/:eventId/complete
 */
exports.completeEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await CalendarEvent.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await event.markComplete();

    res.json({
      success: true,
      data: event,
      message: 'Event marked as completed'
    });
  } catch (error) {
    console.error('Complete event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Skip event
 * POST /api/calendar/:eventId/skip
 */
exports.skipEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { reason } = req.body;

    const event = await CalendarEvent.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await event.skip(reason);

    res.json({
      success: true,
      data: event,
      message: 'Event skipped'
    });
  } catch (error) {
    console.error('Skip event error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Generate a training week with AI
 * POST /api/calendar/generate-week
 */
exports.generateWeek = async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const { startDate } = req.body;

    // Fetch user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fetch recent check-ins for context
    const checkIns = await CheckIn.find({ userId })
      .sort('-date')
      .limit(7);

    // Fetch latest wearable data
    const wearableData = await WearableData.findOne({ userId })
      .sort('-date');

    // Fetch recent workouts for context
    const recentWorkouts = await Workout.find({ clientId: userId })
      .sort('-scheduledDate')
      .limit(10);

    // Build AI prompt
    const prompt = buildWeeklyPlanPrompt(user, checkIns, wearableData, recentWorkouts, startDate);

    // Generate with Kimi K2 (OpenRouter)
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'AI API key not configured'
      });
    }

    console.log('🔨 FORGE generating weekly training plan with AI (multi-provider fallback)...');
    const aiResponse = await aiService.generateAIContent(prompt, null, 4096);
    const aiText = aiResponse.text;
    console.log(`✓ Plan generated from ${aiResponse.source}`);

    // Parse JSON from AI response
    let plan;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        aiText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
      plan = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse AI-generated plan',
        aiResponse: aiText
      });
    }

    // Create calendar events from plan
    const weekStart = startDate ? new Date(startDate) : new Date();
    weekStart.setHours(0, 0, 0, 0);

    // Clear existing events for the week first (optional - can be enabled)
    // await CalendarEvent.deleteMany({
    //   userId,
    //   date: { $gte: weekStart, $lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
    //   aiGenerated: true
    // });

    const events = [];
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (const day of (plan.days || plan.week || [])) {
      const dayIndex = daysOfWeek.indexOf(day.dayOfWeek?.toLowerCase());
      if (dayIndex === -1) continue;

      const eventDate = new Date(weekStart);
      const currentDayIndex = weekStart.getDay();
      const daysToAdd = (dayIndex - currentDayIndex + 7) % 7;
      eventDate.setDate(eventDate.getDate() + daysToAdd);

      // Normalize the type to valid enum values
      const normalizedType = normalizeEventType(day.type);

      const eventData = {
        userId,
        type: normalizedType,
        title: day.workoutName || day.title || `${normalizedType === 'rest-day' ? 'Rest' : 'Workout'} Day`,
        description: day.description || (day.exercises ? day.exercises.map(e => `${e.name}: ${e.sets}x${e.reps}`).join(', ') : ''),
        date: eventDate,
        startTime: day.startTime || user.schedule?.preferredTime || '09:00',
        duration: day.duration || user.schedule?.sessionDuration || 60,
        aiGenerated: true,
        aiReason: plan.description || 'AI-generated weekly plan',
        status: 'scheduled'
      };

      events.push(eventData);
    }

    // Insert all events
    const createdEvents = await CalendarEvent.insertMany(events);

    console.log(`✅ Created ${createdEvents.length} calendar events`);

    res.json({
      success: true,
      data: {
        plan,
        events: createdEvents
      },
      message: `Generated ${createdEvents.length} training days for the week`
    });

  } catch (error) {
    console.error('Generate week error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Build prompt for weekly plan generation
 */
function buildWeeklyPlanPrompt(user, checkIns, wearableData, recentWorkouts, startDate) {
  const profile = user.profile || {};
  const experience = user.experience || {};
  const primaryGoal = user.primaryGoal || {};
  const schedule = user.schedule || {};
  const equipment = user.equipment || {};
  const limitations = user.limitations || {};

  // Calculate average readiness from check-ins
  const avgReadiness = checkIns.length > 0
    ? Math.round(checkIns.reduce((sum, c) => sum + (c.readinessScore || 50), 0) / checkIns.length)
    : null;

  return `You are an elite fitness coach generating a personalized ${schedule.daysPerWeek || 4}-day training week.

═══════════════════════════════════════════════════════════
ATHLETE PROFILE:
═══════════════════════════════════════════════════════════
- Experience: ${experience.level || 'intermediate'} (${experience.yearsTraining || 'N/A'} years)
- Primary Discipline: ${experience.primaryDiscipline || 'general-fitness'}
- Current Program: ${experience.currentProgramName || 'Custom'}

GOAL:
- Type: ${primaryGoal.type || 'general-health'}
${primaryGoal.targetWeight ? `- Target Weight: ${primaryGoal.targetWeight}` : ''}
${primaryGoal.competition?.date ? `- Competition: ${primaryGoal.competition.type} on ${primaryGoal.competition.date}` : ''}
${primaryGoal.strengthTargets?.squat?.target ? `- Squat Target: ${primaryGoal.strengthTargets.squat.target}` : ''}
${primaryGoal.strengthTargets?.bench?.target ? `- Bench Target: ${primaryGoal.strengthTargets.bench.target}` : ''}
${primaryGoal.strengthTargets?.deadlift?.target ? `- Deadlift Target: ${primaryGoal.strengthTargets.deadlift.target}` : ''}

SCHEDULE:
- Days per week: ${schedule.daysPerWeek || 4}
- Preferred days: ${schedule.preferredDays?.join(', ') || 'Monday, Tuesday, Thursday, Friday'}
- Session length: ${schedule.sessionDuration || 60} minutes
- Preferred time: ${schedule.preferredTime || 'flexible'}

EQUIPMENT:
- Location: ${equipment.trainingLocation || 'commercial-gym'}
- Available: ${equipment.availableEquipment?.join(', ') || 'full gym access'}
${equipment.limitations ? `- Limitations: ${equipment.limitations}` : ''}

CURRENT STATE:
${avgReadiness ? `- Average Readiness (7 days): ${avgReadiness}/100` : '- No check-in data'}
${wearableData?.recoveryScore ? `- Latest Recovery Score: ${wearableData.recoveryScore}/100` : ''}
${wearableData?.sleepDuration ? `- Latest Sleep: ${(wearableData.sleepDuration / 60).toFixed(1)}h` : ''}

RECENT TRAINING:
${recentWorkouts.slice(0, 5).map(w => `- ${w.name}: ${w.completed ? 'Completed' : 'Scheduled'}`).join('\n') || '- No recent workouts logged'}

${limitations.injuries?.length ? `
INJURIES/LIMITATIONS:
${limitations.injuries.map(i => `- ${i.bodyPart}: ${i.description} (Avoid: ${i.avoidMovements?.join(', ') || 'None specified'})`).join('\n')}
` : ''}
${limitations.exercisesToAvoid?.length ? `Avoid exercises: ${limitations.exercisesToAvoid.join(', ')}` : ''}

═══════════════════════════════════════════════════════════
GENERATE A TRAINING WEEK STARTING ${startDate || 'TODAY'}
═══════════════════════════════════════════════════════════

Return ONLY valid JSON (no markdown, no explanation):
{
  "programName": "string",
  "description": "string - brief explanation of this week's focus",
  "days": [
    {
      "dayOfWeek": "monday",
      "type": "workout",
      "workoutName": "string",
      "description": "string - workout summary",
      "duration": 60,
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": 4,
          "reps": "8-10",
          "rpe": 7,
          "notes": "Form cues"
        }
      ]
    },
    {
      "dayOfWeek": "wednesday",
      "type": "rest-day",
      "workoutName": "Active Recovery",
      "description": "Light mobility work",
      "duration": 30
    }
  ]
}

Include rest days where appropriate based on recovery data. Match the preferred training days.`;
}

/**
 * Generate a full training month with AI (FORGE)
 * POST /api/calendar/generate-month
 */
exports.generateMonth = async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const { startDate } = req.body;

    // Fetch user data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Fetch recent check-ins for context
    const checkIns = await CheckIn.find({ userId })
      .sort('-date')
      .limit(14);

    // Fetch latest wearable data
    const wearableData = await WearableData.findOne({ userId })
      .sort('-date');

    // Fetch recent workouts for context
    const recentWorkouts = await Workout.find({ clientId: userId })
      .sort('-scheduledDate')
      .limit(20);

    // Build AI prompt for monthly plan
    const prompt = buildMonthlyPlanPrompt(user, checkIns, wearableData, recentWorkouts, startDate);

    // Generate with Kimi K2 (OpenRouter)
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({
        success: false,
        message: 'AI API key not configured'
      });
    }

    console.log('🔥 FORGE generating monthly training program with AI (multi-provider fallback)...');
    const aiResponse = await aiService.generateAIContent(prompt, null, 8192);
    const aiText = aiResponse.text;
    console.log(`✓ Plan generated from ${aiResponse.source}`);

    // Parse JSON from AI response
    let plan;
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) ||
                        aiText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
      plan = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Failed to parse AI-generated plan',
        aiResponse: aiText
      });
    }

    // Create calendar events from plan
    const monthStart = startDate ? new Date(startDate) : new Date();
    monthStart.setHours(0, 0, 0, 0);

    const events = [];
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    // Process each week in the plan
    for (let weekIndex = 0; weekIndex < (plan.weeks || []).length; weekIndex++) {
      const week = plan.weeks[weekIndex];
      const weekStart = new Date(monthStart);
      weekStart.setDate(weekStart.getDate() + (weekIndex * 7));

      for (const day of (week.days || [])) {
        const dayIndex = daysOfWeek.indexOf(day.dayOfWeek?.toLowerCase());
        if (dayIndex === -1) continue;

        const eventDate = new Date(weekStart);
        const currentDayIndex = weekStart.getDay();
        const daysToAdd = (dayIndex - currentDayIndex + 7) % 7;
        eventDate.setDate(eventDate.getDate() + daysToAdd);

        // IMPORTANT: Normalize the type to valid enum values
        const normalizedType = normalizeEventType(day.type);

        // Map exercises to proper format with sets, reps, rest
        const exercisesList = (day.exercises || []).map(ex => ({
          name: ex.name || ex.exercise,
          sets: ex.sets || 3,
          reps: ex.reps || '8-12',
          rest: ex.rest || '90s',
          notes: ex.notes || ''
        }));

        const eventData = {
          userId,
          type: normalizedType,
          title: day.workoutName || day.title || `${normalizedType === 'rest-day' ? 'Rest' : 'Workout'} Day`,
          description: day.description || (exercisesList.length > 0 ? exercisesList.map(e => `${e.name}: ${e.sets}×${e.reps}`).join('\n') : ''),
          exercises: exercisesList,
          date: eventDate,
          startTime: day.startTime || user.schedule?.preferredTime || '09:00',
          duration: day.duration || user.schedule?.sessionDuration || 60,
          aiGenerated: true,
          aiReason: `Week ${weekIndex + 1}: ${week.focus || 'FORGE-generated program'}`,
          status: 'scheduled'
        };

        events.push(eventData);
      }
    }

    // Insert all events
    const createdEvents = await CalendarEvent.insertMany(events);

    console.log(`✅ FORGE created ${createdEvents.length} training days for the month`);

    res.json({
      success: true,
      data: {
        plan,
        events: createdEvents
      },
      message: `FORGE generated ${createdEvents.length} training days across ${plan.weeks?.length || 4} weeks`
    });

  } catch (error) {
    console.error('Generate month error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Build prompt for monthly plan generation (FORGE)
 */
function buildMonthlyPlanPrompt(user, checkIns, wearableData, recentWorkouts, startDate) {
  const profile = user.profile || {};
  const experience = user.experience || {};
  const primaryGoal = user.primaryGoal || {};
  const schedule = user.schedule || {};
  const equipment = user.equipment || {};
  const limitations = user.limitations || {};

  const avgReadiness = checkIns.length > 0
    ? Math.round(checkIns.reduce((sum, c) => sum + (c.readinessScore || 50), 0) / checkIns.length)
    : null;

  const daysPerWeek = schedule.daysPerWeek || 4;

  return `You are FORGE - an elite AI fitness coach. Generate a COMPLETE 4-WEEK periodized training program.

═══════════════════════════════════════════════════════════
ATHLETE PROFILE:
═══════════════════════════════════════════════════════════
- Name: ${user.name || 'Athlete'}
- Experience: ${experience.level || 'intermediate'} (${experience.yearsTraining || 'N/A'} years)
- Primary Discipline: ${experience.primaryDiscipline || 'general-fitness'}

GOAL:
- Type: ${primaryGoal.type || 'general-health'}
${primaryGoal.targetWeight ? `- Target Weight: ${primaryGoal.targetWeight}` : ''}
${primaryGoal.competition?.date ? `- Competition: ${primaryGoal.competition.type} on ${primaryGoal.competition.date}` : ''}
${primaryGoal.strengthTargets?.squat?.target ? `- Squat Target: ${primaryGoal.strengthTargets.squat.target}` : ''}
${primaryGoal.strengthTargets?.bench?.target ? `- Bench Target: ${primaryGoal.strengthTargets.bench.target}` : ''}
${primaryGoal.strengthTargets?.deadlift?.target ? `- Deadlift Target: ${primaryGoal.strengthTargets.deadlift.target}` : ''}

SCHEDULE:
- Days per week: ${daysPerWeek}
- Preferred days: ${schedule.preferredDays?.join(', ') || 'Monday, Tuesday, Thursday, Friday'}
- Session length: ${schedule.sessionDuration || 60} minutes
- Preferred time: ${schedule.preferredTime || 'flexible'}

EQUIPMENT:
- Location: ${equipment.trainingLocation || 'commercial-gym'}
- Available: ${equipment.availableEquipment?.join(', ') || 'full gym access'}
${equipment.limitations ? `- Limitations: ${equipment.limitations}` : ''}

CURRENT STATE:
${avgReadiness ? `- Average Readiness (14 days): ${avgReadiness}/100` : '- No check-in data'}
${wearableData?.recoveryScore ? `- Latest Recovery Score: ${wearableData.recoveryScore}/100` : ''}
${wearableData?.sleepDuration ? `- Latest Sleep: ${(wearableData.sleepDuration / 60).toFixed(1)}h` : ''}

${limitations.injuries?.length ? `
INJURIES/LIMITATIONS:
${limitations.injuries.map(i => `- ${i.bodyPart}: ${i.description}`).join('\n')}
` : ''}
${limitations.exercisesToAvoid?.length ? `Avoid exercises: ${limitations.exercisesToAvoid.join(', ')}` : ''}

═══════════════════════════════════════════════════════════
GENERATE A 4-WEEK PERIODIZED PROGRAM STARTING ${startDate || 'TODAY'}
═══════════════════════════════════════════════════════════

Use proper periodization:
- Week 1: Foundation/Accumulation (moderate volume, moderate intensity)
- Week 2: Building (increased volume)
- Week 3: Intensification (peak intensity)
- Week 4: Deload (reduced volume for recovery)

Return ONLY valid JSON (no markdown explanation outside the JSON):
{
  "programName": "string - creative program name",
  "description": "string - FORGE's coaching philosophy for this month",
  "periodization": "linear|undulating|block",
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "Accumulation - Building Base",
      "days": [
        {
          "dayOfWeek": "monday",
          "type": "workout",
          "workoutName": "Upper Power",
          "description": "Focus on compound movements",
          "duration": 60,
          "exercises": [
            {
              "name": "Bench Press",
              "sets": 4,
              "reps": "6-8",
              "rpe": 7,
              "notes": "Control the eccentric"
            }
          ]
        }
      ]
    }
  ]
}

Generate EXACTLY ${daysPerWeek} training days per week on the preferred days. Include rest day entries for other days.`;
}

/**
 * Create a recurring event series
 * POST /api/calendar/recurring
 */
exports.createRecurring = async (req, res) => {
  try {
    const { userId, type, title, description, startDate, startTime, duration, recurrenceRule } = req.body;

    if (!recurrenceRule || !recurrenceRule.frequency) {
      return res.status(400).json({
        success: false,
        message: 'Recurrence rule is required'
      });
    }

    const events = [];
    const start = new Date(startDate);
    const end = recurrenceRule.endDate ? new Date(recurrenceRule.endDate) : new Date(start.getTime() + 12 * 7 * 24 * 60 * 60 * 1000); // 12 weeks default

    if (recurrenceRule.frequency === 'weekly' && recurrenceRule.daysOfWeek) {
      // Generate events for each specified day of the week
      let current = new Date(start);

      while (current <= end) {
        for (const dayOfWeek of recurrenceRule.daysOfWeek) {
          const eventDate = new Date(current);
          const currentDay = eventDate.getDay();
          const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
          eventDate.setDate(eventDate.getDate() + daysToAdd);

          if (eventDate >= start && eventDate <= end) {
            // Check if this date is an exception
            const isException = recurrenceRule.exceptions?.some(ex =>
              new Date(ex).toDateString() === eventDate.toDateString()
            );

            if (!isException) {
              events.push({
                userId: userId || req.user.id,
                type,
                title,
                description,
                date: eventDate,
                startTime,
                duration,
                recurring: true,
                recurrenceRule,
                status: 'scheduled'
              });
            }
          }
        }
        // Move to next week (or interval)
        current.setDate(current.getDate() + 7 * (recurrenceRule.interval || 1));
      }
    } else if (recurrenceRule.frequency === 'daily') {
      let current = new Date(start);
      while (current <= end) {
        events.push({
          userId: userId || req.user.id,
          type,
          title,
          description,
          date: new Date(current),
          startTime,
          duration,
          recurring: true,
          recurrenceRule,
          status: 'scheduled'
        });
        current.setDate(current.getDate() + (recurrenceRule.interval || 1));
      }
    }

    const createdEvents = await CalendarEvent.insertMany(events);

    res.status(201).json({
      success: true,
      data: createdEvents,
      message: `Created ${createdEvents.length} recurring events`
    });

  } catch (error) {
    console.error('Create recurring error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;
