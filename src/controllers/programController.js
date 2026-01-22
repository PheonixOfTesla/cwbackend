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
    const User = require('../models/User'); // ensure model is loaded
    const user = await User.findById(userId);
    const programFactory = require('../services/programFactory');

    // 1. Subscription Check
    if (!user.hasActiveSubscription()) {
      const trialHours = user.getTrialRemainingHours();
      return res.status(403).json({
        success: false,
        message: 'Subscription required',
        trialRemaining: trialHours
      });
    }

    // 2. Call Factory (Centralized Logic)
    console.log('[ProgramController] Delegating generation to ProgramFactory');
    const result = await programFactory.createProgramForUser(userId, { source: 'ui' });

    // 3. Return Success
    res.json({
      success: true,
      message: 'Program generated successfully',
      program: {
        _id: result.program._id,
        name: result.program.name,
        goal: result.program.goal,
        durationWeeks: result.program.durationWeeks,
        startDate: result.program.startDate,
        periodization: result.program.periodization,
        nutritionPlan: result.program.nutritionPlan,
        stats: {
          calendarEventsCreated: result.stats.workouts,
          mealEventsCreated: result.stats.meals,
          totalEventsCreated: result.stats.workouts + result.stats.meals,
          weeksPlanned: result.program.weeklyTemplates.length
        }
      }
    });

  } catch (error) {
    console.error('[FORGE] Program generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate program',
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
