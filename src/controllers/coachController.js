const CoachApplication = require('../models/CoachApplication');
const CoachProfile = require('../models/CoachProfile');
const CoachProgram = require('../models/CoachProgram');
const CoachSubscription = require('../models/CoachSubscription');
const User = require('../models/User');
const stripeConnect = require('../services/stripeConnect');
const streamChat = require('../services/streamChat');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Browse approved coaches (public marketplace)
 * GET /api/coaches
 */
exports.browseCoaches = async (req, res) => {
  try {
    const {
      specialty,
      minRating,
      accepting,
      sort = 'featured',
      page = 1,
      limit = 20
    } = req.query;

    const query = { isPublic: true };

    if (specialty) {
      query.specialties = { $in: [specialty] };
    }
    if (minRating) {
      query.averageRating = { $gte: parseFloat(minRating) };
    }
    if (accepting === 'true') {
      query.isAcceptingClients = true;
    }

    let sortOption = {};
    switch (sort) {
      case 'rating':
        sortOption = { averageRating: -1 };
        break;
      case 'newest':
        sortOption = { createdAt: -1 };
        break;
      case 'featured':
      default:
        sortOption = { featured: -1, averageRating: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [coaches, total] = await Promise.all([
      CoachProfile.find(query)
        .populate('userId', 'name email')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit)),
      CoachProfile.countDocuments(query)
    ]);

    res.json({
      coaches,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Browse coaches error:', error);
    res.status(500).json({ message: 'Error fetching coaches' });
  }
};

/**
 * Get single coach profile
 * GET /api/coaches/:id
 */
exports.getCoachProfile = async (req, res) => {
  try {
    const coach = await CoachProfile.findById(req.params.id)
      .populate('userId', 'name email');

    if (!coach || !coach.isPublic) {
      return res.status(404).json({ message: 'Coach not found' });
    }

    res.json(coach);
  } catch (error) {
    console.error('Get coach error:', error);
    res.status(500).json({ message: 'Error fetching coach' });
  }
};

/**
 * Get coach's programs
 * GET /api/coaches/:id/programs
 */
exports.getCoachPrograms = async (req, res) => {
  try {
    const programs = await CoachProgram.find({
      coachId: req.params.id,
      isActive: true
    }).sort({ displayOrder: 1 });

    res.json(programs);
  } catch (error) {
    console.error('Get programs error:', error);
    res.status(500).json({ message: 'Error fetching programs' });
  }
};

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * Submit coach application
 * POST /api/coaches/apply
 */
exports.submitApplication = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check for existing application
    const existing = await CoachApplication.findOne({
      userId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
      return res.status(400).json({
        message: existing.status === 'pending'
          ? 'You already have a pending application'
          : 'You are already an approved coach'
      });
    }

    const application = new CoachApplication({
      userId,
      specialties: req.body.specialties,
      certifications: req.body.certifications,
      experience: req.body.experience,
      affiliationType: req.body.affiliationType || 'independent',
      gymId: req.body.gymId
    });

    await application.save();

    res.status(201).json({
      message: 'Application submitted successfully',
      application
    });
  } catch (error) {
    console.error('Submit application error:', error);
    res.status(500).json({ message: 'Error submitting application' });
  }
};

/**
 * Check own application status
 * GET /api/coaches/application
 */
exports.getApplicationStatus = async (req, res) => {
  try {
    const application = await CoachApplication.findOne({
      userId: req.user._id
    }).sort({ createdAt: -1 });

    if (!application) {
      return res.json({ hasApplication: false });
    }

    res.json({ hasApplication: true, application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Error fetching application' });
  }
};

// ============================================
// COACH PORTAL ROUTES
// ============================================

/**
 * Get coach dashboard stats
 * GET /api/coach/portal
 */
exports.getPortalStats = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const [activeClients, totalRevenue, pendingMessages] = await Promise.all([
      CoachSubscription.countDocuments({
        coachId: coachProfile._id,
        status: { $in: ['active', 'trialing'] }
      }),
      CoachSubscription.aggregate([
        { $match: { coachId: coachProfile._id } },
        { $group: { _id: null, total: { $sum: '$totalPaid' } } }
      ]),
      // Placeholder for messaging count
      Promise.resolve(0)
    ]);

    res.json({
      activeClients,
      totalRevenue: totalRevenue[0]?.total || 0,
      averageRating: coachProfile.averageRating,
      totalReviews: coachProfile.totalReviews,
      pendingMessages,
      stripeConnected: coachProfile.stripeOnboardingComplete,
      calcomConnected: !!coachProfile.calcomUsername
    });
  } catch (error) {
    console.error('Get portal stats error:', error);
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

/**
 * Get own coach profile
 * GET /api/coach/profile
 */
exports.getOwnProfile = async (req, res) => {
  try {
    const profile = await CoachProfile.findOne({ userId: req.user._id });
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get own profile error:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
};

/**
 * Update own coach profile
 * PUT /api/coach/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const allowedUpdates = [
      'displayName', 'tagline', 'bio', 'profileImage', 'coverImage',
      'specialties', 'calcomUsername', 'isAcceptingClients', 'socialLinks',
      'contactEmail', 'isPublic'
    ];

    const updates = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const profile = await CoachProfile.findOneAndUpdate(
      { userId: req.user._id },
      updates,
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
};

// ============================================
// PROGRAM MANAGEMENT
// ============================================

/**
 * Create program
 * POST /api/coach/programs
 */
exports.createProgram = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const program = new CoachProgram({
      coachId: coachProfile._id,
      ...req.body
    });

    await program.save();

    // Create Stripe product/price if coach has connected account
    if (coachProfile.stripeConnectAccountId && coachProfile.stripeOnboardingComplete) {
      try {
        const { productId, priceId } = await stripeConnect.createProgramProduct(
          coachProfile.stripeConnectAccountId,
          program
        );
        program.stripeProductId = productId;
        program.stripePriceId = priceId;
        await program.save();
      } catch (stripeError) {
        console.error('Stripe product creation error:', stripeError);
      }
    }

    res.status(201).json(program);
  } catch (error) {
    console.error('Create program error:', error);
    res.status(500).json({ message: 'Error creating program' });
  }
};

/**
 * Update program
 * PUT /api/coach/programs/:id
 */
exports.updateProgram = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const program = await CoachProgram.findOneAndUpdate(
      { _id: req.params.id, coachId: coachProfile._id },
      req.body,
      { new: true }
    );

    if (!program) {
      return res.status(404).json({ message: 'Program not found' });
    }

    res.json(program);
  } catch (error) {
    console.error('Update program error:', error);
    res.status(500).json({ message: 'Error updating program' });
  }
};

/**
 * Delete program
 * DELETE /api/coach/programs/:id
 */
exports.deleteProgram = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const program = await CoachProgram.findOneAndUpdate(
      { _id: req.params.id, coachId: coachProfile._id },
      { isActive: false },
      { new: true }
    );

    if (!program) {
      return res.status(404).json({ message: 'Program not found' });
    }

    res.json({ message: 'Program deleted' });
  } catch (error) {
    console.error('Delete program error:', error);
    res.status(500).json({ message: 'Error deleting program' });
  }
};

/**
 * Get coach's own programs
 * GET /api/coach/programs
 */
exports.getOwnPrograms = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const programs = await CoachProgram.find({
      coachId: coachProfile._id
    }).sort({ displayOrder: 1 });

    res.json(programs);
  } catch (error) {
    console.error('Get own programs error:', error);
    res.status(500).json({ message: 'Error fetching programs' });
  }
};

// ============================================
// CLIENT MANAGEMENT
// ============================================

/**
 * Get coach's clients
 * GET /api/coach/clients
 */
exports.getClients = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const subscriptions = await CoachSubscription.find({
      coachId: coachProfile._id,
      status: { $in: ['active', 'trialing'] }
    })
      .populate('clientId', 'name email')
      .populate('programId', 'title');

    res.json(subscriptions);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ message: 'Error fetching clients' });
  }
};

/**
 * Get revenue analytics
 * GET /api/coach/revenue
 */
exports.getRevenue = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [subscriptions, recentPayments] = await Promise.all([
      CoachSubscription.aggregate([
        { $match: { coachId: coachProfile._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: '$totalPaid' }
          }
        }
      ]),
      CoachSubscription.find({
        coachId: coachProfile._id,
        updatedAt: { $gte: thirtyDaysAgo }
      }).sort({ updatedAt: -1 }).limit(10)
    ]);

    res.json({
      subscriptionStats: subscriptions,
      recentActivity: recentPayments,
      platformFeePercent: 20
    });
  } catch (error) {
    console.error('Get revenue error:', error);
    res.status(500).json({ message: 'Error fetching revenue' });
  }
};

// ============================================
// STRIPE CONNECT
// ============================================

/**
 * Start Stripe Connect onboarding
 * POST /api/coach/stripe/connect
 */
exports.startStripeConnect = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile) {
      return res.status(404).json({ message: 'Coach profile not found' });
    }

    let accountId = coachProfile.stripeConnectAccountId;

    // Create account if doesn't exist
    if (!accountId) {
      const account = await stripeConnect.createConnectAccount(
        req.user.email,
        req.user._id
      );
      accountId = account.id;
      coachProfile.stripeConnectAccountId = accountId;
      await coachProfile.save();
    }

    // Generate onboarding link
    const frontendUrl = process.env.FRONTEND_URL || 'https://coastal-fitness.vercel.app';
    const onboardingUrl = await stripeConnect.createOnboardingLink(
      accountId,
      `${frontendUrl}/coach-portal?stripe=success`,
      `${frontendUrl}/coach-portal?stripe=refresh`
    );

    res.json({ url: onboardingUrl });
  } catch (error) {
    console.error('Stripe connect error:', error);
    res.status(500).json({ message: 'Error starting Stripe onboarding' });
  }
};

/**
 * Check Stripe account status
 * GET /api/coach/stripe/status
 */
exports.getStripeStatus = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile || !coachProfile.stripeConnectAccountId) {
      return res.json({ connected: false });
    }

    const status = await stripeConnect.checkAccountStatus(
      coachProfile.stripeConnectAccountId
    );

    // Update profile if onboarding completed
    if (status.chargesEnabled && status.payoutsEnabled && !coachProfile.stripeOnboardingComplete) {
      coachProfile.stripeOnboardingComplete = true;
      await coachProfile.save();
    }

    res.json({
      connected: true,
      ...status,
      onboardingComplete: coachProfile.stripeOnboardingComplete
    });
  } catch (error) {
    console.error('Stripe status error:', error);
    res.status(500).json({ message: 'Error checking Stripe status' });
  }
};

/**
 * Get Stripe dashboard link
 * POST /api/coach/stripe/dashboard
 */
exports.getStripeDashboard = async (req, res) => {
  try {
    const coachProfile = await CoachProfile.findOne({ userId: req.user._id });
    if (!coachProfile || !coachProfile.stripeConnectAccountId) {
      return res.status(400).json({ message: 'Stripe not connected' });
    }

    const url = await stripeConnect.createDashboardLink(
      coachProfile.stripeConnectAccountId
    );

    res.json({ url });
  } catch (error) {
    console.error('Stripe dashboard error:', error);
    res.status(500).json({ message: 'Error getting dashboard link' });
  }
};

// ============================================
// CAL.COM
// ============================================

/**
 * Save cal.com username
 * POST /api/coach/calcom/connect
 */
exports.connectCalcom = async (req, res) => {
  try {
    const { username } = req.body;

    const profile = await CoachProfile.findOneAndUpdate(
      { userId: req.user._id },
      { calcomUsername: username },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }

    res.json({ message: 'Cal.com connected', calcomUsername: username });
  } catch (error) {
    console.error('Calcom connect error:', error);
    res.status(500).json({ message: 'Error connecting Cal.com' });
  }
};

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * Get pending applications (admin)
 * GET /api/admin/coach-applications
 */
exports.getPendingApplications = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;

    const applications = await CoachApplication.find({ status })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Error fetching applications' });
  }
};

/**
 * Approve/reject application (admin)
 * PUT /api/admin/coach-applications/:id
 */
exports.reviewApplication = async (req, res) => {
  try {
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const application = await CoachApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    application.status = status;
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    application.reviewNotes = notes;
    await application.save();

    // If approved, create coach profile and update user role
    if (status === 'approved') {
      const user = await User.findById(application.userId);

      // Create coach profile
      const coachProfile = new CoachProfile({
        userId: application.userId,
        displayName: user.name,
        specialties: application.specialties,
        bio: application.experience?.bio,
        isIndependent: application.affiliationType === 'independent',
        gymId: application.gymId
      });
      await coachProfile.save();

      // Update user
      if (!user.roles.includes('coach')) {
        user.roles.push('coach');
      }
      user.coachProfile = coachProfile._id;
      await user.save();

      // Create Stream Chat user
      try {
        await streamChat.upsertUser({
          userId: user._id,
          name: user.name,
          isCoach: true
        });
      } catch (chatError) {
        console.error('Stream Chat user creation error:', chatError);
      }
    }

    res.json({ message: `Application ${status}`, application });
  } catch (error) {
    console.error('Review application error:', error);
    res.status(500).json({ message: 'Error reviewing application' });
  }
};

/**
 * Get all coaches (admin)
 * GET /api/admin/coaches
 */
exports.getAllCoaches = async (req, res) => {
  try {
    const coaches = await CoachProfile.find()
      .populate('userId', 'name email roles')
      .sort({ createdAt: -1 });

    res.json(coaches);
  } catch (error) {
    console.error('Get all coaches error:', error);
    res.status(500).json({ message: 'Error fetching coaches' });
  }
};

/**
 * Get platform revenue (admin)
 * GET /api/admin/coach-revenue
 */
exports.getPlatformRevenue = async (req, res) => {
  try {
    const stats = await CoachSubscription.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalPaid' },
          platformFees: { $sum: '$platformFeeCollected' },
          totalSubscriptions: { $sum: 1 }
        }
      }
    ]);

    const activeSubscriptions = await CoachSubscription.countDocuments({
      status: { $in: ['active', 'trialing'] }
    });

    res.json({
      ...stats[0],
      activeSubscriptions
    });
  } catch (error) {
    console.error('Get platform revenue error:', error);
    res.status(500).json({ message: 'Error fetching revenue' });
  }
};
