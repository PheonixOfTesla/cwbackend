const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    // Link to exercise library for video demonstrations
    exerciseId: {
        type: String,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Exercise name is required'],
        trim: true
    },
    sets: {
        type: Number,
        required: [true, 'Number of sets is required'],
        min: [1, 'Sets must be at least 1'],
        max: [20, 'Sets cannot exceed 20']
    },
    reps: {
        type: String,
        required: [true, 'Reps are required'],
        trim: true,
        validate: {
            validator: function(v) {
                // Accepts: "10", "8-12", "30s", "1 min", "AMRAP", etc.
                return /^(\d+(-\d+)?|[\d\s]+(s|sec|seconds|min|minutes)?|AMRAP|Max)$/i.test(v);
            },
            message: 'Reps must be a number, range (8-12), time (30s), or AMRAP/Max'
        }
    },
    weight: {
        type: Number,
        default: 0,
        min: [0, 'Weight cannot be negative']
    },
    holdTime: {
        type: Number,
        default: 0,
        min: [0, 'Hold time cannot be negative'],
        max: [600, 'Hold time cannot exceed 10 minutes']
    },
    notes: {
        type: String,
        maxlength: [1000, 'Notes cannot exceed 1000 characters'],
        trim: true
    },
    // FIXED: Support letter-based grouping (A-E) or none
    grouping: {
        type: String,
        enum: ['none', 'A', 'B', 'C', 'D', 'E'],
        default: 'none'
    },
    // Optional: Keep these for backward compatibility
    groupId: String,
    groupType: String,
    
    // Video link for exercise demonstration
    youtubeLink: {
        type: String,
        trim: true,
        validate: {
            validator: function(v) {
                if (!v || v === '') return true;
                return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/.+/.test(v);
            },
            message: 'Please enter a valid YouTube or Vimeo URL'
        }
    },
    
    // Track actual performance during workout
    actualSets: [{
        setNumber: Number,
        reps: Number,
        weight: Number,
        completed: { type: Boolean, default: true },
        notes: String,
        timestamp: { type: Date, default: Date.now }
    }],
    
    // Mark if exercise was completed
    completed: {
        type: Boolean,
        default: false
    }
}, { _id: false }); // No separate _id for subdocuments

const workoutSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Workout name is required'],
        trim: true,
        maxlength: [100, 'Workout name cannot exceed 100 characters']
    },
    
    // Client this workout is assigned to
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Client is required'],
        index: true
    },
    
    // Who created this workout
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Creator is required']
    },
    
    // Who assigned this workout (usually same as createdBy)
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // When this workout is scheduled
    scheduledDate: {
        type: Date,
        index: true
    },
    
    // List of exercises in this workout
    exercises: {
        type: [exerciseSchema],
        validate: {
            validator: function(v) {
                return v && v.length > 0;
            },
            message: 'At least one exercise is required'
        }
    },
    
    // Optional: Video link for entire workout
    youtubeLink: {
        type: String,
        default: '',
        trim: true,
        validate: {
            validator: function(v) {
                if (!v || v === '') return true;
                return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\/.+/.test(v);
            },
            message: 'Please enter a valid YouTube or Vimeo URL'
        }
    },
    
    // Completion tracking
    completed: {
        type: Boolean,
        default: false,
        index: true
    },
    
    completedAt: {
        type: Date
    },
    
    // Workout started timestamp
    startedAt: {
        type: Date
    },
    
    // How long the workout took (in minutes)
    duration: {
        type: Number,
        min: [0, 'Duration cannot be negative'],
        max: [480, 'Duration cannot exceed 8 hours']
    },
    
    // Client's mood after workout (1-5 scale)
    moodFeedback: {
        type: Number,
        min: [1, 'Mood must be at least 1'],
        max: [5, 'Mood cannot exceed 5']
    },
    
    // General notes about the workout
    notes: {
        type: String,
        maxlength: [2000, 'Notes cannot exceed 2000 characters'],
        trim: true
    },
    
    // Average pain level during workout (0-10 scale)
    averagePainLevel: {
        type: Number,
        min: [0, 'Pain level cannot be negative'],
        max: [10, 'Pain level cannot exceed 10']
    },
    
    // Detailed session data from live workout tracking
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
    
    // Repeat this workout weekly
    repeatWeekly: {
        type: Boolean,
        default: false
    },
    
    // If this is a recurring workout, link to parent
    parentWorkout: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Workout'
    },
    
    // Soft delete
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// ============================================
// INDEXES FOR PERFORMANCE
// ============================================
workoutSchema.index({ clientId: 1, scheduledDate: -1 });
workoutSchema.index({ clientId: 1, completed: 1 });
workoutSchema.index({ createdBy: 1 });
workoutSchema.index({ clientId: 1, createdAt: -1 });
workoutSchema.index({ scheduledDate: 1, completed: 1 });

// ============================================
// VIRTUALS
// ============================================

// Count of exercises
workoutSchema.virtual('exerciseCount').get(function() {
    return this.exercises ? this.exercises.length : 0;
});

// Total volume calculation (sets × reps × weight)
workoutSchema.virtual('totalVolume').get(function() {
    if (!this.exercises) return 0;
    return this.exercises.reduce((total, exercise) => {
        let repCount = 0;
        if (exercise.reps) {
            const repsStr = exercise.reps.toString();
            if (repsStr.includes('-')) {
                const [min, max] = repsStr.split('-').map(Number);
                repCount = (min + max) / 2;
            } else {
                repCount = parseInt(repsStr) || 0;
            }
        }
        return total + (exercise.sets * repCount * (exercise.weight || 0));
    }, 0);
});

// Check if workout is overdue
workoutSchema.virtual('isOverdue').get(function() {
    if (this.completed) return false;
    if (!this.scheduledDate) return false;
    return new Date() > new Date(this.scheduledDate);
});

// Days until/since scheduled date
workoutSchema.virtual('daysUntilScheduled').get(function() {
    if (!this.scheduledDate) return null;
    const now = new Date();
    const scheduled = new Date(this.scheduledDate);
    const diffTime = scheduled - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
});

// ============================================
// INSTANCE METHODS
// ============================================

// Mark workout as complete
workoutSchema.methods.markComplete = function(data = {}) {
    this.completed = true;
    this.completedAt = new Date();
    
    if (data.moodFeedback) this.moodFeedback = data.moodFeedback;
    if (data.notes) this.notes = data.notes;
    if (data.duration) this.duration = data.duration;
    if (data.averagePainLevel !== undefined) this.averagePainLevel = data.averagePainLevel;
    if (data.sessionData) this.sessionData = data.sessionData;
    
    return this.save();
};

// Clone workout for a new date (for recurring workouts)
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
    cloned.duration = undefined;
    cloned.averagePainLevel = undefined;
    cloned.sessionData = [];
    cloned.notes = '';
    cloned.parentWorkout = this._id;
    
    // Reset exercise completion tracking
    if (cloned.exercises) {
        cloned.exercises = cloned.exercises.map(exercise => {
            const ex = { ...exercise };
            ex.actualSets = [];
            ex.completed = false;
            return ex;
        });
    }
    
    return cloned;
};

// Get grouped exercises (by grouping letter)
workoutSchema.methods.getGroupedExercises = function() {
    if (!this.exercises) return {};
    
    const grouped = {};
    
    this.exercises.forEach((exercise, index) => {
        const group = exercise.grouping || 'none';
        if (!grouped[group]) {
            grouped[group] = [];
        }
        grouped[group].push({
            ...exercise.toObject(),
            originalIndex: index
        });
    });
    
    return grouped;
};

// Calculate workout progress percentage
workoutSchema.methods.getProgressPercentage = function() {
    if (!this.exercises || this.exercises.length === 0) return 0;
    
    const completedExercises = this.exercises.filter(ex => ex.completed).length;
    return Math.round((completedExercises / this.exercises.length) * 100);
};

// ============================================
// STATIC METHODS
// ============================================

// Get upcoming workouts for a client
workoutSchema.statics.getUpcoming = function(clientId, days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.find({
        clientId,
        completed: false,
        scheduledDate: {
            $gte: new Date(),
            $lte: futureDate
        }
    }).sort('scheduledDate');
};

// Get overdue workouts for a client
workoutSchema.statics.getOverdue = function(clientId) {
    return this.find({
        clientId,
        completed: false,
        scheduledDate: { $lt: new Date() }
    }).sort('scheduledDate');
};

// Get workout completion rate for a client
workoutSchema.statics.getCompletionRate = async function(clientId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const total = await this.countDocuments({
        clientId,
        scheduledDate: { $gte: startDate }
    });
    
    const completed = await this.countDocuments({
        clientId,
        completed: true,
        scheduledDate: { $gte: startDate }
    });
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
};

// ============================================
// PRE-SAVE MIDDLEWARE
// ============================================

workoutSchema.pre('save', function(next) {
    // Auto-set completedAt if marking as completed
    if (this.isModified('completed') && this.completed && !this.completedAt) {
        this.completedAt = new Date();
    }
    
    // Auto-set assignedBy if not set
    if (!this.assignedBy && this.createdBy) {
        this.assignedBy = this.createdBy;
    }
    
    next();
});

// ============================================
// POST-SAVE MIDDLEWARE
// ============================================

workoutSchema.post('save', function(doc) {
    console.log(`✅ Workout saved: ${doc.name} (${doc._id})`);
});

// ============================================
// CONFIGURATION
// ============================================

workoutSchema.set('toJSON', { 
    virtuals: true,
    transform: function(doc, ret) {
        // Remove sensitive or unnecessary fields
        delete ret.__v;
        return ret;
    }
});

workoutSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Workout', workoutSchema);
