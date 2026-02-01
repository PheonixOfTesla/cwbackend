const mongoose = require('mongoose');

const coachProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Display Info
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  tagline: {
    type: String,
    maxlength: 150
  },
  bio: {
    type: String,
    maxlength: 2000
  },
  profileImage: {
    type: String
  },
  coverImage: {
    type: String
  },

  // Specialties & Skills
  specialties: [{
    type: String,
    trim: true
  }],

  // Cal.com Integration
  calcomUsername: {
    type: String,
    trim: true
  },

  // Stripe Connect
  stripeConnectAccountId: {
    type: String
  },
  stripeOnboardingComplete: {
    type: Boolean,
    default: false
  },

  // Gym Affiliation
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym'
  },
  isIndependent: {
    type: Boolean,
    default: true
  },

  // Stats (denormalized for performance)
  totalClients: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },

  // Availability
  isAcceptingClients: {
    type: Boolean,
    default: true
  },

  // Social Links
  socialLinks: {
    instagram: String,
    youtube: String,
    twitter: String,
    website: String
  },

  // Contact Preferences
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true
  },

  // Search & Discovery
  isPublic: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for marketplace queries
coachProfileSchema.index({ isPublic: 1, isAcceptingClients: 1 });
coachProfileSchema.index({ specialties: 1 });
coachProfileSchema.index({ averageRating: -1 });
coachProfileSchema.index({ featured: -1, createdAt: -1 });

// Virtual for full name from user
coachProfileSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('CoachProfile', coachProfileSchema);
