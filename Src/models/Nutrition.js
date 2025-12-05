const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    protein: {
        target: { type: Number, default: 0 },
        current: { type: Number, default: 0 }
    },
    carbs: {
        target: { type: Number, default: 0 },
        current: { type: Number, default: 0 }
    },
    fat: {
        target: { type: Number, default: 0 },
        current: { type: Number, default: 0 }
    },
    calories: {
        target: { type: Number, default: 0 },
        current: { type: Number, default: 0 }
    },
    mealPlan: {
        breakfast: { type: String, default: '' },
        lunch: { type: String, default: '' },
        dinner: { type: String, default: '' },
        snacks: { type: String, default: '' }
    },
    dailyLogs: [{
        date: {
            type: Date,
            default: Date.now
        },
        protein: Number,
        carbs: Number,
        fat: Number,
        calories: Number,
        notes: String
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp on save
nutritionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Nutrition', nutritionSchema);
