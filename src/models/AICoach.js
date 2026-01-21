// Src/models/AICoach.js - Personalized AI Coach Model
// This is THE CORE VALUE PROP - AI that learns each user over time
const mongoose = require('mongoose');

const aiCoachSchema = new mongoose.Schema({
  // One AI Coach per user (individual or client)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },

  // ═══════════════════════════════════════════════════════════
  // COMMUNICATION STYLE - How the AI talks to this user
  // ═══════════════════════════════════════════════════════════
  communicationStyle: {
    type: String,
    enum: ['direct', 'encouraging', 'data_focused', 'tough_love'],
    default: 'encouraging'
  },

  // ═══════════════════════════════════════════════════════════
  // TRAINING PHILOSOPHY - What type of training the AI recommends
  // ═══════════════════════════════════════════════════════════
  trainingPhilosophy: {
    programStyle: {
      type: String,
      enum: ['powerlifting', 'bodybuilding', 'crossfit', 'yoga', 'hybrid', 'general', 'sport-specific'],
      default: 'general'
    },
    periodizationModel: {
      type: String,
      enum: ['linear', 'undulating', 'block', 'conjugate', 'autoregulated'],
      default: 'linear'
    },
    volumePreference: {
      type: String,
      enum: ['low', 'moderate', 'high'],
      default: 'moderate'
    },
    intensityPreference: {
      type: String,
      enum: ['low', 'moderate', 'high', 'varied'],
      default: 'moderate'
    },
    restPreference: {
      type: String,
      enum: ['short', 'moderate', 'long'],
      default: 'moderate'
    }
  },

  // ═══════════════════════════════════════════════════════════
  // PREFERENCES - User's explicit preferences
  // ═══════════════════════════════════════════════════════════
  preferences: {
    favoriteExercises: [String],
    avoidExercises: [String],
    preferredSessionDuration: {
      type: Number,
      default: 60,
      min: 15,
      max: 180
    },
    warmupStyle: {
      type: String,
      enum: ['minimal', 'standard', 'extensive'],
      default: 'standard'
    },
    cooldownIncluded: {
      type: Boolean,
      default: true
    },
    musicGenre: String,
    motivationTriggers: [String]
  },

  // ═══════════════════════════════════════════════════════════
  // TRAINING HISTORY - What the AI has learned about this user
  // ═══════════════════════════════════════════════════════════
  trainingHistory: {
    totalWorkouts: {
      type: Number,
      default: 0
    },
    totalMinutes: {
      type: Number,
      default: 0
    },
    averageCompletion: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    preferredDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    peakPerformanceTime: {
      type: String,
      enum: ['early-morning', 'morning', 'afternoon', 'evening', 'late-night'],
      default: 'morning'
    },
    averageSessionDuration: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    lastWorkoutDate: Date,

    // Injury history for AI to avoid aggravating
    injuryHistory: [{
      area: String,
      description: String,
      date: Date,
      recovered: {
        type: Boolean,
        default: false
      },
      recoveredDate: Date,
      movementsToAvoid: [String]
    }]
  },

  // ═══════════════════════════════════════════════════════════
  // PERFORMANCE METRICS - Tracked over time
  // ═══════════════════════════════════════════════════════════
  performanceMetrics: {
    estimatedOneRepMaxes: {
      squat: Number,
      bench: Number,
      deadlift: Number,
      overheadPress: Number
    },
    bodyweightPRs: {
      pullups: Number,
      pushups: Number,
      dips: Number
    },
    cardioBaselines: {
      mileTime: Number,
      fiveKTime: Number,
      maxHeartRate: Number,
      restingHeartRate: Number
    },
    lastUpdated: Date
  },

  // ═══════════════════════════════════════════════════════════
  // ADAPTATIONS - How AI has adjusted for this user
  // ═══════════════════════════════════════════════════════════
  adaptations: [{
    trigger: {
      type: String,
      required: true
    },
    response: {
      type: String,
      required: true
    },
    effectiveness: {
      type: Number,
      min: 0,
      max: 10
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    appliedCount: {
      type: Number,
      default: 1
    }
  }],

  // ═══════════════════════════════════════════════════════════
  // LEARNINGS - Patterns the AI has discovered
  // ═══════════════════════════════════════════════════════════
  learnings: [{
    pattern: {
      type: String,
      required: true
    },
    insight: {
      type: String,
      required: true
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    dataPoints: {
      type: Number,
      default: 1
    },
    discoveredAt: {
      type: Date,
      default: Date.now
    },
    lastConfirmed: Date
  }],

  // ═══════════════════════════════════════════════════════════
  // AI INTERACTION STATS
  // ═══════════════════════════════════════════════════════════
  aiStats: {
    totalQueries: {
      type: Number,
      default: 0
    },
    queriesThisMonth: {
      type: Number,
      default: 0
    },
    lastQueryDate: Date,
    monthlyResetDate: Date,
    satisfactionRatings: [{
      rating: Number,
      queryType: String,
      date: Date
    }],
    averageSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    }
  },

  // ═══════════════════════════════════════════════════════════
  // CURRENT PROGRAM STATE
  // ═══════════════════════════════════════════════════════════
  currentProgram: {
    name: String,
    startDate: Date,
    weekNumber: {
      type: Number,
      default: 1
    },
    phase: {
      type: String,
      enum: ['accumulation', 'strength', 'intensity', 'peak', 'deload', 'transition']
    },
    nextDeloadWeek: Number,
    programGoal: String
  },

  // Reference to new Program model (persistent)
  currentProgramId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program',
    default: null
  }
}, {
  timestamps: true
});

// Static method to get or create AI Coach for user
aiCoachSchema.statics.getOrCreateForUser = async function(userId) {
  let aiCoach = await this.findOne({ user: userId });

  if (!aiCoach) {
    aiCoach = await this.create({ user: userId });
  }

  return aiCoach;
};

// Instance method to log an adaptation
aiCoachSchema.methods.logAdaptation = function(trigger, response, effectiveness = 5) {
  this.adaptations.push({
    trigger,
    response,
    effectiveness,
    timestamp: new Date()
  });

  // Keep only last 100 adaptations
  if (this.adaptations.length > 100) {
    this.adaptations = this.adaptations.slice(-100);
  }

  return this.save();
};

// Instance method to log a learning
aiCoachSchema.methods.logLearning = function(pattern, insight, confidence = 0.5) {
  // Check if this pattern already exists
  const existing = this.learnings.find(l => l.pattern === pattern);

  if (existing) {
    existing.dataPoints += 1;
    existing.confidence = Math.min(1, existing.confidence + 0.1);
    existing.lastConfirmed = new Date();
  } else {
    this.learnings.push({
      pattern,
      insight,
      confidence,
      discoveredAt: new Date()
    });
  }

  // Keep only last 50 learnings
  if (this.learnings.length > 50) {
    this.learnings = this.learnings.slice(-50);
  }

  return this.save();
};

// Instance method to increment query count
aiCoachSchema.methods.incrementQueryCount = function() {
  const now = new Date();

  // Reset monthly count if new month
  if (this.aiStats.monthlyResetDate) {
    const resetDate = new Date(this.aiStats.monthlyResetDate);
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      this.aiStats.queriesThisMonth = 0;
      this.aiStats.monthlyResetDate = now;
    }
  } else {
    this.aiStats.monthlyResetDate = now;
  }

  this.aiStats.totalQueries += 1;
  this.aiStats.queriesThisMonth += 1;
  this.aiStats.lastQueryDate = now;

  return this.save();
};

// Instance method to update workout stats
aiCoachSchema.methods.updateWorkoutStats = function(workoutData) {
  this.trainingHistory.totalWorkouts += 1;
  this.trainingHistory.totalMinutes += workoutData.duration || 0;
  this.trainingHistory.lastWorkoutDate = new Date();

  // Update average session duration
  const total = this.trainingHistory.totalMinutes;
  const count = this.trainingHistory.totalWorkouts;
  this.trainingHistory.averageSessionDuration = Math.round(total / count);

  // Update completion rate (rolling average)
  const completion = workoutData.completionRate || 100;
  const prevAvg = this.trainingHistory.averageCompletion || 0;
  this.trainingHistory.averageCompletion = Math.round((prevAvg * (count - 1) + completion) / count);

  return this.save();
};

// Virtual for AI context (what to send to AI)
aiCoachSchema.virtual('aiContext').get(function() {
  return {
    style: this.communicationStyle,
    philosophy: this.trainingPhilosophy,
    preferences: this.preferences,
    history: {
      workouts: this.trainingHistory.totalWorkouts,
      avgCompletion: this.trainingHistory.averageCompletion,
      preferredDays: this.trainingHistory.preferredDays,
      peakTime: this.trainingHistory.peakPerformanceTime,
      injuries: this.trainingHistory.injuryHistory.filter(i => !i.recovered)
    },
    recentAdaptations: this.adaptations.slice(-5),
    keyLearnings: this.learnings.filter(l => l.confidence > 0.7),
    currentProgramId: this.currentProgramId
  };
});

module.exports = mongoose.model('AICoach', aiCoachSchema);
