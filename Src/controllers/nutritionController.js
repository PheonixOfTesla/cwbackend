const Nutrition = require('../models/Nutrition');

exports.getNutritionByClient = async (req, res) => {
  try {
    let nutrition = await Nutrition.findOne({ 
      clientId: req.params.clientId 
    });
    
    // If no nutrition plan exists, create a default one
    if (!nutrition) {
      nutrition = {
        clientId: req.params.clientId,
        protein: { target: 0, current: 0 },
        carbs: { target: 0, current: 0 },
        fat: { target: 0, current: 0 },
        calories: { target: 0, current: 0 },
        mealPlan: {
          breakfast: '',
          lunch: '',
          dinner: '',
          snacks: ''
        },
        dailyLogs: []
      };
    } else {
      // Ensure the data structure is complete even for existing records
      nutrition = nutrition.toObject();
      nutrition.protein = nutrition.protein || { target: 0, current: 0 };
      nutrition.carbs = nutrition.carbs || { target: 0, current: 0 };
      nutrition.fat = nutrition.fat || { target: 0, current: 0 };
      nutrition.calories = nutrition.calories || { target: 0, current: 0 };
      nutrition.mealPlan = nutrition.mealPlan || {
        breakfast: '',
        lunch: '',
        dinner: '',
        snacks: ''
      };
      nutrition.dailyLogs = nutrition.dailyLogs || [];
    }
    
    res.json(nutrition);
  } catch (error) {
    console.error('Error fetching nutrition:', error);
    res.status(500).json({ 
      message: error.message,
      // Return a default structure on error
      data: {
        protein: { target: 0, current: 0 },
        carbs: { target: 0, current: 0 },
        fat: { target: 0, current: 0 },
        calories: { target: 0, current: 0 },
        mealPlan: {
          breakfast: '',
          lunch: '',
          dinner: '',
          snacks: ''
        }
      }
    });
  }
};

exports.createOrUpdateNutrition = async (req, res) => {
  try {
    // Ensure proper data structure with defaults
    const nutritionData = {
      clientId: req.params.clientId,
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
      { clientId: req.params.clientId },
      nutritionData,
      { new: true, upsert: true, runValidators: true }
    );
    
    // Ensure response has complete structure
    const response = nutrition.toObject();
    response.protein = response.protein || { target: 0, current: 0 };
    response.carbs = response.carbs || { target: 0, current: 0 };
    response.fat = response.fat || { target: 0, current: 0 };
    response.calories = response.calories || { target: 0, current: 0 };
    response.mealPlan = response.mealPlan || {
      breakfast: '',
      lunch: '',
      dinner: '',
      snacks: ''
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error creating/updating nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.logDailyNutrition = async (req, res) => {
  try {
    let nutrition = await Nutrition.findOne({ clientId: req.params.clientId });
    
    if (!nutrition) {
      // Create a new nutrition plan if it doesn't exist
      nutrition = new Nutrition({
        clientId: req.params.clientId,
        assignedBy: req.user.id,
        protein: { target: 0, current: 0 },
        carbs: { target: 0, current: 0 },
        fat: { target: 0, current: 0 },
        calories: { target: 0, current: 0 },
        mealPlan: {
          breakfast: '',
          lunch: '',
          dinner: '',
          snacks: ''
        },
        dailyLogs: []
      });
    }
    
    // Add the daily log entry
    nutrition.dailyLogs.push({
      date: new Date(),
      protein: parseFloat(req.body.protein) || 0,
      carbs: parseFloat(req.body.carbs) || 0,
      fat: parseFloat(req.body.fat) || 0,
      calories: parseFloat(req.body.calories) || 0,
      notes: req.body.notes || ''
    });
    
    // Update current values if provided
    if (req.body.protein !== undefined) {
      nutrition.protein = nutrition.protein || { target: 0, current: 0 };
      nutrition.protein.current = parseFloat(req.body.protein) || 0;
    }
    if (req.body.carbs !== undefined) {
      nutrition.carbs = nutrition.carbs || { target: 0, current: 0 };
      nutrition.carbs.current = parseFloat(req.body.carbs) || 0;
    }
    if (req.body.fat !== undefined) {
      nutrition.fat = nutrition.fat || { target: 0, current: 0 };
      nutrition.fat.current = parseFloat(req.body.fat) || 0;
    }
    if (req.body.calories !== undefined) {
      nutrition.calories = nutrition.calories || { target: 0, current: 0 };
      nutrition.calories.current = parseFloat(req.body.calories) || 0;
    }
    
    await nutrition.save();
    
    // Ensure response has complete structure
    const response = nutrition.toObject();
    response.protein = response.protein || { target: 0, current: 0 };
    response.carbs = response.carbs || { target: 0, current: 0 };
    response.fat = response.fat || { target: 0, current: 0 };
    response.calories = response.calories || { target: 0, current: 0 };
    response.mealPlan = response.mealPlan || {
      breakfast: '',
      lunch: '',
      dinner: '',
      snacks: ''
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error logging daily nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};

// Delete nutrition plan (new method)
exports.deleteNutrition = async (req, res) => {
  try {
    const nutrition = await Nutrition.findOneAndDelete({ 
      clientId: req.params.clientId 
    });
    
    if (!nutrition) {
      return res.status(404).json({ 
        message: 'Nutrition plan not found' 
      });
    }
    
    res.json({ 
      message: 'Nutrition plan deleted successfully',
      data: nutrition 
    });
  } catch (error) {
    console.error('Error deleting nutrition:', error);
    res.status(500).json({ message: error.message });
  }
};
