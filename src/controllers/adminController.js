// Src/controllers/adminController.js - Admin Dashboard API
const User = require('../models/User');
const Workout = require('../models/Workout');
const Program = require('../models/Program');
const InfluencerApplication = require('../models/InfluencerApplication');
const Influencer = require('../models/Influencer');
const CoachSubscription = require('../models/CoachSubscription');
const CoachClient = require('../models/CoachClient');
const Earnings = require('../models/Earnings');
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

// GET /api/admin/earnings - Fetch all earnings records with pagination
const getEarnings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [earnings, total] = await Promise.all([
      Earnings.find({})
        .populate('user', 'email name userType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Earnings.countDocuments({})
    ]);

    res.json({
      success: true,
      earnings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Admin getEarnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings',
      error: error.message
    });
  }
};

// GET /api/admin/earnings/summary - Calculate earnings summary statistics
const getEarningsSummary = async (req, res) => {
  try {
    // Aggregate total earnings, referrals, and conversions across all users
    const summary = await Earnings.aggregate([
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: '$lifetime.total' },
          totalReferrals: { $sum: '$stats.signups' },
          totalConversions: { $sum: '$stats.conversions' }
        }
      }
    ]);

    // If no earnings exist, return zeros
    const result = summary.length > 0 ? summary[0] : {
      totalEarnings: 0,
      totalReferrals: 0,
      totalConversions: 0
    };

    res.json({
      success: true,
      summary: {
        totalEarnings: result.totalEarnings || 0,
        totalReferrals: result.totalReferrals || 0,
        totalConversions: result.totalConversions || 0
      }
    });
  } catch (error) {
    console.error('Admin getEarningsSummary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings summary',
      error: error.message
    });
  }
};

// GET /api/admin/coaches/applications - List coach applications
const getCoachApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    // Build query for coaches with unverified profiles
    const query = {
      userType: 'coach'
    };

    // Filter by verification status if provided
    if (status === 'pending') {
      query['coachProfile.verified'] = false;
    } else if (status === 'approved') {
      query['coachProfile.verified'] = true;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [applications, total] = await Promise.all([
      User.find(query)
        .select('name email coachProfile.specialty coachProfile.bio coachProfile.verified coachProfile.experienceYears createdAt')
        .sort({ createdAt: 'desc' })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query)
    ]);

    console.log(`Admin getCoachApplications: Found ${total} applications (status: ${status || 'all'})`);

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
    console.error('Admin getCoachApplications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coach applications.',
      error: error.message
    });
  }
};

// POST /api/admin/coaches/:userId/approve - Approve coach application
const approveCoach = async (req, res) => {
  const { userId } = req.params;
  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Verify user is a coach
    if (user.userType !== 'coach') {
      return res.status(400).json({
        success: false,
        message: 'User is not a coach.'
      });
    }

    // Check if already verified
    if (user.coachProfile?.verified === true) {
      return res.status(400).json({
        success: false,
        message: 'Coach is already verified.'
      });
    }

    // Initialize coachProfile if it doesn't exist
    if (!user.coachProfile) {
      user.coachProfile = {};
    }

    // Set verified to true
    user.coachProfile.verified = true;
    await user.save();

    console.log(`Admin approveCoach: Approved coach ${user.email} (ID: ${userId})`);

    // TODO: Send approval email when coach email templates are created
    // await sendCoachApprovalEmail(user.email, user.name);

    res.json({
      success: true,
      message: 'Coach application approved successfully.',
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        verified: user.coachProfile.verified
      }
    });

  } catch (error) {
    console.error('Admin approveCoach error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving coach.',
      error: error.message
    });
  }
};

// POST /api/admin/coaches/:userId/reject - Reject coach application
const rejectCoach = async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;
  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Verify user is a coach
    if (user.userType !== 'coach') {
      return res.status(400).json({
        success: false,
        message: 'User is not a coach.'
      });
    }

    // Check if already rejected
    if (user.coachProfile?.verified === false && user.coachProfile?.rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Coach application has already been rejected.'
      });
    }

    // Initialize coachProfile if it doesn't exist
    if (!user.coachProfile) {
      user.coachProfile = {};
    }

    // Set verified to false and store rejection reason
    user.coachProfile.verified = false;
    if (reason) {
      user.coachProfile.rejectionReason = reason;
    }
    await user.save();

    console.log(`Admin rejectCoach: Rejected coach ${user.email} (ID: ${userId})${reason ? ` - Reason: ${reason}` : ''}`);

    // TODO: Send rejection email when coach email templates are created
    // await sendCoachRejectionEmail(user.email, user.name, reason);

    res.json({
      success: true,
      message: 'Coach application rejected.',
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        verified: user.coachProfile.verified,
        reason: reason || null
      }
    });

  } catch (error) {
    console.error('Admin rejectCoach error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting coach.',
      error: error.message
    });
  }
};

// GET /api/admin/coaches/income - Get income statistics for all coaches
const getCoachIncome = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      sortBy = 'totalIncome',
      sortOrder = 'desc'
    } = req.query;

    // Find all verified coaches
    const coaches = await User.find({
      userType: 'coach',
      'coachProfile.verified': true
    })
      .select('name email coachProfile.profilePicture coachProfile.specialty')
      .lean();

    if (coaches.length === 0) {
      return res.json({
        success: true,
        data: {
          coaches: [],
          summary: {
            totalCoaches: 0,
            totalIncome: 0,
            totalClients: 0,
            totalSubscribers: 0,
            averageIncome: 0
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        }
      });
    }

    // Get coach IDs
    const coachIds = coaches.map(coach => coach._id);

    // Fetch income data in parallel
    const [subscriptionStats, clientCounts, earningsData] = await Promise.all([
      // Get subscription stats (CoachSubscription model)
      CoachSubscription.aggregate([
        {
          $match: {
            coachId: { $in: coachIds },
            status: 'active',
            coachApproved: true
          }
        },
        {
          $group: {
            _id: '$coachId',
            contentSubscribers: {
              $sum: { $cond: [{ $eq: ['$tier', 'content'] }, 1, 0] }
            },
            coachingClients: {
              $sum: { $cond: [{ $eq: ['$tier', 'coaching'] }, 1, 0] }
            },
            monthlyRecurring: { $sum: '$price' },
            totalEarned: { $sum: '$totalPaid' }
          }
        }
      ]),

      // Get direct client counts (CoachClient model)
      CoachClient.aggregate([
        {
          $match: {
            coach: { $in: coachIds },
            status: 'active'
          }
        },
        {
          $group: {
            _id: '$coach',
            directClients: { $sum: 1 }
          }
        }
      ]),

      // Get earnings data (Earnings model)
      Earnings.find({
        user: { $in: coachIds },
        earnerType: 'coach'
      })
        .select('user lifetime.fromCoaching lifetime.total balance.available')
        .lean()
    ]);

    // Create lookup maps
    const subscriptionMap = new Map();
    subscriptionStats.forEach(stat => {
      subscriptionMap.set(stat._id.toString(), stat);
    });

    const clientMap = new Map();
    clientCounts.forEach(count => {
      clientMap.set(count._id.toString(), count.directClients);
    });

    const earningsMap = new Map();
    earningsData.forEach(earning => {
      earningsMap.set(earning.user.toString(), earning);
    });

    // Combine data for each coach
    const coachesWithIncome = coaches.map(coach => {
      const coachId = coach._id.toString();
      const subscriptionData = subscriptionMap.get(coachId) || {
        contentSubscribers: 0,
        coachingClients: 0,
        monthlyRecurring: 0,
        totalEarned: 0
      };
      const directClients = clientMap.get(coachId) || 0;
      const earningsData = earningsMap.get(coachId) || {
        lifetime: { fromCoaching: 0, total: 0 },
        balance: { available: 0 }
      };

      // Calculate total income (from subscriptions + direct coaching earnings)
      const totalIncome = subscriptionData.totalEarned + earningsData.lifetime.fromCoaching;

      // Total subscribers count
      const totalSubscribers = subscriptionData.contentSubscribers + subscriptionData.coachingClients;

      // Total clients (subscription coaching + direct clients)
      const totalClients = subscriptionData.coachingClients + directClients;

      return {
        id: coach._id,
        name: coach.name,
        email: coach.email,
        specialty: coach.coachProfile?.specialty || '',
        profilePicture: coach.coachProfile?.profilePicture || '',
        totalIncome: Math.round(totalIncome / 100), // Convert cents to dollars
        monthlyRecurring: Math.round(subscriptionData.monthlyRecurring / 100),
        clients: totalClients,
        subscribers: totalSubscribers,
        contentSubscribers: subscriptionData.contentSubscribers,
        coachingClients: subscriptionData.coachingClients,
        directClients: directClients,
        lifetimeEarnings: Math.round(earningsData.lifetime.total / 100),
        availableBalance: Math.round(earningsData.balance.available / 100)
      };
    });

    // Sort coaches
    const sortField = sortBy === 'totalIncome' ? 'totalIncome'
                    : sortBy === 'clients' ? 'clients'
                    : sortBy === 'subscribers' ? 'subscribers'
                    : sortBy === 'monthlyRecurring' ? 'monthlyRecurring'
                    : 'totalIncome';

    const sortMultiplier = sortOrder === 'asc' ? 1 : -1;
    coachesWithIncome.sort((a, b) => {
      return (a[sortField] - b[sortField]) * sortMultiplier;
    });

    // Pagination
    const total = coachesWithIncome.length;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedCoaches = coachesWithIncome.slice(skip, skip + parseInt(limit));

    // Calculate summary stats
    const summary = {
      totalCoaches: total,
      totalIncome: coachesWithIncome.reduce((sum, c) => sum + c.totalIncome, 0),
      totalClients: coachesWithIncome.reduce((sum, c) => sum + c.clients, 0),
      totalSubscribers: coachesWithIncome.reduce((sum, c) => sum + c.subscribers, 0),
      averageIncome: total > 0 ? Math.round(coachesWithIncome.reduce((sum, c) => sum + c.totalIncome, 0) / total) : 0
    };

    res.json({
      success: true,
      data: {
        coaches: paginatedCoaches,
        summary,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    console.error('Admin getCoachIncome error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch coach income data',
      error: error.message
    });
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
  denyInfluencerApplication,
  getEarnings,
  getEarningsSummary,
  getCoachApplications,
  approveCoach,
  rejectCoach,
  getCoachIncome
};
