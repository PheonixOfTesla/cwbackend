// Src/controllers/coachController.js - Coach Management Controller
const User = require('../models/User');
const CoachClient = require('../models/CoachClient');
const crypto = require('crypto');

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
      .sort({ startDate: -1 });

    const clients = relationships.map(rel => ({
      id: rel.client._id,
      name: rel.client.name,
      email: rel.client.email,
      profile: rel.client.profile,
      experience: rel.client.experience,
      onboardingCompleted: rel.client.onboarding?.completed || false,
      relationshipStatus: rel.status,
      startDate: rel.startDate,
      lastLogin: rel.client.lastLogin,
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
// REMOVE CLIENT
// ============================================
exports.removeClient = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { clientId } = req.params;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({
        success: false,
        message: 'Only coaches can remove clients'
      });
    }

    const relationship = await CoachClient.findOne({
      coach: coachId,
      client: clientId
    });

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Client relationship not found'
      });
    }

    // End the relationship
    await relationship.end();

    // Update client's userType back to individual
    await User.findByIdAndUpdate(clientId, {
      userType: 'individual',
      coachId: null
    });

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

module.exports = exports;
