const mongoose = require('mongoose');

const coachApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  // Professional Info
  specialties: [{
    type: String,
    trim: true
  }],
  certifications: [{
    name: { type: String, required: true },
    issuer: { type: String },
    date: { type: Date },
    expirationDate: { type: Date }
  }],

  // Experience
  experience: {
    yearsCoaching: { type: Number, default: 0 },
    bio: { type: String, maxlength: 2000 },
    philosophy: { type: String, maxlength: 1000 }
  },

  // Gym Affiliation
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym'
  },
  affiliationType: {
    type: String,
    enum: ['independent', 'gym_affiliated'],
    default: 'independent'
  },

  // Review
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: {
    type: Date
  },
  reviewNotes: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
coachApplicationSchema.index({ status: 1, createdAt: -1 });
coachApplicationSchema.index({ userId: 1 });

module.exports = mongoose.model('CoachApplication', coachApplicationSchema);
