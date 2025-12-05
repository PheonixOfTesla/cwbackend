const mongoose = require('mongoose');

const gymSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Gym name is required'],
        trim: true,
        unique: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    description: {
        type: String,
        maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    
    // === PHYSICAL LOCATION DATA ===
    address: {
        street: String,
        city: String,
        state: String,
        zip: String,
        country: { type: String, default: 'USA' }
    },
    contact: {
        phone: String,
        email: String,
        website: String
    },
    hours: {
        monday: { open: String, close: String },
        tuesday: { open: String, close: String },
        wednesday: { open: String, close: String },
        thursday: { open: String, close: String },
        friday: { open: String, close: String },
        saturday: { open: String, close: String },
        sunday: { open: String, close: String }
    },
    amenities: [String],
    
    // === STAFF MANAGEMENT ===
    staff: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        role: {
            type: String,
            enum: ['instructor', 'manager', 'receptionist', 'specialist', 'admin']
        },
        hireDate: Date,
        canSeeAllClients: { type: Boolean, default: false }
    }],
    
    // === ISLAND-GENESIS SUBSCRIPTION TIER ===
    tier: {
        type: String,
        enum: ['SOLO', 'TEAM', 'ENTERPRISE'],
        default: 'TEAM'
    },
    maxSpecialists: {
        type: Number,
        default: function() {
            switch(this.tier) {
                case 'SOLO': return 1;
                case 'TEAM': return 5;
                case 'ENTERPRISE': return 999;
                default: return 5;
            }
        }
    },
    currentSpecialists: {
        type: Number,
        default: 0
    },
    
    // === SUBSCRIPTION & BILLING ===
    subscription: {
        status: {
            type: String,
            enum: ['trial', 'active', 'past_due', 'cancelled', 'expired'],
            default: 'trial'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: Date,
        trialEndsAt: {
            type: Date,
            default: function() {
                const trialStart = this.subscription?.startDate || Date.now();
                return new Date(trialStart + (7 * 24 * 60 * 60 * 1000)); // 7 days
            }
        },
        // Stripe Integration
        stripeCustomerId: {
            type: String,
            default: 'cus_placeholder_' + Date.now() // Placeholder until you add real Stripe ID
        },
        stripeSubscriptionId: String,
        stripePriceId: String,
        lastPaymentDate: Date,
        nextBillingDate: Date
    },
    
    // === ISLAND-GENESIS SETUP PROGRESS ===
    setupProgress: {
        profile: { type: Boolean, default: true }, // Auto-complete on gym creation
        billing: { type: Boolean, default: false },
        team: { type: Boolean, default: false },
        client: { type: Boolean, default: false },
        workout: { type: Boolean, default: false },
        firstClass: { type: Boolean, default: false },
        explore: { type: Boolean, default: false }
    },
    
    // === SETTINGS ===
    settings: {
        currency: { type: String, default: 'USD' },
        timezone: { type: String, default: 'America/New_York' },
        
        // Booking Settings
        bookingBuffer: { type: Number, default: 0 }, // minutes before class starts to block booking
        cancellationPolicy: {
            hours: { type: Number, default: 24 },
            refundPercentage: { type: Number, default: 100 }
        },
        
        // Branding (Island Customization)
        branding: {
            logo: String,
            primaryColor: { type: String, default: '#3b82f6' },
            secondaryColor: { type: String, default: '#60a5fa' }
        },
        
        // Multi-location (for ENTERPRISE tier)
        locations: [{
            name: String,
            address: String,
            isActive: { type: Boolean, default: true }
        }]
    },
    
    // === ISLAND METRICS (for analytics) ===
    metrics: {
        totalClients: { type: Number, default: 0 },
        totalWorkouts: { type: Number, default: 0 },
        totalClasses: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        lastActivityDate: Date
    },
    
    // === ISLAND STATUS ===
    isActive: {
        type: Boolean,
        default: true
    },
    deactivatedAt: Date,
    deactivationReason: String
    
}, {
    timestamps: true
});

// === VIRTUALS ===

// Calculate setup completion percentage
gymSchema.virtual('setupPercentage').get(function() {
    const steps = Object.values(this.setupProgress);
    const completed = steps.filter(Boolean).length;
    return Math.round((completed / steps.length) * 100);
});

// Check if trial is active
gymSchema.virtual('isTrialActive').get(function() {
    if (this.subscription.status !== 'trial') return false;
    return new Date() < new Date(this.subscription.trialEndsAt);
});

// Calculate days remaining in trial
gymSchema.virtual('trialDaysRemaining').get(function() {
    if (this.subscription.status !== 'trial') return 0;
    const now = new Date();
    const trialEnd = new Date(this.subscription.trialEndsAt);
    const diffTime = trialEnd - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
});

// Check if specialist limit reached
gymSchema.virtual('specialistLimitReached').get(function() {
    return this.currentSpecialists >= this.maxSpecialists;
});

// Calculate monthly revenue based on tier
gymSchema.virtual('monthlyRevenue').get(function() {
    if (this.subscription.status !== 'active') return 0;
    const prices = { SOLO: 49, TEAM: 149, ENTERPRISE: 299 };
    return prices[this.tier] || 0;
});

// === INSTANCE METHODS ===

// Add specialist to gym
gymSchema.methods.addSpecialist = async function() {
    if (this.currentSpecialists >= this.maxSpecialists) {
        throw new Error(`Specialist limit reached for ${this.tier} tier (${this.maxSpecialists} max)`);
    }
    this.currentSpecialists += 1;
    return this.save();
};

// Remove specialist from gym
gymSchema.methods.removeSpecialist = async function() {
    if (this.currentSpecialists > 0) {
        this.currentSpecialists -= 1;
        return this.save();
    }
};

// Update setup progress step
gymSchema.methods.completeSetupStep = async function(step) {
    if (this.setupProgress.hasOwnProperty(step)) {
        this.setupProgress[step] = true;
        return this.save();
    }
    throw new Error(`Invalid setup step: ${step}`);
};

// Activate subscription
gymSchema.methods.activateSubscription = async function(stripeSubscriptionId) {
    this.subscription.status = 'active';
    this.subscription.stripeSubscriptionId = stripeSubscriptionId;
    this.subscription.lastPaymentDate = new Date();
    // Set next billing date to 30 days from now
    this.subscription.nextBillingDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
    return this.save();
};

// Cancel subscription
gymSchema.methods.cancelSubscription = async function(reason) {
    this.subscription.status = 'cancelled';
    this.subscription.endDate = new Date();
    this.deactivationReason = reason;
    return this.save();
};

// Upgrade tier
gymSchema.methods.upgradeTier = async function(newTier) {
    const tierLimits = { SOLO: 1, TEAM: 5, ENTERPRISE: 999 };
    
    if (!tierLimits[newTier]) {
        throw new Error('Invalid tier');
    }
    
    this.tier = newTier;
    this.maxSpecialists = tierLimits[newTier];
    
    return this.save();
};

// === STATIC METHODS ===

// Get all active gyms
gymSchema.statics.getActiveGyms = function() {
    return this.find({ isActive: true, 'subscription.status': 'active' });
};

// Get gyms in trial
gymSchema.statics.getTrialGyms = function() {
    return this.find({ 'subscription.status': 'trial' });
};

// Get gyms by tier
gymSchema.statics.getGymsByTier = function(tier) {
    return this.find({ tier, isActive: true });
};

// Calculate total monthly revenue across all gyms
gymSchema.statics.getTotalRevenue = async function() {
    const gyms = await this.find({ 'subscription.status': 'active' });
    const prices = { SOLO: 49, TEAM: 149, ENTERPRISE: 299 };
    return gyms.reduce((total, gym) => total + (prices[gym.tier] || 0), 0);
};

// === INDEXES ===
gymSchema.index({ ownerId: 1 });
gymSchema.index({ 'subscription.status': 1 });
gymSchema.index({ tier: 1 });
gymSchema.index({ isActive: 1 });
gymSchema.index({ name: 1 });

// === PRE-SAVE MIDDLEWARE ===
gymSchema.pre('save', function(next) {
    // Auto-set maxSpecialists based on tier if it's being modified
    if (this.isModified('tier')) {
        const tierLimits = { SOLO: 1, TEAM: 5, ENTERPRISE: 999 };
        this.maxSpecialists = tierLimits[this.tier];
    }
    
    // Auto-complete profile step on first save
    if (this.isNew) {
        this.setupProgress.profile = true;
    }
    
    next();
});

// === CONFIGURATION ===
gymSchema.set('toJSON', { virtuals: true });
gymSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Gym', gymSchema);