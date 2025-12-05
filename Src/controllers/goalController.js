const Goal = require('../models/Goal');

exports.getGoalsByClient = async (req, res) => {
  try {
    const goals = await Goal.find({ 
      clientId: req.params.clientId 
    }).sort('-createdAt');
    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createGoal = async (req, res) => {
  try {
    // Ensure startingValue is set if not provided
    const goalData = {
      ...req.body,
      clientId: req.params.clientId,
      assignedBy: req.user.id,
      createdBy: req.user.id
    };
    
    // If startingValue not provided, use current value
    if (goalData.startingValue === undefined || goalData.startingValue === null) {
      goalData.startingValue = goalData.current || 0;
    }
    
    const goal = await Goal.create(goalData);
    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    // Handle progress update
    if (req.body.progressHistory) {
      const goal = await Goal.findById(req.params.id);
      if (!goal) {
        return res.status(404).json({ message: 'Goal not found' });
      }
      
      // Update current value and add to progress history
      goal.current = req.body.current;
      goal.progressHistory = req.body.progressHistory;
      
      // Save and let the pre-save hook handle completion status
      const updatedGoal = await goal.save();
      return res.json(updatedGoal);
    }
    
    // Handle full goal update
    const goal = await Goal.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }
    res.json(goal);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findByIdAndDelete(req.params.id);
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }
    res.json({ message: 'Goal deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};