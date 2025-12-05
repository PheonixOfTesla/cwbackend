const mongoose = require('mongoose');

const wearableDataSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    provider: {
        type: String,
        enum: ['fitbit', 'apple', 'garmin', 'whoop', 'oura', 'polar', 'manual'],
        required: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    
    // Activity Metrics
    steps: { type: Number, default: 0 },
    distance: { type: Number, default: 0 }, // in miles
    activeMinutes: { type: Number, default: 0 },
    caloriesBurned: { type: Number, default: 0 },
    
    // Heart Rate
    restingHeartRate: { type: Number },
    averageHeartRate: { type: Number },
    maxHeartRate: { type: Number },
    heartRateZones: [{
        name: String,
        min: Number,
        max: Number,
        minutes: Number
    }],
    
    // Sleep
    sleepDuration: { type: Number }, // in minutes
    deepSleep: { type: Number },
    lightSleep: { type: Number },
    remSleep: { type: Number },
    awakeTime: { type: Number }, // NEW for IMG Academy
    sleepScore: { type: Number }, // 0-100, NEW for IMG Academy
    sleepEfficiency: { type: Number }, // NEW for IMG Academy
    
    // Recovery (NEW for IMG Academy)
    hrv: { type: Number }, // Heart Rate Variability
    recoveryScore: { type: Number }, // 0-100, NEW
    strain: { type: Number }, // 0-21 (WHOOP style)
    trainingLoad: { type: Number }, // 0-100, NEW for IMG Academy
    
    // Body Metrics
    weight: { type: Number },
    bodyFat: { type: Number },
    
    // Raw Data Storage (for provider-specific data)
    rawData: { type: mongoose.Schema.Types.Mixed },
    
    // Sync Info
    lastSynced: {
        type: Date,
        default: Date.now
    },
    syncStatus: {
        type: String,
        enum: ['success', 'partial', 'failed'],
        default: 'success'
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
wearableDataSchema.index({ userId: 1, date: -1 });
wearableDataSchema.index({ userId: 1, provider: 1, date: -1 });

module.exports = mongoose.model('WearableData', wearableDataSchema);
