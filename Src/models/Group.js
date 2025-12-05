// Src/models/Group.js
const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ['discipline', 'challenge', 'local', 'custom'],
    default: 'custom'
  },
  discipline: {
    type: String,
    enum: ['powerlifting', 'bodybuilding', 'yoga', 'crossfit', 'running', 'general']
  },

  // Visual
  iconUrl: String,
  bannerUrl: String,
  color: String,

  // Membership
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['owner', 'admin', 'moderator', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
    muted: { type: Boolean, default: false }
  }],
  memberCount: { type: Number, default: 0 },

  // Settings
  isPublic: { type: Boolean, default: true },
  isOfficial: { type: Boolean, default: false },
  maxMembers: { type: Number, default: 500 },

  // Activity
  lastActivityAt: Date,
  messageCount: { type: Number, default: 0 }

}, { timestamps: true });

// Pre-built Official Communities
groupSchema.statics.OFFICIAL_COMMUNITIES = [
  {
    name: 'PowerBuilders',
    discipline: 'powerlifting',
    description: 'Strength athletes, USAPL competitors, and anyone chasing PRs',
    isOfficial: true,
    color: '#ef4444'
  },
  {
    name: 'Aesthetics Crew',
    discipline: 'bodybuilding',
    description: 'Bodybuilding, physique, and hypertrophy training',
    isOfficial: true,
    color: '#8b5cf6'
  },
  {
    name: 'Flow State',
    discipline: 'yoga',
    description: 'Yoga, mobility, flexibility, and mindful movement',
    isOfficial: true,
    color: '#10b981'
  },
  {
    name: 'WOD Warriors',
    discipline: 'crossfit',
    description: 'CrossFit, functional fitness, and MetCons',
    isOfficial: true,
    color: '#f59e0b'
  },
  {
    name: 'ClockWork General',
    discipline: 'general',
    description: 'All fitness levels and goals welcome',
    isOfficial: true,
    color: '#3b82f6'
  }
];

// Indexes
groupSchema.index({ discipline: 1 });
groupSchema.index({ isPublic: 1, isOfficial: 1 });
groupSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Group', groupSchema);
