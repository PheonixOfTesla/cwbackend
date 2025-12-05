const Gym = require('../models/Gym');
const User = require('../models/User');

// Create new gym (island)
exports.createGym = async (req, res) => {
    try {
        const gymData = {
            ...req.body,
            ownerId: req.user.id,
            subscription: {
                tier: req.body.tier || 'SOLO',
                status: 'trial',
                trialStartDate: new Date(),
                trialEndsAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)), // 7 days
                stripeCustomerId: `cus_placeholder_${Date.now()}`,
                currentPeriodEnd: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))
            }
        };
        
        const gym = await Gym.create(gymData);
        
        // Update owner's gymId
        await User.findByIdAndUpdate(req.user.id, { gymId: gym._id });
        
        res.status(201).json({
            success: true,
            message: 'Island created successfully',
            data: gym
        });
    } catch (error) {
        console.error('Create gym error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get gym by ID
exports.getGymById = async (req, res) => {
    try {
        const gym = await Gym.findById(req.params.id)
            .populate('ownerId', 'name email')
            .populate('staff.userId', 'name email');
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        res.json({
            success: true,
            data: gym
        });
    } catch (error) {
        console.error('Get gym error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all gyms (master dashboard - owner/engineer only)
exports.getAllGyms = async (req, res) => {
    try {
        const { status, tier } = req.query;
        let query = {};
        
        if (status) query['subscription.status'] = status;
        if (tier) query['subscription.tier'] = tier;
        
        const gyms = await Gym.find(query)
            .populate('ownerId', 'name email')
            .sort('-createdAt');
        
        res.json({
            success: true,
            count: gyms.length,
            data: gyms
        });
    } catch (error) {
        console.error('Get all gyms error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update gym
exports.updateGym = async (req, res) => {
    try {
        const gym = await Gym.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Gym updated successfully',
            data: gym
        });
    } catch (error) {
        console.error('Update gym error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete gym (island)
exports.deleteGym = async (req, res) => {
    try {
        const gym = await Gym.findById(req.params.id);
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        // Remove gymId from all users in this gym
        await User.updateMany(
            { gymId: req.params.id },
            { $unset: { gymId: 1 } }
        );
        
        await Gym.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Island deleted successfully'
        });
    } catch (error) {
        console.error('Delete gym error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get gym setup progress
exports.getGymProgress = async (req, res) => {
    try {
        const gym = await Gym.findById(req.params.id);
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                setupProgress: gym.setupProgress,
                percentage: gym.setupPercentage,
                trialDaysRemaining: gym.trialDaysRemaining,
                subscriptionStatus: gym.subscription.status
            }
        });
    } catch (error) {
        console.error('Get gym progress error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update setup progress step
exports.updateSetupProgress = async (req, res) => {
    try {
        const { step } = req.body;
        
        const gym = await Gym.findById(req.params.id);
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        if (gym.setupProgress[step] !== undefined) {
            await gym.completeSetupStep(step);
        }
        
        res.json({
            success: true,
            data: {
                setupProgress: gym.setupProgress,
                percentage: gym.setupPercentage
            }
        });
    } catch (error) {
        console.error('Update setup progress error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Upgrade tier
exports.upgradeTier = async (req, res) => {
    try {
        const { tier } = req.body;
        const gym = await Gym.findById(req.params.id);
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        await gym.upgradeTier(tier);
        
        res.json({
            success: true,
            message: `Upgraded to ${tier} tier`,
            data: gym
        });
    } catch (error) {
        console.error('Upgrade tier error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Activate subscription (after Stripe payment)
exports.activateSubscription = async (req, res) => {
    try {
        const { stripeSubscriptionId } = req.body;
        const gym = await Gym.findById(req.params.id);
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        await gym.activateSubscription(stripeSubscriptionId);
        
        res.json({
            success: true,
            message: 'Subscription activated',
            data: gym
        });
    } catch (error) {
        console.error('Activate subscription error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get gym analytics
exports.getGymAnalytics = async (req, res) => {
    try {
        const gym = await Gym.findById(req.params.id);
        
        if (!gym) {
            return res.status(404).json({
                success: false,
                message: 'Gym not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                totalClients: gym.totalClients,
                totalWorkouts: gym.totalWorkouts,
                totalClasses: gym.totalClasses,
                totalRevenue: gym.totalRevenue,
                monthlyRevenue: gym.monthlyRevenue,
                specialistCount: gym.specialistCount,
                specialistLimitReached: gym.specialistLimitReached,
                lastActivityDate: gym.lastActivityDate
            }
        });
    } catch (error) {
        console.error('Get gym analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};