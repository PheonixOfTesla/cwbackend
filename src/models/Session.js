// Src/models/Session.js - Coach-Client Session Bookings
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  // ═══════════════════════════════════════════════════════════
  // CORE RELATIONSHIPS
  // ═══════════════════════════════════════════════════════════
  coach: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  coachClientRelationship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoachClient',
    required: true
  },

  // ═══════════════════════════════════════════════════════════
  // SESSION DETAILS
  // ═══════════════════════════════════════════════════════════
  scheduledDate: {
    type: Date,
    required: true,
    index: true
  },

  duration: {
    type: Number, // in minutes
    required: true,
    enum: [30, 45, 60, 90, 120],
    default: 60
  },

  sessionType: {
    type: String,
    enum: ['in-person', 'virtual', 'hybrid'],
    default: 'in-person'
  },

  location: {
    type: String,
    maxlength: 200
  },

  meetingLink: {
    type: String,
    maxlength: 500
  },

  // ═══════════════════════════════════════════════════════════
  // SESSION STATUS
  // ═══════════════════════════════════════════════════════════
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
    default: 'pending',
    index: true
  },

  // Auto-approved or requires coach confirmation
  requiresApproval: {
    type: Boolean,
    default: true
  },

  approvedAt: Date,
  cancelledAt: Date,
  cancelledBy: {
    type: String,
    enum: ['coach', 'client']
  },
  cancellationReason: {
    type: String,
    maxlength: 500
  },

  completedAt: Date,

  // ═══════════════════════════════════════════════════════════
  // PAYMENT TRACKING
  // ═══════════════════════════════════════════════════════════
  payment: {
    amount: {
      type: Number,
      required: true,
      min: 0
    },

    method: {
      type: String,
      enum: ['venmo', 'cashapp', 'paypal', 'zelle', 'cash', 'other']
    },

    status: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'waived'],
      default: 'pending'
    },

    paidAt: Date,

    // Payment confirmation (e.g., transaction ID, screenshot reference)
    confirmationNote: String
  },

  // ═══════════════════════════════════════════════════════════
  // SESSION NOTES & FEEDBACK
  // ═══════════════════════════════════════════════════════════
  clientNotes: {
    type: String,
    maxlength: 1000
  },

  coachNotes: {
    type: String,
    maxlength: 1000
  },

  // Post-session feedback
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxlength: 500
    },
    submittedAt: Date
  },

  // ═══════════════════════════════════════════════════════════
  // REMINDERS & NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════
  reminders: {
    sent24h: {
      type: Boolean,
      default: false
    },
    sent1h: {
      type: Boolean,
      default: false
    }
  }

}, {
  timestamps: true
});

// ═══════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════
sessionSchema.index({ coach: 1, scheduledDate: 1 });
sessionSchema.index({ client: 1, scheduledDate: 1 });
sessionSchema.index({ status: 1, scheduledDate: 1 });
sessionSchema.index({ 'payment.status': 1 });

// ═══════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════

// Confirm session
sessionSchema.methods.confirm = async function() {
  this.status = 'confirmed';
  this.approvedAt = new Date();
  return this.save();
};

// Complete session
sessionSchema.methods.complete = async function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Cancel session
sessionSchema.methods.cancel = async function(cancelledBy, reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  this.cancellationReason = reason;
  return this.save();
};

// Mark as paid
sessionSchema.methods.markPaid = async function(method, confirmationNote) {
  this.payment.status = 'paid';
  this.payment.method = method;
  this.payment.paidAt = new Date();
  if (confirmationNote) {
    this.payment.confirmationNote = confirmationNote;
  }
  return this.save();
};

// ═══════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════

// Get upcoming sessions for coach
sessionSchema.statics.getUpcomingForCoach = function(coachId, limit = 10) {
  return this.find({
    coach: coachId,
    scheduledDate: { $gte: new Date() },
    status: { $in: ['pending', 'confirmed'] }
  })
  .populate('client', 'name email profile')
  .sort({ scheduledDate: 1 })
  .limit(limit);
};

// Get upcoming sessions for client
sessionSchema.statics.getUpcomingForClient = function(clientId, limit = 10) {
  return this.find({
    client: clientId,
    scheduledDate: { $gte: new Date() },
    status: { $in: ['pending', 'confirmed'] }
  })
  .populate('coach', 'name email coachProfile')
  .sort({ scheduledDate: 1 })
  .limit(limit);
};

// Check for scheduling conflicts
sessionSchema.statics.hasConflict = async function(coachId, scheduledDate, duration) {
  const sessionStart = new Date(scheduledDate);
  const sessionEnd = new Date(sessionStart.getTime() + duration * 60000);

  const conflict = await this.findOne({
    coach: coachId,
    status: { $in: ['pending', 'confirmed'] },
    $or: [
      // New session starts during existing session
      {
        scheduledDate: { $lte: sessionStart },
        $expr: {
          $gte: [
            { $add: ['$scheduledDate', { $multiply: ['$duration', 60000] }] },
            sessionStart
          ]
        }
      },
      // New session ends during existing session
      {
        scheduledDate: { $lte: sessionEnd },
        $expr: {
          $gte: [
            { $add: ['$scheduledDate', { $multiply: ['$duration', 60000] }] },
            sessionEnd
          ]
        }
      },
      // New session completely contains existing session
      {
        scheduledDate: { $gte: sessionStart, $lte: sessionEnd }
      }
    ]
  });

  return !!conflict;
};

// Get revenue stats for coach
sessionSchema.statics.getRevenueStats = async function(coachId, startDate, endDate) {
  const sessions = await this.find({
    coach: coachId,
    scheduledDate: { $gte: startDate, $lte: endDate },
    status: 'completed'
  });

  const totalSessions = sessions.length;
  const paidSessions = sessions.filter(s => s.payment.status === 'paid').length;
  const totalRevenue = sessions.reduce((sum, s) => {
    return s.payment.status === 'paid' ? sum + s.payment.amount : sum;
  }, 0);
  const pendingRevenue = sessions.reduce((sum, s) => {
    return s.payment.status === 'pending' ? sum + s.payment.amount : sum;
  }, 0);

  return {
    totalSessions,
    paidSessions,
    unpaidSessions: totalSessions - paidSessions,
    totalRevenue,
    pendingRevenue,
    averageSessionPrice: totalSessions > 0 ? totalRevenue / paidSessions : 0
  };
};

module.exports = mongoose.model('Session', sessionSchema);
