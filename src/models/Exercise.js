const mongoose = require('mongoose');

const exerciseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    muscleCategory: {
        type: String,
        required: true
    },
    secondaryMuscles: [String], // New: muscles also worked
    equipmentNeeded: {
        type: String,
        enum: ['none', 'barbell', 'dumbbells', 'machine', 'cable', 'bands', 'bodyweight', 'other'],
        default: 'none'
    },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'intermediate'
    },
    description: {
        type: String,
        required: true
    },
    instructions: [String], // New: Step-by-step instructions
    tips: [String], // New: Pro tips
    commonMistakes: [String], // New: What to avoid
    imageUrl: String,
    videoUrl: String, // New: Demo video
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    tags: [String], // New: For better search
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add text index for better search
exerciseSchema.index({ name: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Exercise', exerciseSchema);