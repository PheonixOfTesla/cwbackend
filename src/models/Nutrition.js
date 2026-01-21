const mongoose = require('mongoose');

// ============================================
// THE FORGE KITCHEN - Nutrition Model
// ============================================

const mealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  calories: { type: Number, default: 0 },
  protein: { type: Number, default: 0 },
  carbs: { type: Number, default: 0 },
  fat: { type: Number, default: 0 },
  ingredients: [String],
  imageUrl: String,
  imageCategory: String, // For fetching from free APIs
  prepTime: Number, // minutes
  cookTime: Number,
  servings: { type: Number, default: 1 },
  tags: [String], // ['high-protein', 'quick', 'meal-prep', etc]
  addedToCalendar: { type: Boolean, default: false },
  calendarDate: Date
}, { _id: false });

const nutritionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Legacy field for backwards compatibility
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ═══════════════════════════════════════════════════════════
  // CALCULATED TARGETS (from user profile)
  // ═══════════════════════════════════════════════════════════
  targets: {
    bmr: { type: Number, default: 0 },          // Basal Metabolic Rate
    tdee: { type: Number, default: 0 },         // Total Daily Energy Expenditure
    calories: { type: Number, default: 0 },     // Goal calories (TDEE +/- deficit/surplus)
    protein: { type: Number, default: 0 },      // grams
    carbs: { type: Number, default: 0 },        // grams
    fat: { type: Number, default: 0 },          // grams
    fiber: { type: Number, default: 25 },       // grams (default 25g)
    water: { type: Number, default: 3000 },     // ml
    calculatedAt: Date,
    calculationMethod: { type: String, default: 'mifflin-st-jeor' }
  },

  // Activity level for TDEE calculation
  activityLevel: {
    type: String,
    enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    default: 'moderate'
  },

  // Nutrition goal (affects calorie adjustment)
  nutritionGoal: {
    type: String,
    enum: ['lose', 'maintain', 'gain', 'recomp'],
    default: 'maintain'
  },

  // ═══════════════════════════════════════════════════════════
  // AI-GENERATED MEAL PLAN
  // ═══════════════════════════════════════════════════════════
  currentMealPlan: {
    generatedAt: Date,
    generatedBy: { type: String, default: 'forge' },
    breakfast: mealSchema,
    snack1: mealSchema,
    lunch: mealSchema,
    snack2: mealSchema,
    dinner: mealSchema,
    totalCalories: Number,
    totalProtein: Number,
    totalCarbs: Number,
    totalFat: Number
  },

  // Saved meal plans for variety
  savedMealPlans: [{
    name: String,
    createdAt: { type: Date, default: Date.now },
    meals: {
      breakfast: mealSchema,
      snack1: mealSchema,
      lunch: mealSchema,
      snack2: mealSchema,
      dinner: mealSchema
    }
  }],

  // ═══════════════════════════════════════════════════════════
  // LEGACY FIELDS (backwards compatibility)
  // ═══════════════════════════════════════════════════════════
  protein: {
    target: { type: Number, default: 0 },
    current: { type: Number, default: 0 }
  },
  carbs: {
    target: { type: Number, default: 0 },
    current: { type: Number, default: 0 }
  },
  fat: {
    target: { type: Number, default: 0 },
    current: { type: Number, default: 0 }
  },
  calories: {
    target: { type: Number, default: 0 },
    current: { type: Number, default: 0 }
  },
  mealPlan: {
    breakfast: { type: String, default: '' },
    lunch: { type: String, default: '' },
    dinner: { type: String, default: '' },
    snacks: { type: String, default: '' }
  },

  // ═══════════════════════════════════════════════════════════
  // DAILY FOOD LOG
  // ═══════════════════════════════════════════════════════════
  dailyLogs: [{
    date: { type: Date, default: Date.now },
    meals: [{
      mealType: { type: String, enum: ['breakfast', 'snack', 'lunch', 'dinner'] },
      name: String,
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      time: String
    }],
    totals: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      water: Number // ml
    },
    notes: String,
    mood: { type: String, enum: ['great', 'good', 'okay', 'tired', 'hungry'] }
  }],

  // ═══════════════════════════════════════════════════════════
  // PREFERENCES
  // ═══════════════════════════════════════════════════════════
  preferences: {
    dietaryRestrictions: [{
      type: String,
      enum: ['vegetarian', 'vegan', 'pescatarian', 'keto', 'paleo', 'gluten-free', 'dairy-free', 'halal', 'kosher', 'none']
    }],
    allergies: [String],
    cuisinePreferences: [String],
    mealPrepDays: [String],
    mealsPerDay: { type: Number, default: 5, min: 3, max: 6 },
    cookingSkill: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'intermediate' },
    budget: { type: String, enum: ['budget', 'moderate', 'premium'], default: 'moderate' },
    prepTimeMax: { type: Number, default: 30 } // max minutes for meal prep
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes
// Note: userId index is created automatically by 'unique: true' on the field
nutritionSchema.index({ clientId: 1 });
nutritionSchema.index({ 'dailyLogs.date': -1 });

// Update timestamp on save
nutritionSchema.pre('save', function(next) {
  this.updatedAt = new Date();

  // Sync legacy fields with new targets
  if (this.targets) {
    this.protein.target = this.targets.protein || 0;
    this.carbs.target = this.targets.carbs || 0;
    this.fat.target = this.targets.fat || 0;
    this.calories.target = this.targets.calories || 0;
  }

  next();
});

// Static method to get or create nutrition for a user
nutritionSchema.statics.getOrCreateForUser = async function(userId) {
  let nutrition = await this.findOne({
    $or: [{ userId }, { clientId: userId }]
  });

  if (!nutrition) {
    nutrition = new this({
      userId,
      clientId: userId
    });
    await nutrition.save();
  }

  return nutrition;
};

// Method to get today's log
nutritionSchema.methods.getTodayLog = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return this.dailyLogs.find(log => {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    return logDate.getTime() === today.getTime();
  });
};

// Method to add to today's log
nutritionSchema.methods.addToTodayLog = async function(mealData) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let todayLog = this.dailyLogs.find(log => {
    const logDate = new Date(log.date);
    logDate.setHours(0, 0, 0, 0);
    return logDate.getTime() === today.getTime();
  });

  if (!todayLog) {
    todayLog = {
      date: today,
      meals: [],
      totals: { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }
    };
    this.dailyLogs.push(todayLog);
    todayLog = this.dailyLogs[this.dailyLogs.length - 1];
  }

  todayLog.meals.push(mealData);

  // Update totals
  todayLog.totals.calories += mealData.calories || 0;
  todayLog.totals.protein += mealData.protein || 0;
  todayLog.totals.carbs += mealData.carbs || 0;
  todayLog.totals.fat += mealData.fat || 0;

  await this.save();
  return todayLog;
};

module.exports = mongoose.model('Nutrition', nutritionSchema);
