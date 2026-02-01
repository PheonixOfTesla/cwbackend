const mongoose = require('mongoose');

// Exercise sub-schema with flexible validation
const exerciseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Exercise name is required'],
    trim: true,
    default: 'Unnamed Exercise'
  },
  sets: {
    type: Number,
    default: 3,
    min: [1, 'Sets must be at least 1'],
    max: [20, 'Sets cannot exceed 20'],
    get: v => Math.round(v),
    set: v => Math.max(1, parseInt(v) || 3)
  },
  reps: {
    type: String,
    default: '10',
    trim: true,
    // Flexible validation - allows numbers, ranges, time
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        // Allow: "10", "8-12", "30s", "1 min", "AMRAP", etc.
        return /^[\d\s\-a-zA-Z]+$/i.test(v);
      },
      message: 'Invalid reps format'
    }
  },
  weight: {
    type: Number,
    default: 0,
    min: [0, 'Weight cannot be negative'],
    set: v => Math.max(0, parseFloat(v) || 0)
  },
  holdTime: {
    type: Number,
    default: 0,
    min: [0, 'Hold time cannot be negative'],
    max: [600, 'Hold time cannot exceed 10 minutes'],
    set: v => Math.max(0, parseInt(v) || 0)
  },
  notes: {
    type: String,
    maxlength: [500, 'Notes cannot exceed 500 characters'],
    trim: true,
    default: ''
  },
  grouping: {
    type: String,
    enum: {
      values: ['none', 'superset', 'triset', 'circuit', 'A', 'B', 'C', 'D', 'E'],
      message: '{VALUE} is not a valid grouping'
    },
    default: 'none'
  },
  youtubeLink: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: function(v) {
        if (!v || v === '') return true;
        // Very flexible URL validation
        return /^https?:\/\/.+/i.test(v);
      },
      message: 'Please enter a valid URL'
    }
  },
  completed: {
    type: Boolean,
    default: false
  },
  actualSets: [{
    reps: Number,
    weight: Number,
    difficulty: {
      type: Number,
      min: 1,
      max: 5
    },
    painLevel: {
      type: Number,
      min: 0,
      max: 10
    },
    notes: String
  }]
}, { 
  strict: false, // Allow additional fields
  minimize: false // Keep empty objects
});

// Main workout schema
const workoutSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Workout name is required'],
    trim: true,
    maxlength: [100, 'Workout name cannot exceed 100 characters'],
    default: 'Unnamed Workout'
  },
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Client is required'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scheduledDate: {
    type: Date,
    index: true,
    default: Date.now
  },
  exercises: {
    type: [exerciseSchema],
    validate: {
      validator: function(v) {
        return v && v.length > 0;
      },
      message: 'At least one exercise is required'
    },
    default: []
  },
  youtubeLink: {
    type: String,
    default: '',
    trim: true
  },
  completed: {
    type: Boolean,
    default: false,
    index: true
  },
  completedAt: Date,
  completedDate: Date, // Duplicate for compatibility
  startedAt: Date,
  moodFeedback: {
    type: Number,
    min: [1, 'Mood must be at least 1'],
    max: [5, 'Mood cannot exceed 5']
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    trim: true,
    default: ''
  },
  duration: {
    type: Number, // in minutes
    min: [0, 'Duration cannot be negative'],
    max: [480, 'Duration cannot exceed 8 hours']
  },
  averagePainLevel: {
    type: Number,
    min: [0, 'Pain level cannot be negative'],
    max: [10, 'Pain level cannot exceed 10']
  },
  sessionData: [{
    exercise: String,
    set: Number,
    reps: Number,
    weight: Number,
    difficulty: {
      type: Number,
      min: 1,
      max: 5
    },
    painLevel: {
      type: Number,
      min: 0,
      max: 10
    },
    notes: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  repeatWeekly: {
    type: Boolean,
    default: false
  },
  parentWorkout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workout'
  }
}, {
  timestamps: true,
  strict: false, // Allow additional fields
  minimize: false, // Keep empty objects
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
workoutSchema.index({ clientId: 1, scheduledDate: -1 });
workoutSchema.index({ clientId: 1, completed: 1 });
workoutSchema.index({ clientId: 1, createdAt: -1 });
workoutSchema.index({ assignedBy: 1 });
workoutSchema.index({ parentWorkout: 1 });

// Virtual properties
workoutSchema.virtual('exerciseCount').get(function() {
  return this.exercises ? this.exercises.length : 0;
});

workoutSchema.virtual('totalVolume').get(function() {
  if (!this.exercises) return 0;
  
  return this.exercises.reduce((total, exercise) => {
    try {
      let repCount = 0;
      const repsStr = (exercise.reps || '0').toString();
      
      // Handle different rep formats
      if (repsStr.includes('-')) {
        const [min, max] = repsStr.split('-').map(Number);
        repCount = ((min || 0) + (max || 0)) / 2;
      } else if (repsStr.match(/^\d+$/)) {
        repCount = parseInt(repsStr) || 0;
      } else {
        repCount = 10; // Default for AMRAP, time-based, etc.
      }
      
      const sets = exercise.sets || 0;
      const weight = exercise.weight || 0;
      
      return total + (sets * repCount * weight);
    } catch (err) {
      return total; // Skip problematic exercises
    }
  }, 0);
});

// Methods
workoutSchema.methods.markComplete = function(data = {}) {
  this.completed = true;
  this.completedAt = new Date();
  this.completedDate = this.completedAt;
  
  if (data.moodFeedback) this.moodFeedback = data.moodFeedback;
  if (data.notes) this.notes = data.notes;
  if (data.duration) this.duration = data.duration;
  if (data.averagePainLevel) this.averagePainLevel = data.averagePainLevel;
  if (data.sessionData) this.sessionData = data.sessionData;
  
  return this.save();
};

workoutSchema.methods.cloneForDate = function(newDate) {
  const cloned = this.toObject();
  delete cloned._id;
  delete cloned.createdAt;
  delete cloned.updatedAt;
  delete cloned.__v;
  
  cloned.scheduledDate = newDate;
  cloned.completed = false;
  cloned.completedAt = undefined;
  cloned.completedDate = undefined;
  cloned.startedAt = undefined;
  cloned.moodFeedback = undefined;
  cloned.sessionData = [];
  cloned.duration = undefined;
  cloned.averagePainLevel = undefined;
  cloned.parentWorkout = this._id;
  
  // Reset exercise completion
  if (cloned.exercises) {
    cloned.exercises = cloned.exercises.map(ex => ({
      ...ex,
      completed: false,
      actualSets: []
    }));
  }
  
  return cloned;
};

// Pre-save middleware
workoutSchema.pre('save', function(next) {
  try {
    // Ensure assignedBy is set
    if (!this.assignedBy && this.createdBy) {
      this.assignedBy = this.createdBy;
    }
    
    // Ensure exercises array exists
    if (!this.exercises || !Array.isArray(this.exercises)) {
      this.exercises = [];
    }
    
    // Clean up exercise data
    this.exercises = this.exercises.map((exercise, index) => {
      // Ensure exercise has a name
      if (!exercise.name || exercise.name.trim() === '') {
        exercise.name = `Exercise ${index + 1}`;
      }
      
      // Convert reps to string if it's a number
      if (typeof exercise.reps === 'number') {
        exercise.reps = exercise.reps.toString();
      }
      
      // Ensure valid sets
      if (!exercise.sets || exercise.sets < 1) {
        exercise.sets = 3;
      }
      
      // Ensure reps has a value
      if (!exercise.reps) {
        exercise.reps = '10';
      }
      
      return exercise;
    });
    
    // Add default exercise if none exist
    if (this.exercises.length === 0) {
      this.exercises.push({
        name: 'Default Exercise',
        sets: 3,
        reps: '10',
        weight: 0,
        holdTime: 0,
        notes: '',
        grouping: 'none',
        youtubeLink: '',
        completed: false
      });
    }
    
    next();
  } catch (error) {
    console.error('Pre-save error:', error);
    next(); // Continue anyway
  }
});

// Error handling middleware
workoutSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Workout save error:', error);
    // Log but don't block
    next();
  } else {
    next();
  }
});

// Pre-validate middleware
workoutSchema.pre('validate', function(next) {
  try {
    // Auto-fix common issues
    if (!this.name) this.name = 'Unnamed Workout';
    if (!this.scheduledDate) this.scheduledDate = new Date();
    
    next();
  } catch (error) {
    console.error('Pre-validate error:', error);
    next(); // Continue anyway
  }
});

module.exports = mongoose.model('Workout', workoutSchema);
