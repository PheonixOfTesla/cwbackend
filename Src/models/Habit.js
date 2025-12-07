// Src/models/Habit.js - Habit Tracking Model
// Track daily habits with streaks and completion history

const mongoose = require('mongoose');

const habitSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // ═══════════════════════════════════════════════════════════
    // HABIT DEFINITION
    // ═══════════════════════════════════════════════════════════
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    icon: {
        type: String,
        default: 'check-circle' // FontAwesome icon name
    },
    color: {
        type: String,
        default: '#f97316' // ClockWork orange
    },
    category: {
        type: String,
        enum: ['training', 'nutrition', 'recovery', 'mindset', 'lifestyle', 'custom'],
        default: 'custom'
    },

    // ═══════════════════════════════════════════════════════════
    // FREQUENCY & SCHEDULE
    // ═══════════════════════════════════════════════════════════
    frequency: {
        type: String,
        enum: ['daily', 'weekdays', 'weekends', 'specific-days', 'x-per-week'],
        default: 'daily'
    },
    specificDays: [{
        type: String,
        enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    }],
    timesPerWeek: {
        type: Number,
        min: 1,
        max: 7,
        default: 7
    },
    targetTime: {
        type: String // "HH:MM" format
    },

    // ═══════════════════════════════════════════════════════════
    // TRACKING TYPE
    // ═══════════════════════════════════════════════════════════
    trackingType: {
        type: String,
        enum: ['boolean', 'quantity', 'duration', 'rating'],
        default: 'boolean'
    },
    targetValue: {
        type: Number, // For quantity/duration types
        default: 1
    },
    unit: {
        type: String, // "glasses", "minutes", "reps", etc.
        default: ''
    },

    // ═══════════════════════════════════════════════════════════
    // STREAK DATA
    // ═══════════════════════════════════════════════════════════
    currentStreak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },
    lastCompletedDate: {
        type: Date
    },
    streakStartDate: {
        type: Date
    },

    // ═══════════════════════════════════════════════════════════
    // COMPLETION HISTORY (Last 90 days for quick access)
    // ═══════════════════════════════════════════════════════════
    completions: [{
        date: {
            type: Date,
            required: true
        },
        completed: {
            type: Boolean,
            default: false
        },
        value: {
            type: Number // For quantity/duration/rating types
        },
        notes: {
            type: String,
            maxlength: 200
        },
        completedAt: {
            type: Date
        }
    }],

    // ═══════════════════════════════════════════════════════════
    // STATS
    // ═══════════════════════════════════════════════════════════
    totalCompletions: {
        type: Number,
        default: 0
    },
    totalMissed: {
        type: Number,
        default: 0
    },
    completionRate: {
        type: Number,
        default: 0 // Percentage
    },

    // ═══════════════════════════════════════════════════════════
    // REMINDERS
    // ═══════════════════════════════════════════════════════════
    reminderEnabled: {
        type: Boolean,
        default: false
    },
    reminderTime: {
        type: String // "HH:MM" format
    },
    reminderDays: [{
        type: String,
        enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    }],

    // ═══════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════
    isActive: {
        type: Boolean,
        default: true
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    order: {
        type: Number,
        default: 0 // For drag-drop ordering
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
habitSchema.index({ userId: 1, isActive: 1 });
habitSchema.index({ userId: 1, category: 1 });
habitSchema.index({ 'completions.date': 1 });

// ═══════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════

/**
 * Mark habit as completed for a specific date
 */
habitSchema.methods.complete = async function(date = new Date(), value = null, notes = '') {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const existingIndex = this.completions.findIndex(
        c => c.date.toISOString().split('T')[0] === dateStr
    );

    const completion = {
        date: new Date(dateStr),
        completed: true,
        value: value !== null ? value : (this.trackingType === 'boolean' ? 1 : this.targetValue),
        notes,
        completedAt: new Date()
    };

    if (existingIndex >= 0) {
        this.completions[existingIndex] = completion;
    } else {
        this.completions.push(completion);
    }

    // Update streak
    this.updateStreak();
    this.lastCompletedDate = new Date(date);
    this.totalCompletions += 1;
    this.updateCompletionRate();

    // Keep only last 90 days of completions in array
    this.completions = this.completions
        .sort((a, b) => b.date - a.date)
        .slice(0, 90);

    return this.save();
};

/**
 * Mark habit as incomplete for a specific date
 */
habitSchema.methods.uncomplete = async function(date = new Date()) {
    const dateStr = new Date(date).toISOString().split('T')[0];
    const existingIndex = this.completions.findIndex(
        c => c.date.toISOString().split('T')[0] === dateStr
    );

    if (existingIndex >= 0) {
        this.completions[existingIndex].completed = false;
        this.completions[existingIndex].value = 0;
        this.totalCompletions = Math.max(0, this.totalCompletions - 1);
    }

    this.updateStreak();
    this.updateCompletionRate();

    return this.save();
};

/**
 * Update streak based on completions
 */
habitSchema.methods.updateStreak = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let streak = 0;
    let checkDate = new Date(today);

    // Sort completions by date descending
    const sortedCompletions = this.completions
        .filter(c => c.completed)
        .sort((a, b) => b.date - a.date);

    if (sortedCompletions.length === 0) {
        this.currentStreak = 0;
        return;
    }

    // Check if streak should include today
    const mostRecent = new Date(sortedCompletions[0].date);
    mostRecent.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - mostRecent) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) {
        // Streak broken - more than 1 day gap
        this.currentStreak = 0;
        return;
    }

    // Count consecutive days
    for (let i = 0; i < 365; i++) { // Max 1 year streak check
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasCompletion = sortedCompletions.some(
            c => c.date.toISOString().split('T')[0] === dateStr
        );

        // Check if this day should count based on frequency
        if (this.shouldCountDay(checkDate)) {
            if (hasCompletion) {
                streak++;
            } else if (i === 0) {
                // Today not completed yet - don't break streak
            } else {
                // Missed a day - streak ends
                break;
            }
        }

        checkDate.setDate(checkDate.getDate() - 1);
    }

    this.currentStreak = streak;
    if (streak > this.longestStreak) {
        this.longestStreak = streak;
    }
    if (streak > 0 && !this.streakStartDate) {
        this.streakStartDate = new Date();
        this.streakStartDate.setDate(this.streakStartDate.getDate() - streak + 1);
    }
};

/**
 * Check if a day should count for this habit's frequency
 */
habitSchema.methods.shouldCountDay = function(date) {
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];

    switch (this.frequency) {
        case 'daily':
            return true;
        case 'weekdays':
            return !['saturday', 'sunday'].includes(dayName);
        case 'weekends':
            return ['saturday', 'sunday'].includes(dayName);
        case 'specific-days':
            return this.specificDays.includes(dayName);
        default:
            return true;
    }
};

/**
 * Update completion rate
 */
habitSchema.methods.updateCompletionRate = function() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentCompletions = this.completions.filter(c => c.date >= thirtyDaysAgo);
    const completed = recentCompletions.filter(c => c.completed).length;

    // Count expected days based on frequency
    let expectedDays = 30;
    if (this.frequency === 'weekdays') expectedDays = Math.round(30 * 5 / 7);
    if (this.frequency === 'weekends') expectedDays = Math.round(30 * 2 / 7);
    if (this.frequency === 'x-per-week') expectedDays = Math.round(30 * this.timesPerWeek / 7);
    if (this.frequency === 'specific-days') expectedDays = Math.round(30 * this.specificDays.length / 7);

    this.completionRate = Math.round((completed / expectedDays) * 100);
};

/**
 * Get completion status for a date range
 */
habitSchema.methods.getCompletionsForRange = function(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    return this.completions.filter(c => c.date >= start && c.date <= end);
};

// ═══════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════

/**
 * Get all active habits for a user with today's status
 */
habitSchema.statics.getActiveWithStatus = async function(userId) {
    const today = new Date().toISOString().split('T')[0];

    const habits = await this.find({ userId, isActive: true, isArchived: false })
        .sort({ order: 1 });

    return habits.map(habit => {
        const todayCompletion = habit.completions.find(
            c => c.date.toISOString().split('T')[0] === today
        );

        return {
            ...habit.toObject(),
            completedToday: todayCompletion?.completed || false,
            todayValue: todayCompletion?.value || null
        };
    });
};

/**
 * Get habits due today based on frequency
 */
habitSchema.statics.getDueToday = async function(userId) {
    const today = new Date();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];

    const habits = await this.find({
        userId,
        isActive: true,
        isArchived: false,
        $or: [
            { frequency: 'daily' },
            { frequency: 'weekdays', specificDays: { $nin: ['saturday', 'sunday'] } },
            { frequency: 'weekends', specificDays: { $in: ['saturday', 'sunday'] } },
            { frequency: 'specific-days', specificDays: dayName }
        ]
    }).sort({ order: 1 });

    return habits;
};

/**
 * Create default habits for new user
 */
habitSchema.statics.createDefaults = async function(userId, discipline = 'general-fitness') {
    const defaults = [
        {
            name: 'Complete Workout',
            description: 'Finish your scheduled training session',
            icon: 'dumbbell',
            color: '#f97316',
            category: 'training',
            frequency: 'specific-days',
            trackingType: 'boolean'
        },
        {
            name: 'Hit Protein Goal',
            description: 'Consume your daily protein target',
            icon: 'drumstick-bite',
            color: '#22c55e',
            category: 'nutrition',
            frequency: 'daily',
            trackingType: 'boolean'
        },
        {
            name: 'Sleep 7+ Hours',
            description: 'Get adequate recovery sleep',
            icon: 'moon',
            color: '#8b5cf6',
            category: 'recovery',
            frequency: 'daily',
            trackingType: 'boolean'
        },
        {
            name: 'Drink Water',
            description: 'Stay hydrated throughout the day',
            icon: 'tint',
            color: '#3b82f6',
            category: 'nutrition',
            frequency: 'daily',
            trackingType: 'quantity',
            targetValue: 8,
            unit: 'glasses'
        }
    ];

    // Add discipline-specific habits
    if (discipline === 'powerlifting') {
        defaults.push({
            name: 'Mobility Work',
            description: 'Complete mobility routine for powerlifting',
            icon: 'child',
            color: '#ec4899',
            category: 'recovery',
            frequency: 'daily',
            trackingType: 'duration',
            targetValue: 10,
            unit: 'minutes'
        });
    }

    const habits = defaults.map((h, i) => ({
        ...h,
        userId,
        order: i
    }));

    return this.insertMany(habits);
};

module.exports = mongoose.model('Habit', habitSchema);
