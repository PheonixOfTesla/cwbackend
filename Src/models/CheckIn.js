const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  date: { type: Date, required: true, index: true },

  // ═══════════════════════════════════════
  // READINESS METRICS (1-5 scale)
  // ═══════════════════════════════════════
  sleepQuality: { type: Number, min: 1, max: 5 },
  sleepHours: { type: Number, min: 0, max: 24 },
  energyLevel: { type: Number, min: 1, max: 5 },
  motivation: { type: Number, min: 1, max: 5 },
  stressLevel: { type: Number, min: 1, max: 5 },      // 1=calm, 5=stressed
  muscleSoreness: { type: Number, min: 1, max: 5 },   // 1=fresh, 5=very sore

  // ═══════════════════════════════════════
  // BODY METRICS (optional daily weigh-in)
  // ═══════════════════════════════════════
  bodyWeight: { type: Number, min: 0 },

  // ═══════════════════════════════════════
  // CALCULATED READINESS SCORE (0-100)
  // ═══════════════════════════════════════
  readinessScore: { type: Number, min: 0, max: 100 },

  // ═══════════════════════════════════════
  // MOOD
  // ═══════════════════════════════════════
  mood: {
    type: String,
    enum: ['fired-up', 'good', 'neutral', 'tired', 'exhausted', 'sick']
  },
  notes: { type: String, maxlength: 500, trim: true },

  // ═══════════════════════════════════════
  // WEARABLE AUTO-FILL
  // ═══════════════════════════════════════
  wearableData: {
    source: { type: String, trim: true },  // 'fitbit', 'whoop', etc.
    hrv: { type: Number, min: 0 },
    restingHR: { type: Number, min: 0 },
    sleepScore: { type: Number, min: 0, max: 100 },
    recoveryScore: { type: Number, min: 0, max: 100 },
    steps: { type: Number, min: 0 },
    activeMinutes: { type: Number, min: 0 },
    syncedAt: Date
  },

  // ═══════════════════════════════════════
  // GOAL CHECK (quick review)
  // ═══════════════════════════════════════
  goalUpdates: [{
    goalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Goal' },
    stillOnTrack: { type: Boolean },
    currentValue: { type: Number },       // Updated progress
    blockers: { type: String, trim: true },  // What's in the way?
    needsAdjustment: { type: Boolean }
  }],

  // ═══════════════════════════════════════
  // HABIT TRACKING
  // ═══════════════════════════════════════
  habits: {
    waterCups: { type: Number, min: 0, max: 20 },
    supplements: [{ type: String, trim: true }],  // ['protein', 'creatine', 'vitamins']
    steps: { type: Number, min: 0 }
  },

  // ═══════════════════════════════════════
  // PROGRESS PHOTO
  // ═══════════════════════════════════════
  progressPhoto: { type: String },  // Base64 or URL

  // ═══════════════════════════════════════
  // AI RECOMMENDATION
  // ═══════════════════════════════════════
  aiRecommendation: {
    trainingIntensity: {
      type: String,
      enum: ['full-send', 'normal', 'moderate', 'light', 'rest']
    },
    reason: { type: String, trim: true },
    suggestedWorkoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout' },
    nutritionTip: { type: String, trim: true }
  }

}, { timestamps: true });

// One check-in per user per day
checkInSchema.index({ userId: 1, date: 1 }, { unique: true });

// Calculate readiness score before save
checkInSchema.pre('save', function(next) {
  // Weighted scoring (all scaled 1-5, higher = better except stress/soreness)
  const weights = {
    sleepQuality: 0.25,
    energy: 0.20,
    motivation: 0.15,
    stress: 0.15,        // Inverted
    soreness: 0.15,      // Inverted
    wearable: 0.10
  };

  let score = 0;
  let totalWeight = 0;

  if (this.sleepQuality) {
    score += (this.sleepQuality / 5) * weights.sleepQuality;
    totalWeight += weights.sleepQuality;
  }
  if (this.energyLevel) {
    score += (this.energyLevel / 5) * weights.energy;
    totalWeight += weights.energy;
  }
  if (this.motivation) {
    score += (this.motivation / 5) * weights.motivation;
    totalWeight += weights.motivation;
  }
  if (this.stressLevel) {
    score += ((6 - this.stressLevel) / 5) * weights.stress;  // Invert
    totalWeight += weights.stress;
  }
  if (this.muscleSoreness) {
    score += ((6 - this.muscleSoreness) / 5) * weights.soreness;  // Invert
    totalWeight += weights.soreness;
  }
  if (this.wearableData?.recoveryScore) {
    score += (this.wearableData.recoveryScore / 100) * weights.wearable;
    totalWeight += weights.wearable;
  }

  this.readinessScore = totalWeight > 0
    ? Math.round((score / totalWeight) * 100)
    : null;

  next();
});

// Virtual for readiness level label
checkInSchema.virtual('readinessLevel').get(function() {
  if (!this.readinessScore) return 'unknown';
  if (this.readinessScore >= 80) return 'optimal';
  if (this.readinessScore >= 60) return 'good';
  if (this.readinessScore >= 40) return 'moderate';
  if (this.readinessScore >= 20) return 'low';
  return 'very-low';
});

// Virtual for training recommendation based on score
checkInSchema.virtual('recommendedIntensity').get(function() {
  if (!this.readinessScore) return 'normal';
  if (this.readinessScore >= 80) return 'full-send';
  if (this.readinessScore >= 60) return 'normal';
  if (this.readinessScore >= 40) return 'moderate';
  if (this.readinessScore >= 20) return 'light';
  return 'rest';
});

// Static method to get today's check-in
checkInSchema.statics.getTodayCheckIn = function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.findOne({
    userId,
    date: { $gte: today, $lt: tomorrow }
  }).populate('goalUpdates.goalId');
};

// Static method to get check-in history
checkInSchema.statics.getHistory = function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  return this.find({
    userId,
    date: { $gte: startDate }
  }).sort('date');
};

// Static method to calculate trends
checkInSchema.statics.getTrends = async function(userId, days = 30) {
  const checkIns = await this.getHistory(userId, days);

  if (checkIns.length === 0) {
    return {
      avgReadiness: null,
      avgSleep: null,
      avgEnergy: null,
      checkInStreak: 0,
      totalCheckIns: 0,
      data: []
    };
  }

  const average = (arr, key) => {
    const valid = arr.filter(item => item[key] != null).map(item => item[key]);
    return valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  };

  // Calculate streak
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= days; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    checkDate.setHours(0, 0, 0, 0);

    const hasCheckIn = checkIns.some(c => {
      const cDate = new Date(c.date);
      cDate.setHours(0, 0, 0, 0);
      return cDate.getTime() === checkDate.getTime();
    });

    if (hasCheckIn) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    avgReadiness: average(checkIns, 'readinessScore'),
    avgSleep: average(checkIns, 'sleepHours'),
    avgEnergy: average(checkIns, 'energyLevel'),
    checkInStreak: streak,
    totalCheckIns: checkIns.length,
    data: checkIns
  };
};

// JSON serialization
checkInSchema.set('toJSON', { virtuals: true });
checkInSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CheckIn', checkInSchema);
