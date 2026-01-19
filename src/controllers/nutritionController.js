// ============================================
// THE FORGE KITCHEN - Nutrition Controller
// AI-powered meal planning, TDEE calculation, food logging
// ============================================

const Nutrition = require('../models/Nutrition');
const User = require('../models/User');
const CalendarEvent = require('../models/CalendarEvent');
const OpenAI = require('openai');

// Initialize OpenRouter with Kimi K2 - 100% FREE
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
const AI_MODEL = 'moonshot/moonshot-v1-128k'; // Kimi K2 - FREE

// ============================================
// TDEE & MACRO CALCULATION (Mifflin-St Jeor)
// ============================================

function calculateTDEE(profile, activityLevel, goal) {
  const { currentWeight, height, dateOfBirth, gender } = profile || {};

  // Use sensible defaults if profile data is missing
  const defaultWeight = 170; // lbs
  const defaultHeight = 68;  // inches (5'8")
  const defaultAge = 30;
  const defaultGender = 'male';

  // Convert units if needed (assume imperial, convert to metric for calculation)
  const weightKg = (currentWeight || defaultWeight) * 0.453592; // lbs to kg
  const heightCm = (height || defaultHeight) * 2.54; // inches to cm
  const userGender = gender || defaultGender;

  // Calculate age
  let age = defaultAge;
  if (dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (isNaN(age) || age < 10 || age > 100) age = defaultAge;
  }

  // Mifflin-St Jeor Equation for BMR
  let bmr;
  if (userGender === 'male') {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }

  // Activity multipliers
  const activityMultipliers = {
    'sedentary': 1.2,      // Little to no exercise
    'light': 1.375,        // Light exercise 1-3 days/week
    'moderate': 1.55,      // Moderate exercise 3-5 days/week
    'active': 1.725,       // Heavy exercise 6-7 days/week
    'very_active': 1.9     // Very heavy exercise, physical job
  };

  const multiplier = activityMultipliers[activityLevel] || 1.55;
  let tdee = Math.round(bmr * multiplier);

  // Goal adjustments
  let goalCalories = tdee;
  if (goal === 'lose') {
    goalCalories = tdee - 500; // 500 cal deficit for ~1lb/week loss
  } else if (goal === 'gain') {
    goalCalories = tdee + 300; // 300 cal surplus for lean gains
  } else if (goal === 'recomp') {
    goalCalories = tdee; // Eat at maintenance
  }

  // Macro calculation (strength training focused)
  const proteinGrams = Math.round(weightKg * 2.0); // 2g per kg for strength
  const fatGrams = Math.round((goalCalories * 0.25) / 9); // 25% from fat
  const carbGrams = Math.round((goalCalories - (proteinGrams * 4) - (fatGrams * 9)) / 4);

  return {
    bmr: Math.round(bmr),
    tdee,
    calories: goalCalories,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    fiber: 25 + Math.round(goalCalories / 1000) * 5, // ~25-35g based on calories
    water: Math.round(weightKg * 35), // 35ml per kg
    calculatedAt: new Date(),
    calculationMethod: 'mifflin-st-jeor'
  };
}

// ============================================
// GET NUTRITION (for current user)
// ============================================
exports.getMyNutrition = async (req, res) => {
  try {
    const userId = req.user.id;
    let nutrition = await Nutrition.getOrCreateForUser(userId);

    // Get user for profile data
    const user = await User.findById(userId);

    // If no targets calculated yet, calculate them
    if (!nutrition.targets?.tdee && user?.profile?.currentWeight) {
      const targets = calculateTDEE(
        user.profile,
        nutrition.activityLevel || 'moderate',
        nutrition.nutritionGoal || 'maintain'
      );
      nutrition.targets = targets;
      await nutrition.save();
    }

    // Get today's log
    const todayLog = nutrition.getTodayLog();

    res.json({
      success: true,
      data: {
        targets: nutrition.targets,
        activityLevel: nutrition.activityLevel,
        nutritionGoal: nutrition.nutritionGoal,
        currentMealPlan: nutrition.currentMealPlan,
        todayLog: todayLog || { meals: [], totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } },
        preferences: nutrition.preferences
      }
    });
  } catch (error) {
    console.error('Get nutrition error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// CALCULATE/RECALCULATE TARGETS
// ============================================
exports.calculateTargets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { activityLevel, nutritionGoal } = req.body;

    const user = await User.findById(userId);
    let nutrition = await Nutrition.getOrCreateForUser(userId);

    // Update settings
    if (activityLevel) nutrition.activityLevel = activityLevel;
    if (nutritionGoal) nutrition.nutritionGoal = nutritionGoal;

    // Calculate new targets (uses defaults if profile incomplete)
    const targets = calculateTDEE(
      user?.profile || {},
      nutrition.activityLevel,
      nutrition.nutritionGoal
    );

    nutrition.targets = targets;
    await nutrition.save();

    // Note if using defaults
    const usingDefaults = !user?.profile?.currentWeight;
    console.log(`🍽️ Calculated nutrition targets for ${user?.name || 'user'}: ${targets.calories} cal${usingDefaults ? ' (using defaults)' : ''}`);

    res.json({
      success: true,
      message: usingDefaults
        ? 'Targets calculated using default values. Update your profile for personalized results.'
        : 'Nutrition targets calculated',
      targets,
      activityLevel: nutrition.activityLevel,
      nutritionGoal: nutrition.nutritionGoal,
      usingDefaults
    });
  } catch (error) {
    console.error('Calculate targets error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GENERATE AI MEAL PLAN (FORGE Kitchen)
// ============================================
exports.generateMealPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    let nutrition = await Nutrition.getOrCreateForUser(userId);

    // Ensure targets are calculated (use defaults if profile incomplete)
    if (!nutrition.targets?.calories) {
      nutrition.targets = calculateTDEE(
        user?.profile || {},
        nutrition.activityLevel || 'moderate',
        nutrition.nutritionGoal || 'maintain'
      );
      await nutrition.save();
      console.log(`🍽️ Auto-calculated nutrition targets for meal plan: ${nutrition.targets.calories} cal`);
    }

    const { calories, protein, carbs, fat } = nutrition.targets;
    const preferences = nutrition.preferences || {};

    // ═══════════════════════════════════════════════════════════
    // FORGE PERSONALIZATION: Pull from user's onboarding data
    // ═══════════════════════════════════════════════════════════
    const dietaryPrefs = user?.dietaryPreferences || {};
    const bodyComp = user?.bodyComposition || {};

    // Determine caloric strategy
    const calorieStrategy = bodyComp.goal?.includes('cut') ? 'CALORIC DEFICIT - prioritize volume, fiber, satiety' :
                           bodyComp.goal?.includes('bulk') ? 'CALORIC SURPLUS - prioritize calorie-dense foods' :
                           'MAINTENANCE';

    // Build exclusion list
    const exclusions = [
      ...(dietaryPrefs.allergies || []),
      ...(dietaryPrefs.dislikedFoods || []),
      ...(preferences.allergies || [])
    ].filter(Boolean);

    const prompt = `You are FORGE Kitchen - the nutrition wing of ClockWork fitness AI.

Generate a daily meal plan for this user:

TARGETS:
- Calories: ${calories} kcal
- Protein: ${protein}g
- Carbs: ${carbs}g
- Fat: ${fat}g

═══════════════════════════════════════════════════════════
DIETARY REQUIREMENTS (MUST FOLLOW EXACTLY):
═══════════════════════════════════════════════════════════
- Diet Type: ${dietaryPrefs.dietType || 'flexible'}
- ALLERGIES (ABSOLUTELY NO): ${dietaryPrefs.allergies?.join(', ') || 'none'}
- FOODS TO EXCLUDE: ${exclusions.join(', ') || 'none'}
- Preferred Cuisines: ${dietaryPrefs.cuisinePreferences?.join(', ') || 'any'}
- Cooking Skill: ${dietaryPrefs.cookingSkill || preferences.cookingSkill || 'intermediate'}
- Meals Per Day: ${dietaryPrefs.mealsPerDay || 5}
- Budget: ${dietaryPrefs.budget || preferences.budget || 'moderate'}
- Max Prep Time: ${preferences.prepTimeMax || 30} minutes

BODY COMPOSITION GOAL: ${bodyComp.goal || 'maintain'}
CALORIE STRATEGY: ${calorieStrategy}

═══════════════════════════════════════════════════════════
CRITICAL RULES - VIOLATION = FAILURE:
═══════════════════════════════════════════════════════════
1. If diet type is 'vegan' → ZERO animal products (no meat, fish, eggs, dairy, honey)
2. If diet type is 'vegetarian' → NO meat or fish, dairy and eggs OK
3. If diet type is 'pescatarian' → NO meat, fish is OK
4. If diet type is 'keto' → Less than 20g net carbs total
5. If allergies include 'nuts' → ZERO nuts, nut butters, or nut oils in ANY meal
6. If allergies include 'gluten' → ZERO wheat, barley, rye, or gluten-containing ingredients
7. If allergies include 'dairy' → ZERO milk, cheese, yogurt, butter, cream
8. If allergies include 'shellfish' → ZERO shrimp, crab, lobster, etc.
9. If allergies include 'eggs' → ZERO eggs in any form
10. NEVER include foods from the exclusion list

Generate 5 meals (breakfast, morning snack, lunch, afternoon snack, dinner) that hit these macros.

Return ONLY valid JSON:
{
  "breakfast": {
    "name": "Meal name",
    "description": "Brief description",
    "calories": 500,
    "protein": 35,
    "carbs": 45,
    "fat": 18,
    "ingredients": ["ingredient 1", "ingredient 2"],
    "prepTime": 15,
    "imageCategory": "eggs"
  },
  "snack1": { ... },
  "lunch": { ... },
  "snack2": { ... },
  "dinner": { ... },
  "totalCalories": 2400,
  "totalProtein": 180,
  "totalCarbs": 240,
  "totalFat": 80,
  "shoppingList": ["item1", "item2", ...]
}

For imageCategory, use one of: eggs, chicken, steak, fish, salad, rice, pasta, sandwich, smoothie, oatmeal, yogurt, nuts, fruit, vegetables, soup`;

    console.log('🍳 FORGE Kitchen generating meal plan with Kimi K2 (FREE)...');

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }]
    });

    const aiText = completion.choices[0].message.content;

    // Parse response
    let mealPlan;
    try {
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/) || aiText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : aiText;
      mealPlan = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error('Failed to parse meal plan:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate meal plan',
        aiResponse: aiText
      });
    }

    // Fetch images for each meal from free APIs
    const mealsWithImages = await addMealImages(mealPlan);

    // Save to nutrition record
    nutrition.currentMealPlan = {
      generatedAt: new Date(),
      generatedBy: 'forge',
      breakfast: mealsWithImages.breakfast,
      snack1: mealsWithImages.snack1,
      lunch: mealsWithImages.lunch,
      snack2: mealsWithImages.snack2,
      dinner: mealsWithImages.dinner,
      totalCalories: mealPlan.totalCalories,
      totalProtein: mealPlan.totalProtein,
      totalCarbs: mealPlan.totalCarbs,
      totalFat: mealPlan.totalFat
    };

    await nutrition.save();

    // Create calendar events for each meal (for today and next 7 days)
    const mealTimes = {
      breakfast: '08:00',
      snack1: '10:30',
      lunch: '12:30',
      snack2: '15:30',
      dinner: '19:00'
    };

    const mealTypes = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Delete existing nutrition events for the next 7 days
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    await CalendarEvent.deleteMany({
      userId,
      type: 'nutrition',
      date: { $gte: today, $lte: weekFromNow }
    });

    // Create nutrition events for each day
    const calendarEvents = [];
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const eventDate = new Date(today);
      eventDate.setDate(eventDate.getDate() + dayOffset);

      for (const mealType of mealTypes) {
        const meal = mealsWithImages[mealType];
        if (!meal) continue;

        calendarEvents.push({
          userId,
          type: 'nutrition',
          title: meal.name,
          description: meal.description || `${meal.calories} cal | ${meal.protein}g protein`,
          date: eventDate,
          startTime: mealTimes[mealType],
          duration: mealType.includes('snack') ? 15 : 30,
          status: 'scheduled',
          aiGenerated: true,
          aiReason: 'FORGE Kitchen meal plan',
          color: '#22c55e',
          mealData: {
            mealType,
            name: meal.name,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
            ingredients: meal.ingredients || [],
            prepTime: meal.prepTime || 15,
            imageUrl: meal.imageUrl
          }
        });
      }
    }

    await CalendarEvent.insertMany(calendarEvents);
    console.log(`📅 Created ${calendarEvents.length} nutrition calendar events`);
    console.log(`✅ FORGE Kitchen generated meal plan: ${mealPlan.totalCalories} calories`);

    res.json({
      success: true,
      message: 'Meal plan generated by FORGE Kitchen',
      data: {
        mealPlan: nutrition.currentMealPlan,
        shoppingList: mealPlan.shoppingList || [],
        calendarEventsCreated: calendarEvents.length
      }
    });

  } catch (error) {
    console.error('Generate meal plan error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// ADD IMAGES TO MEALS (Free APIs)
// ============================================
async function addMealImages(mealPlan) {
  const meals = ['breakfast', 'snack1', 'lunch', 'snack2', 'dinner'];

  for (const mealType of meals) {
    const meal = mealPlan[mealType];
    if (!meal) continue;

    try {
      // Try TheMealDB first (has real food images)
      const mealName = meal.name?.split(' ')[0] || meal.imageCategory || 'chicken';
      const mealDbUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(mealName)}`;

      const response = await fetch(mealDbUrl);
      const data = await response.json();

      if (data.meals && data.meals.length > 0) {
        // Get random meal from results
        const randomMeal = data.meals[Math.floor(Math.random() * data.meals.length)];
        meal.imageUrl = randomMeal.strMealThumb;
      } else {
        // Fallback to category-based placeholder
        meal.imageUrl = getFallbackImage(meal.imageCategory || mealType);
      }
    } catch (err) {
      console.error(`Failed to fetch image for ${mealType}:`, err.message);
      meal.imageUrl = getFallbackImage(meal.imageCategory || mealType);
    }
  }

  return mealPlan;
}

// Fallback images (using Unsplash source - free, no API key)
function getFallbackImage(category) {
  const categoryImages = {
    'eggs': 'https://images.unsplash.com/photo-1482049016gy9-41d9d3c42303?w=400',
    'chicken': 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?w=400',
    'steak': 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400',
    'fish': 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400',
    'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400',
    'rice': 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400',
    'pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400',
    'sandwich': 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400',
    'smoothie': 'https://images.unsplash.com/photo-1505252585461-04db1eb84625?w=400',
    'oatmeal': 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=400',
    'yogurt': 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
    'nuts': 'https://images.unsplash.com/photo-1508061253366-f7da158b6d46?w=400',
    'fruit': 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=400',
    'vegetables': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400',
    'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400',
    'breakfast': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400',
    'snack1': 'https://images.unsplash.com/photo-1604909052743-94e838986d24?w=400',
    'lunch': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
    'snack2': 'https://images.unsplash.com/photo-1587049016823-69ef9d68bd44?w=400',
    'dinner': 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400'
  };

  return categoryImages[category] || categoryImages['lunch'];
}

// ============================================
// LOG FOOD
// ============================================
exports.logFood = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mealType, name, calories, protein, carbs, fat, time } = req.body;

    if (!name || !calories) {
      return res.status(400).json({
        success: false,
        message: 'Meal name and calories are required'
      });
    }

    let nutrition = await Nutrition.getOrCreateForUser(userId);

    const mealData = {
      mealType: mealType || 'snack',
      name,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      time: time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };

    const todayLog = await nutrition.addToTodayLog(mealData);

    console.log(`📝 Logged ${name} (${calories} cal) for user ${userId}`);

    res.json({
      success: true,
      message: 'Food logged',
      data: {
        logged: mealData,
        todayTotals: todayLog.totals
      }
    });
  } catch (error) {
    console.error('Log food error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET DAILY SUMMARY
// ============================================
exports.getDailySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    let nutrition = await Nutrition.getOrCreateForUser(userId);

    let targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const dayLog = nutrition.dailyLogs.find(log => {
      const logDate = new Date(log.date);
      logDate.setHours(0, 0, 0, 0);
      return logDate.getTime() === targetDate.getTime();
    });

    const targets = nutrition.targets || {};
    const consumed = dayLog?.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 };

    res.json({
      success: true,
      data: {
        date: targetDate,
        targets: {
          calories: targets.calories || 0,
          protein: targets.protein || 0,
          carbs: targets.carbs || 0,
          fat: targets.fat || 0
        },
        consumed,
        remaining: {
          calories: (targets.calories || 0) - consumed.calories,
          protein: (targets.protein || 0) - consumed.protein,
          carbs: (targets.carbs || 0) - consumed.carbs,
          fat: (targets.fat || 0) - consumed.fat
        },
        meals: dayLog?.meals || [],
        percentages: {
          calories: targets.calories ? Math.round((consumed.calories / targets.calories) * 100) : 0,
          protein: targets.protein ? Math.round((consumed.protein / targets.protein) * 100) : 0,
          carbs: targets.carbs ? Math.round((consumed.carbs / targets.carbs) * 100) : 0,
          fat: targets.fat ? Math.round((consumed.fat / targets.fat) * 100) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get daily summary error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// UPDATE PREFERENCES
// ============================================
exports.updatePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { dietaryRestrictions, allergies, cuisinePreferences, cookingSkill, budget, prepTimeMax } = req.body;

    let nutrition = await Nutrition.getOrCreateForUser(userId);

    if (dietaryRestrictions) nutrition.preferences.dietaryRestrictions = dietaryRestrictions;
    if (allergies) nutrition.preferences.allergies = allergies;
    if (cuisinePreferences) nutrition.preferences.cuisinePreferences = cuisinePreferences;
    if (cookingSkill) nutrition.preferences.cookingSkill = cookingSkill;
    if (budget) nutrition.preferences.budget = budget;
    if (prepTimeMax) nutrition.preferences.prepTimeMax = prepTimeMax;

    await nutrition.save();

    res.json({
      success: true,
      message: 'Preferences updated',
      data: nutrition.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// LEGACY ENDPOINTS (backwards compatibility)
// ============================================
exports.getNutritionByClient = async (req, res) => {
  try {
    const clientId = req.params.clientId;
    let nutrition = await Nutrition.findOne({
      $or: [{ userId: clientId }, { clientId }]
    });

    if (!nutrition) {
      nutrition = {
        clientId,
        protein: { target: 0, current: 0 },
        carbs: { target: 0, current: 0 },
        fat: { target: 0, current: 0 },
        calories: { target: 0, current: 0 },
        mealPlan: { breakfast: '', lunch: '', dinner: '', snacks: '' },
        dailyLogs: []
      };
    }

    res.json(nutrition);
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.createOrUpdateNutrition = async (req, res) => {
  try {
    const nutritionData = {
      clientId: req.params.clientId,
      userId: req.params.clientId,
      assignedBy: req.user.id,
      protein: {
        target: req.body.protein?.target || 0,
        current: req.body.protein?.current || 0
      },
      carbs: {
        target: req.body.carbs?.target || 0,
        current: req.body.carbs?.current || 0
      },
      fat: {
        target: req.body.fat?.target || 0,
        current: req.body.fat?.current || 0
      },
      calories: {
        target: req.body.calories?.target || 0,
        current: req.body.calories?.current || 0
      },
      mealPlan: {
        breakfast: req.body.mealPlan?.breakfast || '',
        lunch: req.body.mealPlan?.lunch || '',
        dinner: req.body.mealPlan?.dinner || '',
        snacks: req.body.mealPlan?.snacks || ''
      },
      updatedAt: new Date()
    };

    const nutrition = await Nutrition.findOneAndUpdate(
      { $or: [{ userId: req.params.clientId }, { clientId: req.params.clientId }] },
      nutritionData,
      { new: true, upsert: true, runValidators: true }
    );

    res.json(nutrition);
  } catch (error) {
    console.error('Error creating/updating nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.logDailyNutrition = async (req, res) => {
  try {
    let nutrition = await Nutrition.findOne({
      $or: [{ userId: req.params.clientId }, { clientId: req.params.clientId }]
    });

    if (!nutrition) {
      nutrition = new Nutrition({
        clientId: req.params.clientId,
        userId: req.params.clientId,
        assignedBy: req.user.id
      });
    }

    nutrition.dailyLogs.push({
      date: new Date(),
      protein: parseFloat(req.body.protein) || 0,
      carbs: parseFloat(req.body.carbs) || 0,
      fat: parseFloat(req.body.fat) || 0,
      calories: parseFloat(req.body.calories) || 0,
      notes: req.body.notes || ''
    });

    await nutrition.save();
    res.json(nutrition);
  } catch (error) {
    console.error('Error logging daily nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNutrition = async (req, res) => {
  try {
    const nutrition = await Nutrition.findOneAndDelete({
      $or: [{ userId: req.params.clientId }, { clientId: req.params.clientId }]
    });

    if (!nutrition) {
      return res.status(404).json({ message: 'Nutrition plan not found' });
    }

    res.json({ message: 'Nutrition plan deleted successfully', data: nutrition });
  } catch (error) {
    console.error('Error deleting nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = exports;
