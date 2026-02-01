// src/controllers/goalController.js
const Goal = require('../models/Goal');

exports.getGoalsByClient = async (req, res) => {
    try {
        const goals = await Goal.find({ 
            clientId: req.params.clientId 
        }).sort('-createdAt');
        
        // Always return array
        res.json(goals || []);
    } catch (error) {
        console.error('Error fetching goals:', error);
        res.status(500).json({ 
            message: error.message,
            data: []
        });
    }
};

exports.createGoal = async (req, res) => {
    try {
        console.log('Creating goal with data:', req.body);
        
        // Prepare goal data with proper date handling
        const goalData = {
            ...req.body,
            clientId: req.params.clientId,
            assignedBy: req.user.id,
            createdBy: req.user.id
        };
        
        // Handle deadline - ensure it's a valid date
        if (goalData.deadline) {
            // If it's already an ISO string, parse it
            // If it's YYYY-MM-DD format, add time to avoid timezone issues
            const deadlineStr = goalData.deadline;
            if (deadlineStr.includes('T')) {
                // Already ISO format
                goalData.deadline = new Date(deadlineStr);
            } else {
                // YYYY-MM-DD format - add noon time to avoid timezone issues
                goalData.deadline = new Date(`${deadlineStr}T12:00:00`);
            }
            
            // Validate the date
            if (isNaN(goalData.deadline.getTime())) {
                console.error('Invalid deadline date:', deadlineStr);
                goalData.deadline = new Date(); // Default to today if invalid
            }
        }
        
        // Ensure startingValue is set
        if (goalData.startingValue === undefined || goalData.startingValue === null) {
            goalData.startingValue = goalData.current || 0;
        }
        
        // For habits, ensure proper defaults
        if (goalData.isHabit) {
            goalData.target = 1;
            goalData.current = 0;
            goalData.startingValue = 0;
            goalData.scheduledDays = goalData.scheduledDays || [];
            goalData.completions = {};
        }
        
        console.log('Processed goal data:', goalData);
        
        const goal = await Goal.create(goalData);
        res.status(201).json(goal);
    } catch (error) {
        console.error('Error creating goal:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.updateGoal = async (req, res) => {
    try {
        console.log('Updating goal:', req.params.id);
        console.log('Update data:', req.body);
        
        // Get the existing goal first
        const existingGoal = await Goal.findById(req.params.id);
        if (!existingGoal) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        
        // Handle progress update (when just updating current value)
        if (req.body.progressHistory) {
            existingGoal.current = req.body.current;
            existingGoal.progressHistory = req.body.progressHistory;
            
            const updatedGoal = await existingGoal.save();
            return res.json(updatedGoal);
        }
        
        // Handle full update
        const updateData = { ...req.body };
        
        // Handle deadline date
        if (updateData.deadline) {
            const deadlineStr = updateData.deadline;
            if (deadlineStr.includes('T')) {
                updateData.deadline = new Date(deadlineStr);
            } else {
                // Add noon time to avoid timezone issues
                updateData.deadline = new Date(`${deadlineStr}T12:00:00`);
            }
            
            // Validate
            if (isNaN(updateData.deadline.getTime())) {
                delete updateData.deadline; // Don't update if invalid
            }
        }
        
        // For habit completions update
        if (updateData.completions !== undefined) {
            // This is a habit completion toggle
            existingGoal.completions = updateData.completions;
            const updatedGoal = await existingGoal.save();
            return res.json(updatedGoal);
        }
        
        // Standard update
        const goal = await Goal.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );
        
        if (!goal) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        
        res.json(goal);
    } catch (error) {
        console.error('Error updating goal:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.deleteGoal = async (req, res) => {
    try {
        const goal = await Goal.findByIdAndDelete(req.params.id);
        if (!goal) {
            return res.status(404).json({ message: 'Goal not found' });
        }
        res.json({ message: 'Goal deleted successfully' });
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get goal statistics for a client
exports.getGoalStats = async (req, res) => {
    try {
        const goals = await Goal.find({ 
            clientId: req.params.clientId,
            isHabit: false 
        });
        
        const completedGoals = goals.filter(g => g.completed);
        const activeGoals = goals.filter(g => !g.completed);
        
        // Calculate average progress
        let totalProgress = 0;
        activeGoals.forEach(goal => {
            if (goal.target && goal.target !== 0) {
                const progress = Math.min((goal.current / goal.target) * 100, 100);
                totalProgress += progress;
            }
        });
        
        const avgProgress = activeGoals.length > 0 
            ? Math.round(totalProgress / activeGoals.length)
            : 0;
        
        res.json({
            totalGoals: goals.length,
            completedGoals: completedGoals.length,
            activeGoals: activeGoals.length,
            completionRate: goals.length > 0 
                ? Math.round((completedGoals.length / goals.length) * 100)
                : 0,
            averageProgress: avgProgress
        });
    } catch (error) {
        console.error('Error fetching goal stats:', error);
        res.status(500).json({ message: error.message });
    }
};

// Update habit completion for a specific date
exports.toggleHabitCompletion = async (req, res) => {
    try {
        const { habitId } = req.params;
        const { date, completed } = req.body;
        
        const habit = await Goal.findById(habitId);
        if (!habit || !habit.isHabit) {
            return res.status(404).json({ message: 'Habit not found' });
        }
        
        if (!habit.completions) {
            habit.completions = {};
        }
        
        // Use date string as key
        const dateKey = new Date(date).toDateString();
        
        if (completed) {
            habit.completions[dateKey] = true;
        } else {
            delete habit.completions[dateKey];
        }
        
        // Mark as modified since we're updating a Map
        habit.markModified('completions');
        
        const updatedHabit = await habit.save();
        res.json(updatedHabit);
    } catch (error) {
        console.error('Error updating habit completion:', error);
        res.status(500).json({ message: error.message });
    }
};
