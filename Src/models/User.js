// Src/models/User.js - ClockWork B2C/B2B Hybrid Model
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function() {
      return this.isNew;
    },
    validate: {
      validator: function(v) {
        return !v || v.length >= 6;
      },
      message: 'Password must be at least 6 characters long'
    }
  },

  // Email verification status
  emailVerified: {
    type: Boolean,
    default: false
  },

  // ═══════════════════════════════════════════════════════════
  // USER TYPE - THE KEY FIELD (B2C/B2B Hybrid)
  // ═══════════════════════════════════════════════════════════
  userType: {
    type: String,
    enum: ['coach', 'client', 'individual'],
    required: true,
    default: 'individual'
  },

  // Coach reference (only for clients)
  coachId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // ═══════════════════════════════════════════════════════════
  // COACH PROFILE (only for coaches)
  // ═══════════════════════════════════════════════════════════
  coachProfile: {
    specialty: {
      type: String,
      maxlength: 100,
      default: ''
    },
    bio: {
      type: String,
      maxlength: 500,
      default: ''
    },
    profilePicture: {
      type: String,
      default: ''
    },
    certifications: [{
      name: String,
      issuingOrganization: String,
      year: Number
    }],
    experienceYears: {
      type: Number,
      default: 0
    },

    // ═══════════════════════════════════════════════════════════
    // SCHEDULING PREFERENCES
    // ═══════════════════════════════════════════════════════════
    scheduling: {
      // Billing cycle for clients
      billingCycle: {
        type: String,
        enum: ['weekly', 'biweekly', 'monthly', 'per-session'],
        default: 'monthly'
      },

      // Session pricing (per session or package rate)
      sessionPrice: {
        type: Number,
        default: 0,
        min: 0
      },

      // Session duration options (in minutes)
      sessionDurations: {
        type: [Number],
        default: [60], // Default 1 hour sessions
        validate: {
          validator: function(v) {
            return v.every(duration => [30, 45, 60, 90, 120].includes(duration));
          },
          message: 'Session durations must be 30, 45, 60, 90, or 120 minutes'
        }
      },

      // Booking window
      minNoticeHours: {
        type: Number,
        default: 24, // Must book at least 24 hours in advance
        min: 0
      },
      maxAdvanceBookingDays: {
        type: Number,
        default: 30, // Can't book more than 30 days ahead
        min: 1
      },

      // Weekly availability (which days are available)
      availableDays: {
        type: [String],
        default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        validate: {
          validator: function(v) {
            const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            return v.every(day => validDays.includes(day.toLowerCase()));
          },
          message: 'Invalid day name'
        }
      },

      // Time preferences (multiple slots allowed)
      timeSlots: [{
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        },
        startTime: String, // Format: "HH:MM" (24-hour)
        endTime: String    // Format: "HH:MM" (24-hour)
      }],

      // Quick availability tags
      availabilityTags: {
        type: [String],
        default: [],
        enum: ['early-morning', 'morning', 'afternoon', 'evening', 'late-night', 'weekends', 'flexible']
      },

      // Auto-accept bookings or require approval
      autoAcceptBookings: {
        type: Boolean,
        default: false
      }
    },

    // ═══════════════════════════════════════════════════════════
    // PAYMENT METHODS (Direct peer-to-peer)
    // ═══════════════════════════════════════════════════════════
    paymentMethods: {
      venmo: {
        username: String,
        enabled: {
          type: Boolean,
          default: false
        }
      },
      cashapp: {
        cashtag: String, // e.g., "$username"
        enabled: {
          type: Boolean,
          default: false
        }
      },
      paypal: {
        email: String,
        enabled: {
          type: Boolean,
          default: false
        }
      },
      zelle: {
        email: String,
        phone: String,
        enabled: {
          type: Boolean,
          default: false
        }
      }
    }
  },

  // ═══════════════════════════════════════════════════════════
  // SUBSCRIPTION (Replaces gym-based billing)
  // ═══════════════════════════════════════════════════════════
  subscription: {
    tier: {
      type: String,
      enum: ['free', 'pro', 'coach_starter', 'coach_pro', 'coach_scale', 'coach_enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'trialing', 'inactive', 'trial_expired'],
      default: 'active'
    },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false
    },
    // 24-hour free trial
    trialStartDate: Date,
    trialEndDate: Date,
    trialUsed: {
      type: Boolean,
      default: false
    }
  },

  // Password Reset
  resetPasswordCode: {
    type: String
  },
  resetPasswordExpires: {
    type: Date
  },

  // Profile
  phone: {
    type: String,
    sparse: true,
    index: true
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  phoneVerificationCode: String,
  phoneVerificationExpires: Date,
  dateOfBirth: {
    type: Date
  },
  height: {
    type: Number
  },

  // Wearable Connections
  wearableConnections: {
    type: [{
      provider: {
        type: String,
        enum: ['fitbit', 'apple', 'garmin', 'whoop', 'oura', 'polar']
      },
      connected: {
        type: Boolean,
        default: false
      },
      accessToken: String,
      refreshToken: String,
      expiresAt: Date,
      externalUserId: String,
      lastSync: Date,
      scopes: [String]
    }],
    default: []
  },

  // Timestamps
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },

  // ═══════════════════════════════════════════════════════════
  // ONBOARDING & TRAINING PROFILE (ClockWork)
  // ═══════════════════════════════════════════════════════════

  // Profile (Step 1)
  profile: {
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer-not-to-say']
    },
    height: Number,
    currentWeight: Number,
    unitPreference: {
      type: String,
      enum: ['metric', 'imperial'],
      default: 'imperial'
    }
  },

  // Training Experience (Step 2)
  experience: {
    level: {
      type: String,
      enum: ['complete-beginner', 'beginner', 'intermediate', 'advanced', 'elite']
    },
    yearsTraining: Number,
    primaryDiscipline: {
      type: String,
      enum: ['powerlifting', 'bodybuilding', 'yoga', 'crossfit', 'running', 'swimming', 'general-fitness', 'sports']
    },
    secondaryDisciplines: [String],
    currentProgramName: String
  },

  // Primary Goal (Step 3)
  primaryGoal: {
    type: {
      type: String,
      enum: [
        'build-strength', 'build-muscle', 'lose-fat', 'improve-endurance',
        'increase-mobility', 'competition-prep', 'general-health', 'body-recomp', 'sport-performance'
      ]
    },
    targetWeight: Number,
    targetBodyFat: Number,
    competition: {
      type: String,
      date: Date,
      federation: String,
      weightClass: String
    },
    strengthTargets: {
      squat: { current: Number, target: Number, unit: String },
      bench: { current: Number, target: Number, unit: String },
      deadlift: { current: Number, target: Number, unit: String },
      total: { current: Number, target: Number }
    },
    targetDate: Date,
    priority: {
      type: String,
      enum: ['primary', 'secondary']
    }
  },

  // Training Schedule (Step 4)
  schedule: {
    daysPerWeek: {
      type: Number,
      min: 1,
      max: 7
    },
    preferredDays: [{
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    }],
    sessionDuration: {
      type: Number,
      default: 60
    },
    preferredTime: {
      type: String,
      enum: ['early-morning', 'morning', 'lunch', 'afternoon', 'evening', 'late-night', 'flexible']
    }
  },

  // Equipment Access (Step 5)
  equipment: {
    trainingLocation: {
      type: String,
      enum: ['commercial-gym', 'home-gym', 'garage-gym', 'hotel/travel', 'outdoor', 'bodyweight-only']
    },
    availableEquipment: [{
      type: String,
      enum: [
        'barbell', 'squat-rack', 'power-rack', 'bench-press', 'deadlift-platform',
        'dumbbells', 'adjustable-dumbbells', 'kettlebells',
        'cable-machine', 'leg-press', 'smith-machine', 'lat-pulldown', 'rowing-machine',
        'treadmill', 'bike', 'elliptical', 'rower', 'assault-bike',
        'pull-up-bar', 'dip-station', 'resistance-bands', 'trx', 'battle-ropes',
        'yoga-mat', 'foam-roller', 'lacrosse-ball', 'yoga-blocks',
        'safety-squat-bar', 'trap-bar', 'chains', 'bands-for-barbell'
      ]
    }],
    limitations: String
  },

  // Limitations & Injuries (Step 6)
  limitations: {
    injuries: [{
      bodyPart: String,
      description: String,
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'severe', 'recovering']
      },
      avoidMovements: [String]
    }],
    medicalConditions: [String],
    exercisesToAvoid: [String]
  },

  // ═══════════════════════════════════════════════════════════
  // DIETARY PREFERENCES (GOD TIER PERSONALIZATION)
  // ═══════════════════════════════════════════════════════════
  dietaryPreferences: {
    dietType: {
      type: String,
      enum: ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'mediterranean', 'flexible', 'halal', 'kosher']
    },
    allergies: [String],
    intolerances: [String],
    dislikedFoods: [String],
    cuisinePreferences: [{
      type: String,
      enum: ['american', 'mexican', 'italian', 'asian', 'mediterranean', 'indian', 'middle-eastern', 'african', 'caribbean']
    }],
    cookingSkill: {
      type: String,
      enum: ['none', 'basic', 'intermediate', 'advanced']
    },
    mealPrepTime: {
      type: String,
      enum: ['minimal', 'moderate', 'extensive']
    },
    budget: {
      type: String,
      enum: ['tight', 'moderate', 'flexible']
    },
    mealsPerDay: { type: Number, default: 4, min: 2, max: 8 }
  },

  // ═══════════════════════════════════════════════════════════
  // EXERCISE PREFERENCES (GOD TIER PERSONALIZATION)
  // ═══════════════════════════════════════════════════════════
  exercisePreferences: {
    favoriteExercises: [String],
    hatedExercises: [String],
    cardioPreference: {
      type: String,
      enum: ['none', 'liss', 'hiit', 'sports', 'mixed']
    },
    cardioActivities: [{
      type: String,
      enum: ['walking', 'running', 'cycling', 'swimming', 'rowing', 'stairmaster', 'elliptical', 'jump-rope', 'hiking', 'sports']
    }],
    mobilityFocus: [{
      type: String,
      enum: ['hips', 'shoulders', 'ankles', 'thoracic', 'wrists', 'neck', 'lower-back', 'hamstrings']
    }],
    preferredSplit: {
      type: String,
      enum: ['full-body', 'upper-lower', 'ppl', 'bro-split', 'sport-specific', 'ai-decides']
    },
    trainingStyle: {
      type: String,
      enum: ['strength-focused', 'hypertrophy-focused', 'functional', 'athletic', 'balanced']
    }
  },

  // ═══════════════════════════════════════════════════════════
  // BODY COMPOSITION GOALS (GOD TIER PERSONALIZATION)
  // ═══════════════════════════════════════════════════════════
  bodyComposition: {
    currentWeight: Number,
    targetWeight: Number,
    currentBodyFat: Number,
    targetBodyFat: Number,
    goal: {
      type: String,
      enum: ['aggressive-cut', 'moderate-cut', 'slow-cut', 'maintain', 'lean-bulk', 'bulk', 'recomp']
    },
    weeklyWeightChangeTarget: Number,
    deadline: Date,
    weightCutStrategy: {
      type: String,
      enum: ['water-manipulation', 'gradual', 'peak-week', 'none']
    },
    startDate: Date,
    startWeight: Number
  },

  // ═══════════════════════════════════════════════════════════
  // LIFESTYLE FACTORS (GOD TIER PERSONALIZATION)
  // ═══════════════════════════════════════════════════════════
  lifestyle: {
    jobType: {
      type: String,
      enum: ['sedentary', 'lightly-active', 'moderately-active', 'very-active', 'extremely-active']
    },
    stressLevel: {
      type: String,
      enum: ['low', 'moderate', 'high', 'very-high']
    },
    sleepHours: Number,
    sleepQuality: {
      type: String,
      enum: ['poor', 'fair', 'good', 'excellent']
    },
    hobbies: [String],
    otherActivities: [String],
    workSchedule: {
      type: String,
      enum: ['9-5', 'shift-work', 'remote', 'travel-heavy', 'irregular', 'student']
    }
  },

  // ═══════════════════════════════════════════════════════════
  // COMPETITION PREP (GOD TIER - PL/BB/CROSSFIT/OLY)
  // ═══════════════════════════════════════════════════════════
  competitionPrep: {
    isCompeting: { type: Boolean, default: false },
    sport: {
      type: String,
      enum: ['powerlifting', 'bodybuilding', 'crossfit', 'olympic-weightlifting', 'strongman', 'physique', 'bikini', 'classic-physique', 'marathon', 'triathlon', 'mma', 'wrestling', 'other']
    },
    federation: String,
    meetDate: Date,
    meetName: String,
    meetLocation: String,
    currentWeightClass: String,
    targetWeightClass: String,
    qualifyingTotal: Number,
    currentTotal: Number,
    bestTotal: Number,
    weighInType: {
      type: String,
      enum: ['2-hour', '24-hour', 'same-day']
    },
    divisionAge: String,
    divisionExperience: {
      type: String,
      enum: ['open', 'junior', 'sub-junior', 'masters-1', 'masters-2', 'masters-3', 'masters-4', 'novice']
    },
    equipped: { type: Boolean, default: false },
    previousMeets: [{
      date: Date,
      meetName: String,
      total: Number,
      weightClass: String,
      placement: Number,
      squat: Number,
      bench: Number,
      deadlift: Number,
      bombedOut: { type: Boolean, default: false }
    }],
    attemptSelectionPreference: {
      type: String,
      enum: ['conservative', 'moderate', 'aggressive']
    }
  },

  // Onboarding Status
  onboarding: {
    completed: {
      type: Boolean,
      default: false
    },
    currentStep: {
      type: Number,
      default: 1
    },
    completedAt: Date,
    skippedSteps: [Number]
  },

  // Personal Records (PRs)
  personalRecords: [{
    exerciseName: { type: String, required: true },
    exerciseId: String,
    weight: { type: Number, required: true },
    reps: { type: Number, required: true },
    oneRepMax: Number, // Estimated 1RM using Brzycki formula
    date: { type: Date, default: Date.now },
    notes: String
  }],

  // Elite Mode Settings
  eliteMode: {
    enabled: {
      type: Boolean,
      default: false
    },
    showRPE: { type: Boolean, default: true },
    showPercentages: { type: Boolean, default: true },
    showVolumeMetrics: { type: Boolean, default: false },
    showFatigueRatios: { type: Boolean, default: false },
    compactUI: { type: Boolean, default: false },
    skipAnimations: { type: Boolean, default: false },
    showAllExerciseHistory: { type: Boolean, default: true },
    enableVelocityTracking: { type: Boolean, default: false },
    competitionMode: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes - Updated for new structure
userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ coachId: 1 });
userSchema.index({ 'subscription.tier': 1 });
userSchema.index({ 'subscription.status': 1 });

// Hash password on save
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  if (!this.wearableConnections) {
    this.wearableConnections = [];
  }

  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user is a coach
userSchema.methods.isCoach = function() {
  return this.userType === 'coach';
};

// Check if user is an individual (AI-only coaching)
userSchema.methods.isIndividual = function() {
  return this.userType === 'individual';
};

// Check if user is a client (has human coach)
userSchema.methods.isClient = function() {
  return this.userType === 'client';
};

// Check subscription tier limits
userSchema.methods.getClientLimit = function() {
  const limits = {
    'coach_starter': 10,
    'coach_pro': 50,
    'coach_scale': 150,
    'coach_enterprise': Infinity
  };
  return limits[this.subscription?.tier] || 0;
};

// Check if subscription is active
userSchema.methods.hasActiveSubscription = function() {
  return this.subscription?.status === 'active' || this.isTrialActive();
};

// Check if trial is currently active
userSchema.methods.isTrialActive = function() {
  if (this.subscription?.status !== 'trialing') return false;
  if (!this.subscription?.trialEndDate) return false;
  return new Date() < new Date(this.subscription.trialEndDate);
};

// Get remaining trial time in hours
userSchema.methods.getTrialRemainingHours = function() {
  if (!this.isTrialActive()) return 0;
  const remaining = new Date(this.subscription.trialEndDate) - new Date();
  return Math.max(0, Math.round(remaining / (1000 * 60 * 60)));
};

// Check and expire trial if needed
userSchema.methods.checkTrialExpiration = async function() {
  if (this.subscription?.status === 'trialing' && !this.isTrialActive()) {
    this.subscription.status = 'trial_expired';
    this.subscription.tier = 'free';
    await this.save();
    return true; // Trial was expired
  }
  return false;
};

// Get subscription features (returns Pro features during active trial)
userSchema.methods.getSubscriptionFeatures = function() {
  const features = {
    'free': { workoutsPerWeek: 3, aiQueriesPerMonth: 5, wearables: false, mealPlans: false },
    'pro': { workoutsPerWeek: Infinity, aiQueriesPerMonth: 100, wearables: true, mealPlans: true },
    'coach_starter': { clients: 10, aiAssist: true, analytics: 'basic', mealPlans: true },
    'coach_pro': { clients: 50, aiAssist: true, analytics: 'advanced', mealPlans: true },
    'coach_scale': { clients: 150, aiAssist: true, analytics: 'advanced', whiteLabel: false, mealPlans: true },
    'coach_enterprise': { clients: Infinity, aiAssist: true, analytics: 'advanced', whiteLabel: true, mealPlans: true }
  };

  // During active trial, give Pro features regardless of tier
  if (this.isTrialActive()) {
    return { ...features['pro'], isTrial: true, trialHoursRemaining: this.getTrialRemainingHours() };
  }

  return features[this.subscription?.tier] || features['free'];
};

// Ensure wearableConnections is always an array in JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordCode;
  delete obj.resetPasswordExpires;
  delete obj.phoneVerificationCode;
  delete obj.phoneVerificationExpires;

  if (!obj.wearableConnections) {
    obj.wearableConnections = [];
  }

  // Don't expose tokens in regular JSON
  obj.wearableConnections = obj.wearableConnections.map(conn => ({
    provider: conn.provider,
    connected: conn.connected,
    lastSync: conn.lastSync
  }));

  return obj;
};

module.exports = mongoose.model('User', userSchema);
