const Workout = require('../models/Workout');
const Exercise = require('../models/Exercise');

// Helper function for safe database operations
const safeDbOperation = async (operation, res, successMessage) => {
  try {
    const result = await operation();
    return result;
  } catch (error) {
    console.error(`Database operation failed: ${error.message}`);
    throw error;
  }
};

// GET all workouts for a client
exports.getWorkoutsByClient = async (req, res) => {
  try {
    console.log('Fetching workouts for client:', req.params.clientId);
    
    const workouts = await safeDbOperation(
      () => Workout.find({ 
        clientId: req.params.clientId 
      })
      .sort('-scheduledDate -createdAt')
      .lean(),
      res,
      'Workouts fetched'
    );
    
    // Always return array, even if empty
    res.json(workouts || []);
  } catch (error) {
    console.error('Error in getWorkoutsByClient:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching workouts',
      data: [] // Return empty array on error
    });
  }
};

// GET single workout by ID
exports.getWorkoutById = async (req, res) => {
  try {
    const workout = await safeDbOperation(
      () => Workout.findById(req.params.id)
        .populate('clientId', 'name email')
        .populate('assignedBy', 'name')
        .lean(),
      res,
      'Workout found'
    );
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found',
        data: null
      });
    }
    
    res.json({
      success: true,
      data: workout
    });
  } catch (error) {
    console.error('Error fetching workout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching workout',
      data: null
    });
  }
};

// CREATE new workout
exports.createWorkout = async (req, res) => {
  try {
    console.log('Creating workout:', {
      name: req.body.name,
      clientId: req.params.clientId,
      exerciseCount: req.body.exercises?.length || 0
    });
    
    // Prepare workout data with extensive validation
    const workoutData = {
      name: req.body.name || 'Unnamed Workout',
      clientId: req.params.clientId || req.body.clientId,
      assignedBy: req.user?.id || req.user?._id,
      createdBy: req.user?.id || req.user?._id,
      scheduledDate: req.body.scheduledDate || new Date(),
      youtubeLink: req.body.youtubeLink || '',
      repeatWeekly: req.body.repeatWeekly || false,
      exercises: []
    };
    
    // Process and validate exercises
    if (req.body.exercises && Array.isArray(req.body.exercises)) {
      workoutData.exercises = req.body.exercises.map((exercise, index) => {
        try {
          return {
            name: exercise.name || `Exercise ${index + 1}`,
            sets: Math.max(1, parseInt(exercise.sets) || 3),
            reps: String(exercise.reps || '10'),
            weight: Math.max(0, parseFloat(exercise.weight) || 0),
            holdTime: Math.max(0, parseInt(exercise.holdTime) || 0),
            notes: (exercise.notes || '').substring(0, 500),
            grouping: exercise.grouping || 'none',
            youtubeLink: exercise.youtubeLink || '',
            completed: false
          };
        } catch (err) {
          console.error(`Error processing exercise ${index}:`, err);
          return {
            name: `Exercise ${index + 1}`,
            sets: 3,
            reps: '10',
            weight: 0,
            holdTime: 0,
            notes: '',
            grouping: 'none',
            youtubeLink: '',
            completed: false
          };
        }
      });
    }
    
    // Ensure at least one exercise
    if (workoutData.exercises.length === 0) {
      workoutData.exercises.push({
        name: 'Default Exercise',
        sets: 3,
        reps: '10',
        weight: 0,
        holdTime: 0,
        notes: '',
        grouping: 'none',
        youtubeLink: '',
        completed: false
      });
    }
    
    // Create workout with error recovery
    let workout;
    try {
      workout = await Workout.create(workoutData);
    } catch (validationError) {
      console.error('Validation error, attempting with defaults:', validationError.message);
      
      // Retry with minimal valid data
      const minimalData = {
        name: workoutData.name,
        clientId: workoutData.clientId,
        assignedBy: workoutData.assignedBy || workoutData.createdBy,
        createdBy: workoutData.createdBy,
        exercises: [{
          name: 'Default Exercise',
          sets: 3,
          reps: '10',
          weight: 0
        }]
      };
      
      workout = await Workout.create(minimalData);
    }
    
    // Handle repeat weekly
    if (req.body.repeatWeekly && req.body.scheduledDate) {
      try {
        const additionalWorkouts = [];
        const baseDate = new Date(req.body.scheduledDate);
        
        for (let week = 1; week <= 3; week++) {
          const newDate = new Date(baseDate);
          newDate.setDate(baseDate.getDate() + (week * 7));
          
          additionalWorkouts.push({
            ...workoutData,
            scheduledDate: newDate,
            parentWorkout: workout._id
          });
        }
        
        await Workout.insertMany(additionalWorkouts);
      } catch (repeatError) {
        console.error('Error creating repeated workouts:', repeatError);
        // Continue without repeats
      }
    }
    
    res.status(201).json({
      success: true,
      data: workout,
      message: 'Workout created successfully'
    });
  } catch (error) {
    console.error('Error creating workout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error creating workout: ' + error.message,
      data: null
    });
  }
};

// UPDATE workout
exports.updateWorkout = async (req, res) => {
  try {
    const workoutId = req.params.workoutId || req.params.id;
    console.log('Updating workout:', workoutId);
    
    // Process update data
    const updateData = { ...req.body };
    
    // Clean exercises if provided
    if (updateData.exercises && Array.isArray(updateData.exercises)) {
      updateData.exercises = updateData.exercises.map((exercise, index) => ({
        name: exercise.name || `Exercise ${index + 1}`,
        sets: Math.max(1, parseInt(exercise.sets) || 3),
        reps: String(exercise.reps || '10'),
        weight: Math.max(0, parseFloat(exercise.weight) || 0),
        holdTime: Math.max(0, parseInt(exercise.holdTime) || 0),
        notes: (exercise.notes || '').substring(0, 500),
        grouping: exercise.grouping || 'none',
        youtubeLink: exercise.youtubeLink || '',
        completed: exercise.completed || false
      }));
    }
    
    const workout = await Workout.findByIdAndUpdate(
      workoutId,
      updateData,
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    );
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    res.json({
      success: true,
      data: workout,
      message: 'Workout updated successfully'
    });
  } catch (error) {
    console.error('Error updating workout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating workout: ' + error.message 
    });
  }
};

// DELETE workout
exports.deleteWorkout = async (req, res) => {
  try {
    const workoutId = req.params.workoutId || req.params.id;
    
    const workout = await Workout.findByIdAndDelete(workoutId);
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    // Delete any repeated workouts
    try {
      await Workout.deleteMany({ parentWorkout: workout._id });
    } catch (err) {
      console.log('No repeated workouts to delete');
    }
    
    res.json({
      success: true,
      message: 'Workout deleted successfully',
      data: workout
    });
  } catch (error) {
    console.error('Error deleting workout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error deleting workout' 
    });
  }
};

// COMPLETE workout
exports.completeWorkout = async (req, res) => {
  try {
    const workoutId = req.params.workoutId || req.params.id;
    console.log('Completing workout:', workoutId);
    
    const workout = await Workout.findById(workoutId);
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    // Update completion status
    workout.completed = true;
    workout.completedDate = new Date();
    workout.completedAt = workout.completedDate;
    workout.duration = req.body.duration || 0;
    workout.moodFeedback = req.body.moodFeedback || 3;
    workout.notes = req.body.notes || '';
    workout.averagePainLevel = req.body.averagePainLevel || 0;
    
    // Store session data if provided
    if (req.body.sessionData && Array.isArray(req.body.sessionData)) {
      workout.sessionData = req.body.sessionData;
    }
    
    await workout.save();
    
    res.json({
      success: true,
      data: workout,
      message: 'Workout completed successfully'
    });
  } catch (error) {
    console.error('Error completing workout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error completing workout' 
    });
  }
};

// START workout session
exports.startWorkout = async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);
    
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    workout.startedAt = new Date();
    await workout.save();
    
    res.json({
      success: true,
      data: workout,
      message: 'Workout session started'
    });
  } catch (error) {
    console.error('Error starting workout:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error starting workout' 
    });
  }
};

// UPDATE exercise progress
exports.updateExerciseProgress = async (req, res) => {
  try {
    const { workoutId, exerciseIndex, setData } = req.body;
    
    const workout = await Workout.findById(workoutId);
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    if (workout.exercises[exerciseIndex]) {
      if (!workout.exercises[exerciseIndex].actualSets) {
        workout.exercises[exerciseIndex].actualSets = [];
      }
      workout.exercises[exerciseIndex].actualSets.push(setData);
      workout.exercises[exerciseIndex].completed = true;
    }
    
    await workout.save();
    
    res.json({
      success: true,
      data: workout,
      message: 'Exercise progress updated'
    });
  } catch (error) {
    console.error('Error updating exercise progress:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating progress' 
    });
  }
};

// GET previous exercise data (for progressive overload)
exports.getPreviousExerciseData = async (req, res) => {
  try {
    const { clientId, exerciseName } = req.params;
    
    const previousWorkouts = await Workout.find({
      clientId,
      completed: true,
      'exercises.name': new RegExp(exerciseName, 'i')
    })
    .sort('-completedDate')
    .limit(5)
    .lean();
    
    const exerciseHistory = [];
    previousWorkouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        if (exercise.name.toLowerCase().includes(exerciseName.toLowerCase())) {
          exerciseHistory.push({
            date: workout.completedDate,
            weight: exercise.weight,
            sets: exercise.sets,
            reps: exercise.reps,
            notes: exercise.notes
          });
        }
      });
    });
    
    res.json({
      success: true,
      data: exerciseHistory
    });
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching exercise history',
      data: []
    });
  }
};

// GET exercise history
exports.getExerciseHistory = async (req, res) => {
  try {
    const { clientId, exerciseName } = req.params;
    
    const workouts = await Workout.find({
      clientId,
      'exercises.name': new RegExp(exerciseName, 'i')
    })
    .sort('-scheduledDate')
    .lean();
    
    const history = [];
    workouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        if (exercise.name.toLowerCase().includes(exerciseName.toLowerCase())) {
          history.push({
            workoutId: workout._id,
            workoutName: workout.name,
            date: workout.scheduledDate,
            completed: workout.completed,
            exercise: exercise
          });
        }
      });
    });
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching exercise history:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching history',
      data: []
    });
  }
};

// UPDATE multiple sets at once
exports.updateMultipleSets = async (req, res) => {
  try {
    const { sets } = req.body;
    const workoutId = req.params.id;
    
    const workout = await Workout.findById(workoutId);
    if (!workout) {
      return res.status(404).json({ 
        success: false,
        message: 'Workout not found' 
      });
    }
    
    // Update all sets at once
    if (sets && Array.isArray(sets)) {
      sets.forEach(({ exerciseIndex, setData }) => {
        if (workout.exercises[exerciseIndex]) {
          if (!workout.exercises[exerciseIndex].actualSets) {
            workout.exercises[exerciseIndex].actualSets = [];
          }
          workout.exercises[exerciseIndex].actualSets = setData;
          workout.exercises[exerciseIndex].completed = true;
        }
      });
    }
    
    await workout.save();
    
    res.json({
      success: true,
      data: workout,
      message: 'Sets updated successfully'
    });
  } catch (error) {
    console.error('Error updating sets:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error updating sets' 
    });
  }
};
