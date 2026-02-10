const mongoose = require('mongoose');

const influencerApplicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['TikTok', 'Instagram', 'YouTube', 'Twitter/X', 'Other']
  },
  followerCount: {
    type: Number,
    required: true,
    min: 0
  },
  engagementRate: {
    type: Number,
    min: 0
  },
  videoLinks: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied'],
    default: 'pending'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  approvalToken: {
    type: String,
    default: null,
    index: true
  },
  approvalTokenExpires: {
    type: Date,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  affiliateCode: {
    type: String,
    trim: true,
    uppercase: true,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

influencerApplicationSchema.index({ email: 1 });
influencerApplicationSchema.index({ status: 1 });

module.exports = mongoose.model('InfluencerApplication', influencerApplicationSchema);
