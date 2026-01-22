const mongoose = require('mongoose');

// ============================================
// FORGE PROGRAM MODEL
// Persistent training program generated once
// from onboarding + in-app + chat data
// ============================================

const phaseSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ['accumulation', 'strength', 'intensity', 'peak', 'deload', 'transition'],
    required: true
  },
  startWeek: { type: Number, required: true },
  endWeek: { type: Number, required: true },
  volumeLevel: { type: String, enum: ['low', 'moderate', 'high'], default: 'moderate' },
  intensityRange: { type: [Number], validate: { validator: (v) => v.length === 2 && v[0] < v[1] } },
  rpeTarget: Number,
  deloadWeek: Boolean
}, { _id: false });

const exerciseTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['main-lift', 'accessory', 'warmup', 'cooldown'], default: 'main-lift' },
  sets: Number,
  reps: String,  // "3-5", "8-12", "30s", etc.
  rest: String,  // "3-5 min", "60-90 sec", etc.
  rpe: Number,
  percentageOfMax: Number,
  notes: String
}, { _id: false });

const trainingDaySchema = new mongoose.Schema({
  dayOfWeek: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },
  title: String,  // "Heavy Squat Day", "Upper Power"
  focus: String,  // "squat", "bench", "deadlift", "accessories", "upper", "lower"
  duration: Number,  // minutes
  exercises: [exerciseTemplateSchema]
}, { _id: false });

const weeklyTemplateSchema = new mongoose.Schema({
  weekNumber: { type: Number, required: true },
  trainingDays: [trainingDaySchema],
  restDays: [String],  // days of week for rest
  deloadWeek: Boolean
}, { _id: false });

const programSchema = new mongoose.Schema({
  // ═══════════════════════════════════════════════════════════
  // CORE METADATA
  // ═══════════════════════════════════════════════════════════
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  goal: {
    type: String,
    enum: [
      'build-strength', 'build-muscle', 'lose-fat', 'improve-endurance',
      'increase-mobility', 'competition-prep', 'general-health', 'body-recomp', 'sport-performance'
    ],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'completed'],
    default: 'active'
  },

  // ═══════════════════════════════════════════════════════════
  // TIMELINE
  // ═══════════════════════════════════════════════════════════
  startDate: { type: Date, required: true },
  endDate: Date,
  durationWeeks: { type: Number, required: true },
  currentWeek: { type: Number, default: 1, min: 1 },

  // ═══════════════════════════════════════════════════════════
  // PERIODIZATION STRUCTURE
  // ═══════════════════════════════════════════════════════════
  periodization: {
    model: {
      type: String,
      enum: ['linear', 'block', 'undulating', 'conjugate', 'autoregulated'],
      required: true
    },
    phases: [phaseSchema]
  },

  // ═══════════════════════════════════════════════════════════
  // WEEKLY TEMPLATES - THE PROGRAM BLUEPRINT
  // ═══════════════════════════════════════════════════════════
  weeklyTemplates: {
    type: [weeklyTemplateSchema],
    validate: {
      validator: (v) => v && v.length > 0,
      message: 'At least one weekly template is required'
    }
  },

  // ═══════════════════════════════════════════════════════════
  // NUTRITION INTEGRATION
  // ═══════════════════════════════════════════════════════════
  nutritionPlan: {
    calorieTarget: Number,
    macros: {
      protein: Number,  // grams
      carbs: Number,
      fat: Number
    },
    mealTiming: String,  // pre-workout, post-workout preferences
    supplementation: [String]
  },

  // ═══════════════════════════════════════════════════════════
  // COMPETITION PREP (IF APPLICABLE)
  // ═══════════════════════════════════════════════════════════
  competitionPrep: {
    competitionDate: Date,
    federation: String,
    weightClass: Number,
    targetLifts: {
      squat: Number,
      bench: Number,
      deadlift: Number
    },
    currentLifts: {
      squat: Number,
      bench: Number,
      deadlift: Number
    },
    weeksOut: Number
  },

  // ═══════════════════════════════════════════════════════════
  // AUTOREGULATION PARAMETERS
  // ═══════════════════════════════════════════════════════════
  autoregulation: {
    enabled: { type: Boolean, default: true },
    recoveryAdjustments: {
      high: { type: String, default: 'push-hard' },      // high readiness
      moderate: { type: String, default: 'as-planned' }, // normal readiness
      low: { type: String, default: 'reduce-volume' }    // low readiness
    }
  },

  // ═══════════════════════════════════════════════════════════
  // AI GENERATION METADATA
  // ═══════════════════════════════════════════════════════════
  aiGenerated: { type: Boolean, default: true },
  aiRationale: String,  // Why this program was chosen
  generatedAt: { type: Date, default: Date.now },
  lastUpdated: Date,
  lastPropagatedAt: Date  // When calendar was last updated from this program

}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================
programSchema.index({ userId: 1, status: 1 });
programSchema.index({ userId: 1, startDate: -1 });
programSchema.index({ status: 1, currentWeek: 1 });

// ============================================
// VIRTUALS
// ============================================

// Weeks remaining in program
programSchema.virtual('weeksRemaining').get(function() {
  return Math.max(0, this.durationWeeks - this.currentWeek + 1);
});

// Is this program currently active (timeline-wise)
programSchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.currentWeek <= this.durationWeeks;
});

// Percent complete
programSchema.virtual('percentComplete').get(function() {
  return Math.round((this.currentWeek / this.durationWeeks) * 100);
});

// ============================================
// INSTANCE METHODS
// ============================================

// Calculate current phase based on current week
programSchema.methods.calculateCurrentPhase = function() {
  if (!this.periodization || !this.periodization.phases) {
    return null;
  }

  const phase = this.periodization.phases.find(
    p => this.currentWeek >= p.startWeek && this.currentWeek <= p.endWeek
  );

  return phase || null;
};

// Progress to next week
programSchema.methods.progressToNextWeek = async function() {
  if (this.currentWeek < this.durationWeeks) {
    this.currentWeek += 1;
    this.lastUpdated = new Date();

    // Check if we've completed the program
    if (this.currentWeek > this.durationWeeks) {
      this.status = 'completed';
    }

    return this.save();
  }

  return this;
};

// Get template for a specific week
programSchema.methods.getWeekTemplate = function(weekNumber) {
  return this.weeklyTemplates.find(wt => wt.weekNumber === weekNumber);
};

// Generate calendar events from this program
programSchema.methods.generateCalendarEvents = async function() {
  const CalendarEvent = mongoose.model('CalendarEvent');
  const events = [];

  // Loop through each week template
  for (const weekTemplate of this.weeklyTemplates) {
    for (const trainingDay of weekTemplate.trainingDays) {
      // Calculate base date for this week
      const baseDate = new Date(this.startDate);
      baseDate.setDate(baseDate.getDate() + ((weekTemplate.weekNumber - 1) * 7));

      // Move to start of the week (Sunday)
      const daysToWeekStart = baseDate.getDay();
      baseDate.setDate(baseDate.getDate() - daysToWeekStart);

      // Find day of week index
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayIndex = daysOfWeek.indexOf(trainingDay.dayOfWeek.toLowerCase());

      // Calculate actual date within this week
      const eventDate = new Date(baseDate);
      eventDate.setDate(eventDate.getDate() + dayIndex);

      // Skip past dates (compare dates only, not timestamps)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const checkDate = new Date(eventDate);
      checkDate.setHours(0, 0, 0, 0);
      if (checkDate < today) continue;

      // Calculate periodization phase
      const phase = this.periodization.phases.find(
        p => weekTemplate.weekNumber >= p.startWeek && weekTemplate.weekNumber <= p.endWeek
      );

      // Build exercises with phase-specific adjustments
      const exercises = trainingDay.exercises.map(ex => ({
        name: ex.name,
        category: ex.category || 'accessory',
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        rpe: ex.rpe,
        percentageOfMax: ex.percentageOfMax,
        notes: ex.notes
      }));

      events.push({
        userId: this.userId,
        type: 'workout',
        title: trainingDay.focus || trainingDay.title || trainingDay.dayOfWeek,
        date: eventDate,
        startTime: '09:00',  // Default start time
        duration: trainingDay.duration || 60,
        exercises: exercises,
        programId: this._id,
        weekNumber: weekTemplate.weekNumber,
        periodizationPhase: phase?.name || null,
        aiGenerated: true,
        aiReason: `Generated from Program: ${this.name} (Week ${weekTemplate.weekNumber})`,
        status: 'scheduled'
      });
    }

    // Add rest days
    if (weekTemplate.restDays && weekTemplate.restDays.length > 0) {
      for (const restDay of weekTemplate.restDays) {
        // Calculate base date for this week
        const baseDate = new Date(this.startDate);
        baseDate.setDate(baseDate.getDate() + ((weekTemplate.weekNumber - 1) * 7));

        // Move to start of the week (Sunday)
        const daysToWeekStart = baseDate.getDay();
        baseDate.setDate(baseDate.getDate() - daysToWeekStart);

        // Find day of week index
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = daysOfWeek.indexOf(restDay.toLowerCase());

        // Calculate actual date within this week
        const eventDate = new Date(baseDate);
        eventDate.setDate(eventDate.getDate() + dayIndex);

        // Skip past dates (compare dates only, not timestamps)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const checkRestDate = new Date(eventDate);
        checkRestDate.setHours(0, 0, 0, 0);
        if (checkRestDate >= today) {
          events.push({
            userId: this.userId,
            type: 'rest-day',
            title: 'Rest Day',
            date: eventDate,
            programId: this._id,
            weekNumber: weekTemplate.weekNumber,
            aiGenerated: true,
            status: 'scheduled'
          });
        }
      }
    }
  }

  // Bulk insert events
  if (events.length > 0) {
    const created = await CalendarEvent.insertMany(events);
    this.lastPropagatedAt = new Date();
    await this.save();
    return created;
  }

  return [];
};

// ============================================
// STATIC METHODS
// ============================================

// Get active program for a user
programSchema.statics.getActiveForUser = async function(userId) {
  return this.findOne({
    userId,
    status: 'active'
  });
};

// Get or create default program for new user
programSchema.statics.getOrCreateForUser = async function(userId) {
  let program = await this.findOne({ userId, status: 'active' });
  if (!program) {
    // Return null - let controller handle creating a program
    return null;
  }
  return program;
};

// ============================================
// CONFIGURATION
// ============================================
programSchema.set('toJSON', { virtuals: true });
programSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Program', programSchema);
