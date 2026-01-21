const mongoose = require('mongoose');

const calendarEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // Note: Index is created by compound indexes below (userId + date, etc.)
  },

  // Event Type
  type: {
    type: String,
    enum: ['workout', 'rest-day', 'deload', 'competition', 'weigh-in', 'check-in', 'cardio', 'nutrition'],
    required: true
  },

  // Nutrition meal data (for type='nutrition')
  mealData: {
    mealType: { type: String, enum: ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'] },
    name: String,
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    ingredients: [String],
    prepTime: Number,
    imageUrl: String
  },

  // Link to actual workout if type is 'workout'
  workoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout' },

  // Workout exercises (for inline display without needing to load Workout)
  exercises: [{
    name: String,
    sets: Number,
    reps: String,
    rest: String,
    weight: Number,
    notes: String
  }],

  // Event Details
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  date: { type: Date, required: true, index: true },
  startTime: { type: String, trim: true },  // "09:00" (24hr format)
  duration: { type: Number, min: 0 },       // minutes

  // Recurrence for training splits
  recurring: { type: Boolean, default: false },
  recurrenceRule: {
    frequency: { type: String, enum: ['daily', 'weekly'] },
    interval: { type: Number, default: 1 },  // every X weeks
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],   // 0=Sun, 1=Mon... 6=Sat
    endDate: Date,
    exceptions: [Date]      // Skip these dates
  },

  // Status tracking
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'skipped', 'in-progress'],
    default: 'scheduled'
  },
  completedAt: Date,
  skippedReason: { type: String, trim: true },

  // AI can suggest events
  aiGenerated: { type: Boolean, default: false },
  aiReason: { type: String, trim: true },   // "Recovery low - added rest day"

  // Color for calendar display
  color: { type: String, default: '#3b82f6' }

}, { timestamps: true });

// Compound index for fast calendar queries
calendarEventSchema.index({ userId: 1, date: 1 });
calendarEventSchema.index({ userId: 1, date: 1, type: 1 });
calendarEventSchema.index({ userId: 1, status: 1, date: 1 });

// Virtual for checking if event is in the past
calendarEventSchema.virtual('isPast').get(function() {
  return this.date < new Date();
});

// Virtual for checking if event is today
calendarEventSchema.virtual('isToday').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(this.date);
  eventDate.setHours(0, 0, 0, 0);
  return today.getTime() === eventDate.getTime();
});

// Instance method to mark as completed
calendarEventSchema.methods.markComplete = function() {
  this.status = 'completed';
  this.completedAt = new Date();
  return this.save();
};

// Instance method to skip event
calendarEventSchema.methods.skip = function(reason) {
  this.status = 'skipped';
  this.skippedReason = reason || 'No reason provided';
  return this.save();
};

// Static method to get events for a date range
calendarEventSchema.statics.getForDateRange = function(userId, startDate, endDate) {
  return this.find({
    userId,
    date: { $gte: startDate, $lte: endDate }
  })
  .populate('workoutId')
  .sort('date startTime');
};

// Static method to get today's events
calendarEventSchema.statics.getTodayEvents = function(userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.find({
    userId,
    date: { $gte: today, $lt: tomorrow }
  })
  .populate('workoutId')
  .sort('startTime');
};

// Static method to get upcoming events
calendarEventSchema.statics.getUpcoming = function(userId, limit = 5) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return this.find({
    userId,
    date: { $gte: now },
    status: 'scheduled'
  })
  .populate('workoutId')
  .sort('date startTime')
  .limit(limit);
};

// Get event color based on type
calendarEventSchema.methods.getDisplayColor = function() {
  const colors = {
    'workout': '#3b82f6',      // Blue
    'rest-day': '#10b981',     // Green
    'deload': '#f59e0b',       // Amber
    'competition': '#ef4444', // Red
    'weigh-in': '#8b5cf6',    // Purple
    'check-in': '#06b6d4',    // Cyan
    'cardio': '#ec4899',      // Pink
    'nutrition': '#22c55e'    // Green (food)
  };
  return this.color || colors[this.type] || '#6b7280';
};

// JSON serialization
calendarEventSchema.set('toJSON', { virtuals: true });
calendarEventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CalendarEvent', calendarEventSchema);
