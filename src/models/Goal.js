const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
        // Not required - for self-created goals, this equals clientId
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    target: {
        type: Number,
        required: true
    },
    current: {
        type: Number,
        required: true,
        default: 0
    },
    startingValue: {
        type: Number,
        default: 0
    },
    deadline: {
        type: Date,
        required: true
    },
    progressHistory: [{
        date: {
            type: Date,
            default: Date.now
        },
        value: Number,
        notes: String
    }],
    completed: {
        type: Boolean,
        default: false
    },
    completedDate: Date,
    scheduledDays: [String],  // For habits
    completions: {  // For habit tracking
        type: Map,
        of: Boolean,
        default: new Map()
    },
    isHabit: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-update completed status
goalSchema.pre('save', function(next) {
    // Update timestamp
    this.updatedAt = new Date();
    
    // Skip completion check for habits
    if (this.isHabit) {
        return next();
    }
    
    // For decrease goals (e.g., lose weight)
    if (this.startingValue > this.target && this.current <= this.target && !this.completed) {
        this.completed = true;
        this.completedDate = new Date();
    }
    // For increase goals (e.g., gain muscle)
    else if (this.startingValue <= this.target && this.current >= this.target && !this.completed) {
        this.completed = true;
        this.completedDate = new Date();
    }
    // Reset completed if progress reversed
    else if (this.completed) {
        if ((this.startingValue > this.target && this.current > this.target) ||
            (this.startingValue <= this.target && this.current < this.target)) {
            this.completed = false;
            this.completedDate = null;
        }
    }
    
    next();
});

module.exports = mongoose.model('Goal', goalSchema);