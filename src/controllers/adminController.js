// Src/controllers/adminController.js - Admin Dashboard API
const User = require('../models/User');
const Workout = require('../models/Workout');
const Program = require('../models/Program');
const InfluencerApplication = require('../models/InfluencerApplication');
const Influencer = require('../models/Influencer');
const crypto = require('crypto');
const { sendInfluencerApprovalEmail, sendInfluencerDenialEmail, sendNewInfluencerWelcomeEmail } = require('../utils/email');
const { getVIPEmails } = require('../middleware/adminAuth');

// GET /api/admin/users - List all users with search/filter
const getUsers = async (req, res) => {
  try {
    const {
      search,
      userType,
      tier,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search by email or name
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by user type
    if (userType && ['coach', 'client', 'individual'].includes(userType)) {
      query.userType = userType;
    }

    // Filter by subscription tier
    if (tier) {
      query['subscription.tier'] = tier;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .select('email name userType subscription.tier subscription.status createdAt lastLogin isActive')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    // Get VIP emails for display
    const vipEmails = getVIPEmails();

    // Mark env-based VIPs in the response
    const usersWithVIPStatus = users.map(user => ({
      ...user,
      isEnvVIP: vipEmails.includes(user.email.toLowerCase())
    }));

    res.json({
      success: true,
      data: {
        users: usersWithVIPStatus,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Admin getUsers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// GET /api/admin/stats - App insights and statistics
const getStats = async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // User statistics
    const [
      totalUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeUsersToday,
      activeUsersThisWeek,
      usersByType,
      usersByTier
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: oneDayAgo } }),
      User.countDocuments({ createdAt: { $gte: oneWeekAgo } }),
      User.countDocuments({ createdAt: { $gte: oneMonthAgo } }),
      User.countDocuments({ lastLogin: { $gte: oneDayAgo } }),
      User.countDocuments({ lastLogin: { $gte: oneWeekAgo } }),
      User.aggregate([
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $group: { _id: '$subscription.tier', count: { $sum: 1 } } }
      ])
    ]);

    // Convert aggregations to objects
    const usersByTypeObj = {};
    usersByType.forEach(item => {
      usersByTypeObj[item._id || 'unknown'] = item.count;
    });

    const usersByTierObj = {};
    usersByTier.forEach(item => {
      usersByTierObj[item._id || 'free'] = item.count;
    });

    // Workout and program stats (if models exist)
    let totalWorkouts = 0;
    let totalPrograms = 0;
    try {
      totalWorkouts = await Workout.countDocuments();
    } catch (e) { /* Model may not exist */ }
    try {
      totalPrograms = await Program.countDocuments();
    } catch (e) { /* Model may not exist */ }

    // Subscribers breakdown (paid tiers)
    const paidTiers = ['pro', 'vip', 'elite', 'coach_starter', 'coach_pro', 'coach_scale', 'coach_enterprise'];
    const subscribers = await User.aggregate([
      { $match: { 'subscription.tier': { $in: paidTiers }, 'subscription.status': 'active' } },
      { $group: { _id: '$subscription.tier', count: { $sum: 1 } } }
    ]);

    const subscribersObj = {};
    let totalSubscribers = 0;
    subscribers.forEach(item => {
      subscribersObj[item._id] = item.count;
      totalSubscribers += item.count;
    });

    // VIP count
    const vipCount = await User.countDocuments({ 'subscription.tier': 'vip' });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalSubscribers,
          vipUsers: vipCount,
          totalWorkouts,
          totalPrograms
        },
        signups: {
          today: newUsersToday,
          thisWeek: newUsersThisWeek,
          thisMonth: newUsersThisMonth
        },
        activity: {
          activeToday: activeUsersToday,
          activeThisWeek: activeUsersThisWeek
        },
        usersByType: usersByTypeObj,
        usersByTier: usersByTierObj,
        subscribers: subscribersObj,
        generatedAt: now.toISOString()
      }
    });
  } catch (error) {
    console.error('Admin getStats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
};

// POST /api/admin/vip - Add VIP user
const addVIP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update to VIP
    user.subscription = user.subscription || {};
    user.subscription.tier = 'vip';
    user.subscription.status = 'active';
    await user.save();

    res.json({
      success: true,
      message: `${email} has been upgraded to VIP`,
      data: {
        email: user.email,
        name: user.name,
        tier: user.subscription.tier
      }
    });
  } catch (error) {
    console.error('Admin addVIP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add VIP',
      error: error.message
    });
  }
};

// DELETE /api/admin/vip/:email - Remove VIP user
const removeVIP = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check if user is in VIP_EMAILS env var
    const vipEmails = getVIPEmails();
    if (vipEmails.includes(email.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove VIP status for users in VIP_EMAILS environment variable. Remove from env var first.'
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.subscription?.tier !== 'vip') {
      return res.status(400).json({
        success: false,
        message: 'User is not a VIP'
      });
    }

    // Downgrade to free
    user.subscription.tier = 'free';
    await user.save();

    res.json({
      success: true,
      message: `${email} VIP status has been removed`,
      data: {
        email: user.email,
        name: user.name,
        tier: user.subscription.tier
      }
    });
  } catch (error) {
    console.error('Admin removeVIP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove VIP',
      error: error.message
    });
  }
};

// GET /api/admin/vip - List all VIP users
const getVIPUsers = async (req, res) => {
  try {
    const vipUsers = await User.find({ 'subscription.tier': 'vip' })
      .select('email name createdAt lastLogin')
      .sort({ createdAt: -1 })
      .lean();

    const vipEmails = getVIPEmails();

    const usersWithEnvStatus = vipUsers.map(user => ({
      ...user,
      isEnvVIP: vipEmails.includes(user.email.toLowerCase())
    }));

    res.json({
      success: true,
      data: {
        vipUsers: usersWithEnvStatus,
        total: vipUsers.length,
        envVIPEmails: vipEmails
      }
    });
  } catch (error) {
    console.error('Admin getVIPUsers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch VIP users',
      error: error.message
    });
  }
};

const getInfluencerApplications = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const query = { status };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [applications, total] = await Promise.all([
      InfluencerApplication.find(query)
        .sort({ createdAt: 'desc' })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      InfluencerApplication.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Admin getInfluencerApplications error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch influencer applications.' });
  }
};

const approveInfluencerApplication = async (req, res) => {
    const { id } = req.params;
    try {
        const application = await InfluencerApplication.findById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        if (application.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Application has already been processed.' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: application.email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email already exists. They should sign in at /influencer instead.'
            });
        }

        // Generate approval token (valid for 7 days)
        const approvalToken = crypto.randomBytes(32).toString('hex');
        const approvalTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // Generate affiliate code
        const affiliateCode = `${application.name.split(' ')[0].toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

        // Update application
        application.status = 'approved';
        application.approvalToken = approvalToken;
        application.approvalTokenExpires = approvalTokenExpires;
        application.approvedAt = new Date();
        application.approvedBy = req.user?.id || null;
        application.affiliateCode = affiliateCode;
        await application.save();

        // Send approval email with account creation link
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const accountSetupUrl = `${frontendUrl}/influencer?token=${approvalToken}`;

        await sendInfluencerApprovalEmail(
            application.email,
            application.name,
            affiliateCode,
            accountSetupUrl
        );

        res.json({
            success: true,
            message: 'Application approved and email sent with account setup link.',
            data: {
                email: application.email,
                name: application.name,
                affiliateCode,
                expiresIn: '7 days'
            }
        });

    } catch (error) {
        console.error('Admin approveInfluencerApplication error:', error);
        res.status(500).json({ success: false, message: 'Server error while approving application.' });
    }
};

const denyInfluencerApplication = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
        const application = await InfluencerApplication.findById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found.' });
        }
        if (application.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'Application has already been processed.' });
        }

        application.status = 'denied';
        if (reason) {
            application.adminNotes = reason;
        }
        await application.save();

        // Send denial email
        await sendInfluencerDenialEmail(application.email, application.name, reason);
        
        res.json({ success: true, message: 'Influencer application denied.' });

    } catch (error) {
        console.error('Admin denyInfluencerApplication error:', error);
        res.status(500).json({ success: false, message: 'Server error while denying application.' });
    }
};

module.exports = {
  getUsers,
  getStats,
  addVIP,
  removeVIP,
  getVIPUsers,
  getInfluencerApplications,
  approveInfluencerApplication,
  denyInfluencerApplication
};
