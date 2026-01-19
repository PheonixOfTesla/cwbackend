// Src/controllers/coachController.js - Coach Management Controller
const User = require('../models/User');
const CoachClient = require('../models/CoachClient');
const Workout = require('../models/Workout');
const Session = require('../models/Session');
const { ALL_EXERCISES } = require('../data/exerciseLibrary');
const crypto = require('crypto');

// ============================================
// GET COACHES LIST (Public - for signup)
// ============================================
exports.getCoachesList = async (req, res) => {
  try {
    const coaches = await User.find({
      userType: 'coach',
      isActive: true
    })
    .select('name email coachProfile')
    .sort({ 'coachProfile.experienceYears': -1, createdAt: -1 })
    .limit(100);

    const coachList = coaches.map(coach => ({
      _id: coach._id,
      name: coach.name,
      specialty: coach.coachProfile?.specialty || 'General Fitness',
      bio: coach.coachProfile?.bio || '',
      profilePicture: coach.coachProfile?.profilePicture || '',
      experienceYears: coach.coachProfile?.experienceYears || 0
    }));

    res.json({
      success: true,
      coaches: coachList
    });

  } catch (error) {
    console.error('Get coaches list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get coaches list',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET COACH PROFILE
// ============================================
exports.getCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can access this endpoint'
      });
    }

    const user = await User.findById(userId).select('name email coachProfile userType subscription createdAt');

    res.json({
      success: true,
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        userType: user.userType,
        coachProfile: user.coachProfile,
        subscription: user.subscription,
        memberSince: user.createdAt
      }
    });

  } catch (error) {
    console.error('Get coach profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get coach profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPDATE COACH PROFILE
// ============================================
exports.updateCoachProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { specialty, bio, experienceYears, certifications } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can update coach profile'
      });
    }

    const updateData = {};
    if (specialty !== undefined) updateData['coachProfile.specialty'] = specialty;
    if (bio !== undefined) updateData['coachProfile.bio'] = bio;
    if (experienceYears !== undefined) updateData['coachProfile.experienceYears'] = experienceYears;
    if (certifications !== undefined) updateData['coachProfile.certifications'] = certifications;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('name email coachProfile');

    res.json({
      success: true,
      message: 'Coach profile updated successfully',
      profile: user
    });

  } catch (error) {
    console.error('Update coach profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update coach profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPLOAD PROFILE PICTURE
// ============================================
exports.uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageData } = req.body; // Base64 encoded image

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can upload profile pictures'
      });
    }

    if (!imageData) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }

    // For now, store base64 directly
    // TODO: In production, upload to S3/Cloudinary and store URL
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { 'coachProfile.profilePicture': imageData } },
      { new: true }
    ).select('coachProfile.profilePicture');

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: user.coachProfile.profilePicture
    });

  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET MY CLIENTS
// ============================================
exports.getMyClients = async (req, res) => {
  try {
    const coachId = req.user.id;

    // Verify user is a coach
    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can access this endpoint'
      });
    }

    const relationships = await CoachClient.find({ coach: coachId })
      .populate('client', 'name email profile experience onboarding lastLogin createdAt')
      .sort({ invitedAt: -1, startDate: -1 });

    const clients = relationships.map(rel => ({
      _id: rel._id, // Relationship ID (for approve/reject actions)
      id: rel._id,  // Compatibility
      client: rel.client ? {
        _id: rel.client._id,
        id: rel.client._id,
        name: rel.client.name,
        email: rel.client.email,
        profile: rel.client.profile,
        experience: rel.client.experience,
        onboardingCompleted: rel.client.onboarding?.completed || false,
        lastLogin: rel.client.lastLogin,
        createdAt: rel.client.createdAt
      } : {
        // For pending invitations that haven't been accepted yet
        email: rel.invitationEmail,
        name: 'Pending Invitation'
      },
      status: rel.status,
      invitedAt: rel.invitedAt,
      acceptedAt: rel.acceptedAt,
      startDate: rel.startDate,
      coachNotes: rel.coachNotes,
      currentProgram: rel.currentProgram,
      durationDays: rel.durationDays
    }));

    // Get counts by status
    const counts = {
      active: relationships.filter(r => r.status === 'active').length,
      pending: relationships.filter(r => r.status === 'pending').length,
      paused: relationships.filter(r => r.status === 'paused').length,
      total: relationships.length
    };

    res.json({
      success: true,
      clients,
      counts,
      clientLimit: req.user.getClientLimit()
    });

  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get clients',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// INVITE CLIENT
// ============================================
exports.inviteClient = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { email, name } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can invite clients'
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Client email is required'
      });
    }

    // Check client limit
    const currentCount = await CoachClient.countActiveClients(coachId);
    const limit = req.user.getClientLimit();

    if (currentCount >= limit) {
      return res.status(403).json({
        success: false,
        message: `You have reached your client limit (${limit}). Upgrade your plan to add more clients.`
      });
    }

    // Check if client already exists
    let client = await User.findOne({ email: email.toLowerCase() });

    if (client) {
      // Check if relationship already exists
      const existingRelationship = await CoachClient.findOne({
        coach: coachId,
        client: client._id
      });

      if (existingRelationship) {
        return res.status(400).json({
          success: false,
          message: 'This client is already in your roster'
        });
      }

      // Check if client already has a coach
      if (client.userType === 'client' && client.coachId) {
        return res.status(400).json({
          success: false,
          message: 'This user already has a coach'
        });
      }
    }

    // Generate invitation code
    const invitationCode = crypto.randomBytes(16).toString('hex');

    // Create pending relationship
    const relationship = await CoachClient.create({
      coach: coachId,
      client: client?._id || null,
      status: 'pending',
      invitationEmail: email.toLowerCase(),
      invitationCode,
      invitedAt: new Date()
    });

    // TODO: Send invitation email
    console.log(`📧 Invitation sent to ${email} with code: ${invitationCode}`);

    res.status(201).json({
      success: true,
      message: client ? 'Invitation sent to existing user' : 'Invitation sent to new user',
      invitation: {
        id: relationship._id,
        email,
        code: invitationCode,
        status: 'pending',
        invitedAt: relationship.invitedAt
      }
    });

  } catch (error) {
    console.error('Invite client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to invite client',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ACCEPT INVITATION (Client side)
// ============================================
exports.acceptInvitation = async (req, res) => {
  try {
    const { invitationCode } = req.params;
    const userId = req.user.id;

    const relationship = await CoachClient.findOne({
      invitationCode,
      status: 'pending'
    }).populate('coach', 'name email');

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }

    // Update user to client type
    const user = await User.findById(userId);
    user.userType = 'client';
    user.coachId = relationship.coach._id;
    await user.save();

    // Update relationship
    relationship.client = userId;
    relationship.status = 'active';
    relationship.acceptedAt = new Date();
    relationship.startDate = new Date();
    await relationship.save();

    res.json({
      success: true,
      message: 'Invitation accepted! You are now connected with your coach.',
      coach: {
        id: relationship.coach._id,
        name: relationship.coach.name,
        email: relationship.coach.email
      }
    });

  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// APPROVE CLIENT REQUEST
// ============================================
exports.approveClient = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { relationshipId } = req.params;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can approve clients'
      });
    }

    const relationship = await CoachClient.findOne({
      _id: relationshipId,
      coach: coachId,
      status: 'pending'
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Pending client request not found'
      });
    }

    // Activate the relationship
    await relationship.activate();

    // Update client's userType to 'client' if they're currently individual
    if (relationship.client) {
      await User.findByIdAndUpdate(relationship.client, {
        userType: 'client',
        coachId: coachId
      });

      // Real-time notification to client
      if (global.io) {
        const coach = await User.findById(coachId).select('name email coachProfile');
        global.io.notifyClientApproved(relationship.client, {
          id: coach._id,
          name: coach.name,
          email: coach.email,
          specialty: coach.coachProfile?.specialty
        });
      }
    }

    res.json({
      success: true,
      message: 'Client approved successfully'
    });

  } catch (error) {
    console.error('Approve client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve client',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// REMOVE CLIENT
// ============================================
exports.removeClient = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { relationshipId } = req.params;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can remove clients'
      });
    }

    const relationship = await CoachClient.findOne({
      _id: relationshipId,
      coach: coachId
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Client relationship not found'
      });
    }

    // If pending, just delete it; if active, end it gracefully
    const wasPending = relationship.status === 'pending';

    if (wasPending) {
      await CoachClient.findByIdAndDelete(relationshipId);
    } else {
      await relationship.end();
    }

    // Update client's userType back to individual if they had a client
    if (relationship.client) {
      await User.findByIdAndUpdate(relationship.client, {
        userType: 'individual',
        coachId: null
      });

      // Real-time notification to client
      if (global.io && wasPending) {
        const coach = await User.findById(coachId).select('name email');
        global.io.notifyClientRejected(relationship.client, {
          id: coach._id,
          name: coach.name
        });
      }
    }

    res.json({
      success: true,
      message: 'Client removed successfully'
    });

  } catch (error) {
    console.error('Remove client error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove client',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPDATE CLIENT NOTES
// ============================================
exports.updateClientNotes = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { clientId } = req.params;
    const { notes } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can update client notes'
      });
    }

    const relationship = await CoachClient.findOneAndUpdate(
      { coach: coachId, client: clientId },
      { coachNotes: notes },
      { new: true }
    );

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Client relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Notes updated',
      notes: relationship.coachNotes
    });

  } catch (error) {
    console.error('Update notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET CLIENT PROGRESS
// ============================================
exports.getClientProgress = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { clientId } = req.params;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can view client progress'
      });
    }

    // Verify coach-client relationship
    const relationship = await CoachClient.findOne({
      coach: coachId,
      client: clientId,
      status: 'active'
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Active client relationship not found'
      });
    }

    // Get client data
    const client = await User.findById(clientId)
      .select('name email profile experience primaryGoal schedule onboarding lastLogin');

    // Get workout stats (would need Workout model)
    // const workoutStats = await Workout.aggregate([...])

    res.json({
      success: true,
      client: {
        id: client._id,
        name: client.name,
        email: client.email,
        profile: client.profile,
        experience: client.experience,
        primaryGoal: client.primaryGoal,
        schedule: client.schedule,
        onboardingCompleted: client.onboarding?.completed,
        lastLogin: client.lastLogin
      },
      relationship: {
        startDate: relationship.startDate,
        durationDays: relationship.durationDays,
        notes: relationship.coachNotes,
        assignedGoals: relationship.assignedGoals
      }
      // workoutStats would go here
    });

  } catch (error) {
    console.error('Get client progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// CREATE WORKOUT FOR CLIENT (with Exercise Library Integration)
// ============================================
exports.createWorkout = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { clientId } = req.params;
    const { name, exercises, scheduledDate, notes } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can create workouts'
      });
    }

    // Verify coach-client relationship
    const relationship = await CoachClient.findOne({
      coach: coachId,
      client: clientId,
      status: 'active'
    });

    if (!relationship) {
      return res.status(403).json({
        success: false,
        message: 'No active relationship with this client'
      });
    }

    // Enrich exercises with library data (video links)
    const enrichedExercises = exercises.map(exercise => {
      if (exercise.exerciseId && ALL_EXERCISES) {
        const libraryExercise = ALL_EXERCISES.find(ex => ex.id === exercise.exerciseId);
        if (libraryExercise) {
          return {
            ...exercise,
            name: exercise.name || libraryExercise.name,
            // Add library metadata for frontend use
            _libraryData: {
              id: libraryExercise.id,
              name: libraryExercise.name,
              videoUrl: `/exercises/library/${libraryExercise.id}`,
              primary: libraryExercise.primary,
              equipment: libraryExercise.equipment
            }
          };
        }
      }
      return exercise;
    });

    const workout = await Workout.create({
      name,
      clientId,
      createdBy: coachId,
      assignedBy: coachId,
      exercises: enrichedExercises,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      notes: notes || ''
    });

    await workout.populate('clientId', 'name email');

    // Real-time notification to client
    if (global.io) {
      global.io.notifyClientNewWorkout(clientId, {
        id: workout._id,
        name: workout.name,
        scheduledDate: workout.scheduledDate,
        exerciseCount: workout.exercises.length,
        notes: workout.notes
      });
    }

    res.status(201).json({
      success: true,
      message: 'Workout created and assigned to client',
      workout: {
        id: workout._id,
        name: workout.name,
        clientName: workout.clientId.name,
        scheduledDate: workout.scheduledDate,
        exerciseCount: workout.exercises.length,
        exercises: workout.exercises
      }
    });

  } catch (error) {
    console.error('Create workout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create workout',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET CLIENT WORKOUTS
// ============================================
exports.getClientWorkouts = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { clientId } = req.params;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can access client workouts'
      });
    }

    // Verify coach-client relationship
    const relationship = await CoachClient.findOne({
      coach: coachId,
      client: clientId
    });

    if (!relationship) {
      return res.status(403).json({
        success: false,
        message: 'No relationship with this client'
      });
    }

    const workouts = await Workout.find({ clientId })
      .sort({ scheduledDate: -1, createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      workouts: workouts.map(w => ({
        id: w._id,
        name: w.name,
        scheduledDate: w.scheduledDate,
        completed: w.completed,
        completedDate: w.completedDate,
        exerciseCount: w.exercises.length,
        notes: w.notes
      }))
    });

  } catch (error) {
    console.error('Get client workouts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get client workouts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// ASSIGN PROGRAM TO CLIENT
// ============================================
exports.assignProgram = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { clientId } = req.params;
    const { programId } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can assign programs'
      });
    }

    const relationship = await CoachClient.findOneAndUpdate(
      { coach: coachId, client: clientId, status: 'active' },
      { currentProgram: programId },
      { new: true }
    );

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Active client relationship not found'
      });
    }

    res.json({
      success: true,
      message: 'Program assigned to client',
      programId
    });

  } catch (error) {
    console.error('Assign program error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign program',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET COACH DASHBOARD STATS
// ============================================
exports.getDashboardStats = async (req, res) => {
  try {
    const coachId = req.user.id;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can access dashboard'
      });
    }

    const relationships = await CoachClient.find({ coach: coachId });

    const stats = {
      totalClients: relationships.length,
      activeClients: relationships.filter(r => r.status === 'active').length,
      pendingInvitations: relationships.filter(r => r.status === 'pending').length,
      pausedClients: relationships.filter(r => r.status === 'paused').length,
      clientLimit: req.user.getClientLimit(),
      subscriptionTier: req.user.subscription?.tier || 'free'
    };

    // Calculate average relationship duration
    const activeRelationships = relationships.filter(r => r.status === 'active' && r.startDate);
    if (activeRelationships.length > 0) {
      const totalDays = activeRelationships.reduce((sum, r) => {
        return sum + Math.floor((new Date() - r.startDate) / (1000 * 60 * 60 * 24));
      }, 0);
      stats.avgRelationshipDays = Math.round(totalDays / activeRelationships.length);
    }

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard stats',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPDATE SCHEDULING PREFERENCES
// ============================================
exports.updateScheduling = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      billingCycle,
      sessionPrice,
      sessionDurations,
      minNoticeHours,
      maxAdvanceBookingDays,
      availableDays,
      timeSlots,
      availabilityTags,
      autoAcceptBookings
    } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can update scheduling preferences'
      });
    }

    const updateData = {};
    if (billingCycle) updateData['coachProfile.scheduling.billingCycle'] = billingCycle;
    if (sessionPrice !== undefined) updateData['coachProfile.scheduling.sessionPrice'] = sessionPrice;
    if (sessionDurations) updateData['coachProfile.scheduling.sessionDurations'] = sessionDurations;
    if (minNoticeHours !== undefined) updateData['coachProfile.scheduling.minNoticeHours'] = minNoticeHours;
    if (maxAdvanceBookingDays !== undefined) updateData['coachProfile.scheduling.maxAdvanceBookingDays'] = maxAdvanceBookingDays;
    if (availableDays) updateData['coachProfile.scheduling.availableDays'] = availableDays;
    if (timeSlots) updateData['coachProfile.scheduling.timeSlots'] = timeSlots;
    if (availabilityTags) updateData['coachProfile.scheduling.availabilityTags'] = availabilityTags;
    if (autoAcceptBookings !== undefined) updateData['coachProfile.scheduling.autoAcceptBookings'] = autoAcceptBookings;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('coachProfile.scheduling');

    res.json({
      success: true,
      message: 'Scheduling preferences updated',
      scheduling: user.coachProfile.scheduling
    });

  } catch (error) {
    console.error('Update scheduling error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scheduling preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// UPDATE PAYMENT METHODS
// ============================================
exports.updatePaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id;
    const { venmo, cashapp, paypal, zelle } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can update payment methods'
      });
    }

    const updateData = {};
    if (venmo) {
      updateData['coachProfile.paymentMethods.venmo'] = venmo;
    }
    if (cashapp) {
      updateData['coachProfile.paymentMethods.cashapp'] = cashapp;
    }
    if (paypal) {
      updateData['coachProfile.paymentMethods.paypal'] = paypal;
    }
    if (zelle) {
      updateData['coachProfile.paymentMethods.zelle'] = zelle;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('coachProfile.paymentMethods');

    res.json({
      success: true,
      message: 'Payment methods updated',
      paymentMethods: user.coachProfile.paymentMethods
    });

  } catch (error) {
    console.error('Update payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment methods',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET COACH AVAILABILITY
// ============================================
exports.getAvailability = async (req, res) => {
  try {
    const { coachId } = req.params;

    const coach = await User.findById(coachId).select('name coachProfile');

    if (!coach || coach.userType !== 'coach') {
      return res.status(404).json({
        success: false,
        message: 'Coach not found'
      });
    }

    res.json({
      success: true,
      coach: {
        id: coach._id,
        name: coach.name,
        specialty: coach.coachProfile?.specialty,
        scheduling: coach.coachProfile?.scheduling,
        paymentMethods: coach.coachProfile?.paymentMethods
      }
    });

  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get availability',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// GET COACH SESSIONS
// ============================================
exports.getSessions = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { status, from, to } = req.query;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can access this endpoint'
      });
    }

    const query = { coach: coachId };

    if (status) {
      query.status = status;
    }

    if (from || to) {
      query.scheduledDate = {};
      if (from) query.scheduledDate.$gte = new Date(from);
      if (to) query.scheduledDate.$lte = new Date(to);
    }

    const sessions = await Session.find(query)
      .populate('client', 'name email profile')
      .sort({ scheduledDate: -1 })
      .limit(100);

    // Get upcoming sessions
    const upcomingSessions = await Session.getUpcomingForCoach(coachId, 10);

    res.json({
      success: true,
      sessions,
      upcoming: upcomingSessions,
      counts: {
        total: sessions.length,
        pending: sessions.filter(s => s.status === 'pending').length,
        confirmed: sessions.filter(s => s.status === 'confirmed').length,
        completed: sessions.filter(s => s.status === 'completed').length
      }
    });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get sessions',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = exports;
