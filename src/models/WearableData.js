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

    // ============================================
    // ACTIVITY METRICS (Fitbit Activity API)
    // ============================================
    steps: { type: Number, default: 0 },
    distance: { type: Number, default: 0 }, // miles
    floors: { type: Number, default: 0 },
    elevation: { type: Number, default: 0 }, // feet
    caloriesBurned: { type: Number, default: 0 },
    caloriesIn: { type: Number, default: 0 }, // nutrition
    caloriesDeficit: { type: Number, default: 0 },
    activeMinutes: { type: Number, default: 0 },
    lightlyActiveMinutes: { type: Number, default: 0 },
    fairlyActiveMinutes: { type: Number, default: 0 },
    veryActiveMinutes: { type: Number, default: 0 },
    sedentaryMinutes: { type: Number, default: 0 },

    // Active Zone Minutes (Fitbit Premium metric)
    activeZoneMinutes: {
        total: { type: Number, default: 0 },
        fatBurn: { type: Number, default: 0 },
        cardio: { type: Number, default: 0 },
        peak: { type: Number, default: 0 }
    },

    // Activity Goals
    goals: {
        steps: { type: Number },
        distance: { type: Number },
        calories: { type: Number },
        activeMinutes: { type: Number },
        floors: { type: Number }
    },

    // ============================================
    // HEART RATE (Fitbit Heart Rate API)
    // ============================================
    restingHeartRate: { type: Number },
    averageHeartRate: { type: Number },
    maxHeartRate: { type: Number },
    minHeartRate: { type: Number },
    heartRateZones: [{
        name: String,        // Out of Range, Fat Burn, Cardio, Peak
        min: Number,
        max: Number,
        minutes: Number,
        caloriesOut: Number
    }],

    // Intraday heart rate (5-min intervals)
    heartRateIntraday: [{
        time: String,        // "HH:MM:SS"
        value: Number
    }],

    // ============================================
    // HEART RATE VARIABILITY (Fitbit HRV API)
    // ============================================
    hrv: { type: Number },           // Daily RMSSD (root mean square of successive differences)
    hrvDeepSleep: { type: Number },  // HRV during deep sleep
    hrvRem: { type: Number },        // HRV during REM
    hrvLight: { type: Number },      // HRV during light sleep
    hrvBaseline: { type: Number },   // Personal baseline
    hrvStatus: { type: String, enum: ['low', 'normal', 'elevated', null] },

    // Intraday HRV (5-min intervals during sleep)
    hrvIntraday: [{
        time: String,
        rmssd: Number,
        coverage: Number,    // % of interval covered
        hf: Number,          // High frequency power
        lf: Number           // Low frequency power
    }],

    // ============================================
    // SLEEP (Fitbit Sleep API)
    // ============================================
    sleepDuration: { type: Number }, // total minutes
    timeInBed: { type: Number },
    sleepStartTime: { type: String },
    sleepEndTime: { type: String },

    // Sleep stages
    deepSleep: { type: Number },
    lightSleep: { type: Number },
    remSleep: { type: Number },
    awakeTime: { type: Number },

    // Sleep metrics
    sleepScore: { type: Number },        // 0-100
    sleepEfficiency: { type: Number },   // % time asleep vs in bed
    restlessCount: { type: Number },
    restlessMinutes: { type: Number },
    awakeDuration: { type: Number },
    awakeningsCount: { type: Number },

    // Sleep log details
    sleepLogs: [{
        logId: String,
        dateOfSleep: Date,
        startTime: Date,
        endTime: Date,
        duration: Number,
        efficiency: Number,
        isMainSleep: Boolean,
        type: String,        // classic, stages
        levels: {
            summary: mongoose.Schema.Types.Mixed,
            data: [mongoose.Schema.Types.Mixed]
        }
    }],

    // ============================================
    // BREATHING RATE (Fitbit Breathing API)
    // ============================================
    breathingRate: { type: Number },          // avg breaths per minute
    deepSleepBreathingRate: { type: Number },
    remBreathingRate: { type: Number },
    lightSleepBreathingRate: { type: Number },
    fullSleepBreathingRate: { type: Number },

    // ============================================
    // BLOOD OXYGEN - SpO2 (Fitbit SpO2 API)
    // ============================================
    spo2Avg: { type: Number },
    spo2Min: { type: Number },
    spo2Max: { type: Number },
    spo2Intraday: [{
        time: String,
        value: Number
    }],

    // ============================================
    // TEMPERATURE (Fitbit Temperature API)
    // ============================================
    skinTemperature: { type: Number },        // relative to baseline
    skinTemperatureBaseline: { type: Number },
    coreTemperature: { type: Number },
    temperatureType: { type: String, enum: ['core', 'skin', null] },

    // ============================================
    // CARDIO FITNESS / VO2 MAX (Fitbit Cardio API)
    // ============================================
    vo2Max: { type: Number },
    vo2MaxLow: { type: Number },              // range low
    vo2MaxHigh: { type: Number },             // range high
    cardioFitnessScore: { type: String },     // Poor, Fair, Good, Very Good, Excellent
    cardioFitnessLevel: { type: Number },     // 1-5

    // ============================================
    // BODY METRICS (Fitbit Body API)
    // ============================================
    weight: { type: Number },         // lbs or kg based on user pref
    bmi: { type: Number },
    bodyFat: { type: Number },
    leanMass: { type: Number },

    // ============================================
    // NUTRITION (Fitbit Nutrition API)
    // ============================================
    nutritionCalories: { type: Number },
    protein: { type: Number },        // grams
    carbs: { type: Number },          // grams
    fat: { type: Number },            // grams
    fiber: { type: Number },
    sodium: { type: Number },
    water: { type: Number },          // ml

    // ============================================
    // COMPUTED SCORES (ClockWork Intelligence)
    // ============================================
    recoveryScore: { type: Number },      // 0-100
    trainingLoad: { type: Number },       // 0-100
    strainScore: { type: Number },        // 0-21 (WHOOP-style)
    readinessScore: { type: Number },     // 0-100

    // Recovery breakdown
    recoveryFactors: {
        hrvContribution: { type: Number },
        sleepContribution: { type: Number },
        rhrContribution: { type: Number },
        breathingContribution: { type: Number }
    },

    // Training recommendations
    trainingRecommendation: {
        intensity: { type: String, enum: ['rest', 'light', 'moderate', 'intense', null] },
        maxDuration: { type: Number },  // minutes
        reason: { type: String }
    },

    // ============================================
    // ECG / IRREGULAR RHYTHM (Fitbit ECG API)
    // ============================================
    ecgReadings: [{
        timestamp: Date,
        classification: String,  // Normal Sinus Rhythm, AFib, Inconclusive
        averageHeartRate: Number,
        waveformData: [Number]   // Raw ECG values
    }],
    irregularRhythmNotifications: [{
        timestamp: Date,
        tackyCount: Number       // Episodes of irregular rhythm
    }],

    // ============================================
    // DEVICE INFO (Fitbit Devices API)
    // ============================================
    device: {
        id: String,
        deviceVersion: String,   // e.g., "Charge 5", "Sense 2"
        type: String,            // TRACKER, SCALE
        battery: String,         // High, Medium, Low, Empty
        batteryLevel: Number,
        lastSyncTime: Date
    },

    // ============================================
    // DATA QUALITY FLAGS
    // ============================================
    dataQuality: {
        activity: { type: Boolean, default: false },
        heartRate: { type: Boolean, default: false },
        sleep: { type: Boolean, default: false },
        hrv: { type: Boolean, default: false },
        breathingRate: { type: Boolean, default: false },
        spo2: { type: Boolean, default: false },
        temperature: { type: Boolean, default: false },
        cardioFitness: { type: Boolean, default: false },
        nutrition: { type: Boolean, default: false },
        body: { type: Boolean, default: false }
    },

    // Raw data storage for debugging
    rawData: { type: mongoose.Schema.Types.Mixed },

    // ============================================
    // SYNC INFO
    // ============================================
    lastSynced: {
        type: Date,
        default: Date.now
    },
    syncStatus: {
        type: String,
        enum: ['success', 'partial', 'failed'],
        default: 'success'
    },
    syncDuration: { type: Number },  // ms
    apiCalls: { type: Number }       // number of API calls made
}, {
    timestamps: true
});

// Indexes for efficient queries
wearableDataSchema.index({ userId: 1, date: -1 });
wearableDataSchema.index({ userId: 1, provider: 1, date: -1 });
wearableDataSchema.index({ userId: 1, provider: 1, date: 1 }, { unique: true });

// Virtual for sleep hours
wearableDataSchema.virtual('sleepHours').get(function() {
    return this.sleepDuration ? (this.sleepDuration / 60).toFixed(1) : null;
});

// Virtual for calories balance
wearableDataSchema.virtual('calorieBalance').get(function() {
    if (this.caloriesBurned && this.nutritionCalories) {
        return this.caloriesBurned - this.nutritionCalories;
    }
    return null;
});

// Method to check if data is complete
wearableDataSchema.methods.isComplete = function() {
    const quality = this.dataQuality;
    return quality.activity && quality.heartRate && quality.sleep;
};

// Static method to get weekly averages
wearableDataSchema.statics.getWeeklyAverages = async function(userId, provider) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId), provider, date: { $gte: weekAgo } } },
        { $group: {
            _id: null,
            avgSteps: { $avg: '$steps' },
            avgSleep: { $avg: '$sleepDuration' },
            avgHRV: { $avg: '$hrv' },
            avgRHR: { $avg: '$restingHeartRate' },
            avgRecovery: { $avg: '$recoveryScore' },
            avgActiveMinutes: { $avg: '$activeMinutes' },
            dataPoints: { $sum: 1 }
        }}
    ]);
};

module.exports = mongoose.model('WearableData', wearableDataSchema);
