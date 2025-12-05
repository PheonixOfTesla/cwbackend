// Src/models/CoachClient.js - Coach-Client Relationship Model
const mongoose = require('mongoose');

const coachClientSchema = new mongoose.Schema({
  // The coach (must be userType: 'coach')
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // The client (must be userType: 'client')
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Relationship status
  status: {
    type: String,
    enum: ['pending', 'active', 'paused', 'ended'],
    default: 'pending'
  },

  // Invitation tracking
  invitedAt: {
    type: Date,
    default: Date.now
  },
  invitationEmail: String,
  invitationCode: String,

  // Relationship timeline
  acceptedAt: Date,
  startDate: Date,
  endDate: Date,
  pausedAt: Date,

  // Coach notes about this client
  coachNotes: {
    type: String,
    maxlength: 5000
  },

  // Current program assigned
  currentProgram: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Program'
  },

  // Client goals set by coach
  assignedGoals: [{
    goal: String,
    targetDate: Date,
    priority: {
      type: String,
      enum: ['primary', 'secondary', 'tertiary']
    },
    status: {
      type: String,
      enum: ['active', 'achieved', 'abandoned'],
      default: 'active'
    }
  }],

  // Communication preferences
  communicationPreferences: {
    checkInFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly', 'monthly'],
      default: 'weekly'
    },
    preferredMethod: {
      type: String,
      enum: ['in-app', 'email', 'both'],
      default: 'in-app'
    },
    lastCheckIn: Date,
    nextScheduledCheckIn: Date
  },

  // Billing (if coach charges clients separately)
  billing: {
    rate: Number,
    frequency: {
      type: String,
      enum: ['monthly', 'per-session', 'package']
    },
    stripeSubscriptionId: String
  }
}, {
  timestamps: true
});

// Compound unique index - one relationship per coach-client pair
coachClientSchema.index({ coach: 1, client: 1 }, { unique: true });

// Index for finding active relationships
coachClientSchema.index({ coach: 1, status: 1 });
coachClientSchema.index({ client: 1, status: 1 });

// Index for invitation lookup
coachClientSchema.index({ invitationCode: 1 }, { sparse: true });

// Virtual for relationship duration
coachClientSchema.virtual('durationDays').get(function() {
  if (!this.startDate) return 0;
  const end = this.endDate || new Date();
  return Math.floor((end - this.startDate) / (1000 * 60 * 60 * 24));
});

// Static method to get coach's active clients
coachClientSchema.statics.getActiveClients = function(coachId) {
  return this.find({ coach: coachId, status: 'active' })
    .populate('client', 'name email profile experience onboarding')
    .sort({ startDate: -1 });
};

// Static method to get client's coach
coachClientSchema.statics.getClientCoach = function(clientId) {
  return this.findOne({ client: clientId, status: 'active' })
    .populate('coach', 'name email');
};

// Static method to count coach's clients
coachClientSchema.statics.countActiveClients = function(coachId) {
  return this.countDocuments({ coach: coachId, status: 'active' });
};

// Instance method to activate relationship
coachClientSchema.methods.activate = function() {
  this.status = 'active';
  this.acceptedAt = new Date();
  this.startDate = new Date();
  return this.save();
};

// Instance method to pause relationship
coachClientSchema.methods.pause = function() {
  this.status = 'paused';
  this.pausedAt = new Date();
  return this.save();
};

// Instance method to end relationship
coachClientSchema.methods.end = function() {
  this.status = 'ended';
  this.endDate = new Date();
  return this.save();
};

module.exports = mongoose.model('CoachClient', coachClientSchema);
