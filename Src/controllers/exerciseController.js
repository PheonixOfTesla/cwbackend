const Exercise = require('../models/Exercise');

// Get all exercises with optional filters
exports.getExercises = async (req, res) => {
  try {
    const { search, category, equipment, difficulty } = req.query;
    let query = {};
    
    // Build query based on filters
    if (search) {
      query.$text = { $search: search };
    }
    if (category && category !== 'all') {
      query.muscleCategory = category;
    }
    if (equipment && equipment !== 'all') {
      query.equipmentNeeded = equipment;
    }
    if (difficulty && difficulty !== 'all') {
      query.difficulty = difficulty;
    }
    
    const exercises = await Exercise.find(query).sort('name');
    
    // Simple, direct response - just the array
    res.json(exercises);
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Get single exercise by ID
exports.getExerciseById = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({ 
        success: false,
        message: 'Exercise not found' 
      });
    }
    
    // Return just the exercise object
    res.json(exercise);
  } catch (error) {
    console.error('Get exercise by ID error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Create new exercise
exports.createExercise = async (req, res) => {
  try {
    const exercise = await Exercise.create({
      ...req.body,
     createdBy: req.user._id
    });
    
    // Return the created exercise
    res.status(201).json(exercise);
  } catch (error) {
    console.error('Create exercise error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Update exercise
exports.updateExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!exercise) {
      return res.status(404).json({ 
        success: false,
        message: 'Exercise not found' 
      });
    }
    
    // Return updated exercise
    res.json(exercise);
  } catch (error) {
    console.error('Update exercise error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Delete exercise
exports.deleteExercise = async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndDelete(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({ 
        success: false,
        message: 'Exercise not found' 
      });
    }
    
    // Return success message
    res.json({ 
      success: true,
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    console.error('Delete exercise error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// Get related exercises by muscle group
exports.getRelatedExercises = async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    
    if (!exercise) {
      return res.status(404).json({ 
        success: false,
        message: 'Exercise not found' 
      });
    }
    
    // Find similar exercises
    const related = await Exercise.find({
      _id: { $ne: exercise._id },
      $or: [
        { muscleCategory: exercise.muscleCategory },
        { secondaryMuscles: { $in: [exercise.muscleCategory] } }
      ]
    }).limit(6);
    
    // Return array of related exercises
    res.json(related);
  } catch (error) {
    console.error('Get related exercises error:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};
