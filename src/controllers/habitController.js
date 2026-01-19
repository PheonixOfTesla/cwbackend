// Src/controllers/habitController.js - Habit Tracking Controller
// Full CRUD + completion tracking for habits

const Habit = require('../models/Habit');

// ============================================
// GET ALL HABITS
// ============================================
exports.getHabits = async (req, res) => {
    try {
        const userId = req.user.id;
        const { includeArchived = false } = req.query;

        const query = { userId, isActive: true };
        if (!includeArchived) {
            query.isArchived = false;
        }

        const habits = await Habit.find(query).sort({ order: 1 });

        // Add today's completion status
        const today = new Date().toISOString().split('T')[0];
        const habitsWithStatus = habits.map(habit => {
            const todayCompletion = habit.completions.find(
                c => c.date.toISOString().split('T')[0] === today
            );
            return {
                ...habit.toObject(),
                completedToday: todayCompletion?.completed || false,
                todayValue: todayCompletion?.value || null
            };
        });

        res.json({
            success: true,
            habits: habitsWithStatus,
            count: habits.length
        });
    } catch (error) {
        console.error('Get habits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get habits',
            error: error.message
        });
    }
};

// ============================================
// GET SINGLE HABIT
// ============================================
exports.getHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const habit = await Habit.findOne({ _id: id, userId });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        // Get completion stats for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentCompletions = habit.completions
            .filter(c => c.date >= thirtyDaysAgo)
            .sort((a, b) => b.date - a.date);

        res.json({
            success: true,
            habit,
            stats: {
                currentStreak: habit.currentStreak,
                longestStreak: habit.longestStreak,
                completionRate: habit.completionRate,
                totalCompletions: habit.totalCompletions,
                last30Days: recentCompletions
            }
        });
    } catch (error) {
        console.error('Get habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get habit',
            error: error.message
        });
    }
};

// ============================================
// CREATE HABIT
// ============================================
exports.createHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            name,
            description,
            icon,
            color,
            category,
            frequency,
            specificDays,
            timesPerWeek,
            targetTime,
            trackingType,
            targetValue,
            unit,
            reminderEnabled,
            reminderTime,
            reminderDays
        } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Habit name is required'
            });
        }

        // Get max order for user
        const maxOrder = await Habit.findOne({ userId })
            .sort({ order: -1 })
            .select('order');

        const habit = await Habit.create({
            userId,
            name,
            description,
            icon: icon || 'check-circle',
            color: color || '#f97316',
            category: category || 'custom',
            frequency: frequency || 'daily',
            specificDays: specificDays || [],
            timesPerWeek: timesPerWeek || 7,
            targetTime,
            trackingType: trackingType || 'boolean',
            targetValue: targetValue || 1,
            unit: unit || '',
            reminderEnabled: reminderEnabled || false,
            reminderTime,
            reminderDays: reminderDays || [],
            order: (maxOrder?.order || 0) + 1
        });

        res.status(201).json({
            success: true,
            habit,
            message: 'Habit created successfully'
        });
    } catch (error) {
        console.error('Create habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create habit',
            error: error.message
        });
    }
};

// ============================================
// UPDATE HABIT
// ============================================
exports.updateHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = req.body;

        // Remove fields that shouldn't be updated directly
        delete updates.userId;
        delete updates.completions;
        delete updates.currentStreak;
        delete updates.longestStreak;
        delete updates.totalCompletions;
        delete updates.completionRate;

        const habit = await Habit.findOneAndUpdate(
            { _id: id, userId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        res.json({
            success: true,
            habit,
            message: 'Habit updated successfully'
        });
    } catch (error) {
        console.error('Update habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update habit',
            error: error.message
        });
    }
};

// ============================================
// DELETE HABIT
// ============================================
exports.deleteHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { permanent = false } = req.query;

        if (permanent) {
            await Habit.deleteOne({ _id: id, userId });
        } else {
            // Soft delete - archive
            await Habit.findOneAndUpdate(
                { _id: id, userId },
                { $set: { isArchived: true, isActive: false } }
            );
        }

        res.json({
            success: true,
            message: permanent ? 'Habit permanently deleted' : 'Habit archived'
        });
    } catch (error) {
        console.error('Delete habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete habit',
            error: error.message
        });
    }
};

// ============================================
// COMPLETE HABIT
// ============================================
exports.completeHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { date, value, notes } = req.body;

        const habit = await Habit.findOne({ _id: id, userId });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        await habit.complete(date || new Date(), value, notes);

        res.json({
            success: true,
            habit,
            message: 'Habit completed!',
            streak: habit.currentStreak,
            isNewRecord: habit.currentStreak === habit.longestStreak && habit.currentStreak > 1
        });
    } catch (error) {
        console.error('Complete habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete habit',
            error: error.message
        });
    }
};

// ============================================
// UNCOMPLETE HABIT
// ============================================
exports.uncompleteHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { date } = req.body;

        const habit = await Habit.findOne({ _id: id, userId });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        await habit.uncomplete(date || new Date());

        res.json({
            success: true,
            habit,
            message: 'Habit unmarked'
        });
    } catch (error) {
        console.error('Uncomplete habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to uncomplete habit',
            error: error.message
        });
    }
};

// ============================================
// TOGGLE HABIT (Quick toggle for today)
// ============================================
exports.toggleHabit = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const habit = await Habit.findOne({ _id: id, userId });

        if (!habit) {
            return res.status(404).json({
                success: false,
                message: 'Habit not found'
            });
        }

        const today = new Date().toISOString().split('T')[0];
        const todayCompletion = habit.completions.find(
            c => c.date.toISOString().split('T')[0] === today
        );

        if (todayCompletion?.completed) {
            await habit.uncomplete(new Date());
        } else {
            await habit.complete(new Date());
        }

        const isNowCompleted = !todayCompletion?.completed;

        res.json({
            success: true,
            habit,
            completed: isNowCompleted,
            streak: habit.currentStreak,
            message: isNowCompleted ? 'Habit completed!' : 'Habit unmarked'
        });
    } catch (error) {
        console.error('Toggle habit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle habit',
            error: error.message
        });
    }
};

// ============================================
// GET TODAY'S HABITS STATUS
// ============================================
exports.getTodayStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        const habits = await Habit.getActiveWithStatus(userId);

        const today = new Date();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];

        // Filter to habits due today
        const dueToday = habits.filter(h => {
            if (h.frequency === 'daily') return true;
            if (h.frequency === 'weekdays' && !['saturday', 'sunday'].includes(dayName)) return true;
            if (h.frequency === 'weekends' && ['saturday', 'sunday'].includes(dayName)) return true;
            if (h.frequency === 'specific-days' && h.specificDays?.includes(dayName)) return true;
            return false;
        });

        const completed = dueToday.filter(h => h.completedToday).length;
        const total = dueToday.length;
        const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        res.json({
            success: true,
            date: today.toISOString().split('T')[0],
            dayName,
            habits: dueToday,
            summary: {
                completed,
                total,
                remaining: total - completed,
                completionPercentage
            }
        });
    } catch (error) {
        console.error('Get today status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get today\'s habits',
            error: error.message
        });
    }
};

// ============================================
// REORDER HABITS
// ============================================
exports.reorderHabits = async (req, res) => {
    try {
        const userId = req.user.id;
        const { habitIds } = req.body; // Array of habit IDs in new order

        if (!Array.isArray(habitIds)) {
            return res.status(400).json({
                success: false,
                message: 'habitIds must be an array'
            });
        }

        // Update order for each habit
        const updates = habitIds.map((id, index) =>
            Habit.updateOne({ _id: id, userId }, { $set: { order: index } })
        );

        await Promise.all(updates);

        res.json({
            success: true,
            message: 'Habits reordered'
        });
    } catch (error) {
        console.error('Reorder habits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reorder habits',
            error: error.message
        });
    }
};

// ============================================
// GET WEEKLY SUMMARY
// ============================================
exports.getWeeklySummary = async (req, res) => {
    try {
        const userId = req.user.id;

        const habits = await Habit.find({ userId, isActive: true, isArchived: false });

        // Get last 7 days
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            days.push(date);
        }

        const weekData = days.map(day => {
            const dateStr = day.toISOString().split('T')[0];
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()];

            let completed = 0;
            let total = 0;

            habits.forEach(habit => {
                if (habit.shouldCountDay(day)) {
                    total++;
                    const completion = habit.completions.find(
                        c => c.date.toISOString().split('T')[0] === dateStr && c.completed
                    );
                    if (completion) completed++;
                }
            });

            return {
                date: dateStr,
                dayName,
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0
            };
        });

        // Calculate overall stats
        const totalCompleted = weekData.reduce((sum, d) => sum + d.completed, 0);
        const totalDue = weekData.reduce((sum, d) => sum + d.total, 0);

        res.json({
            success: true,
            weekData,
            summary: {
                totalCompleted,
                totalDue,
                weeklyPercentage: totalDue > 0 ? Math.round((totalCompleted / totalDue) * 100) : 0,
                activeHabits: habits.length,
                perfectDays: weekData.filter(d => d.completed === d.total && d.total > 0).length
            }
        });
    } catch (error) {
        console.error('Get weekly summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get weekly summary',
            error: error.message
        });
    }
};

// ============================================
// CREATE DEFAULT HABITS
// ============================================
exports.createDefaults = async (req, res) => {
    try {
        const userId = req.user.id;
        const { discipline } = req.body;

        // Check if user already has habits
        const existing = await Habit.countDocuments({ userId });
        if (existing > 0) {
            return res.status(400).json({
                success: false,
                message: 'User already has habits. Delete existing habits first.'
            });
        }

        const habits = await Habit.createDefaults(userId, discipline);

        res.status(201).json({
            success: true,
            habits,
            message: `Created ${habits.length} default habits`
        });
    } catch (error) {
        console.error('Create defaults error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create default habits',
            error: error.message
        });
    }
};

module.exports = exports;
