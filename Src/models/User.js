// Src/models/User.js - FIXED VERSION WITH AUTO-CREATION
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
  
  // Roles
  roles: {
    type: [String],
    enum: ['client', 'specialist', 'admin', 'owner', 'engineer'],
    default: ['client'],
    set: function(roles) {
      if (typeof roles === 'string') {
        return [roles];
      }
      return roles;
    }
  },
  
  // Island-Genesis: Gym Association
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym',
    index: true
  },
  
  // Multi-Gym Access
  additionalGymIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym'
  }],
  
  // Client-Specialist Relationships
  specialistIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  clientIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
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
    sparse: true
  },
  dateOfBirth: {
    type: Date
  },
  height: {
    type: Number
  },
  
  // ✅ FIXED: Wearable Connections with DEFAULT VALUE
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
    default: [] // ✅ THIS FIXES THE 404 ERROR
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
    height: Number,              // stored in cm
    currentWeight: Number,       // stored in kg
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

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ gymId: 1, roles: 1 });
userSchema.index({ specialistIds: 1 });
userSchema.index({ clientIds: 1 });

// ✅ ENHANCED: Ensure wearableConnections exists on save
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  
  // ✅ ENSURE wearableConnections is initialized
  if (!this.wearableConnections) {
    this.wearableConnections = [];
  }
  
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check gym access
userSchema.methods.hasAccessToGym = function(gymId) {
  const gymIdStr = gymId.toString();
  
  if (this.gymId && this.gymId.toString() === gymIdStr) {
    return true;
  }
  
  if (this.additionalGymIds && this.additionalGymIds.length > 0) {
    return this.additionalGymIds.some(id => id.toString() === gymIdStr);
  }
  
  if (this.roles.includes('engineer') || this.roles.includes('owner')) {
    return true;
  }
  
  return false;
};

// Get accessible gym IDs
userSchema.methods.getAccessibleGymIds = function() {
  const gymIds = [];
  
  if (this.gymId) {
    gymIds.push(this.gymId);
  }
  
  if (this.additionalGymIds && this.additionalGymIds.length > 0) {
    gymIds.push(...this.additionalGymIds);
  }
  
  return gymIds;
};

// Check platform admin
userSchema.methods.isPlatformAdmin = function() {
  return this.roles.includes('engineer') || this.roles.includes('owner');
};

// ✅ FIXED: Ensure wearableConnections is always an array in JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordCode;
  delete obj.resetPasswordExpires;
  
  // ✅ Ensure wearableConnections exists
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
