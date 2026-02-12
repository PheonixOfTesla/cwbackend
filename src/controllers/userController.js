// Src/controllers/userController.js - COMPLETE & OPTIMIZED VERSION
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// ============================================
// UTILITY FUNCTIONS - DRY PRINCIPLE
// ============================================

/**
 * Normalize email to prevent duplicates
 */
const normalizeEmail = (email) => {
  return email.toLowerCase().trim();
};

/**
 * Validate role array
 */
const validateRoles = (roles) => {
  const validRoles = ['client', 'specialist', 'admin', 'owner', 'engineer'];
  
  // Ensure roles is an array
  if (!Array.isArray(roles)) {
    roles = [roles];
  }
  
  // Filter out invalid roles
  const filteredRoles = roles.filter(role => validRoles.includes(role));
  
  // Default to client if no valid roles
  if (filteredRoles.length === 0) {
    filteredRoles.push('client');
  }
  
  return filteredRoles;
};

/**
 * Clean user object for response (remove sensitive data)
 */
const cleanUserData = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  
  // Remove sensitive fields
  delete userObj.password;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpires;
  delete userObj.__v;
  
  // Ensure consistent ID fields
  userObj.id = userObj._id.toString();
  userObj.userId = userObj._id.toString();
  
  return userObj;
};

/**
 * Standard success response wrapper
 */
const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

/**
 * Standard error response wrapper
 */
const errorResponse = (res, message, statusCode = 500, error = null) => {
  const response = {
    success: false,
    message
  };
  
  // Include error details in development
  if (process.env.NODE_ENV === 'development' && error) {
    response.error = error.message;
    response.stack = error.stack;
  }
  
  return res.status(statusCode).json(response);
};

// ============================================
// CONTROLLER METHODS
// ============================================

/**
 * GET /api/users/profile
 * Get current user's profile
 */
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    return successResponse(res, cleanUserData(user));
    
  } catch (error) {
    console.error('Get profile error:', error);
    return errorResponse(res, 'Failed to fetch profile', 500, error);
  }
};

/**
 * GET /api/users/subscriptions
 * Get all subscriptions for the current user
 */
exports.getSubscriptions = async (req, res) => {
  try {
    // The 'subscriptions' virtual field is populated by the 'protect' middleware
    // We need to re-query to populate the creator details within each subscription
    const user = await User.findById(req.user.id).populate({
      path: 'subscriptions',
      populate: {
        path: 'creatorId',
        select: 'name coachProfile.handle coachProfile.profilePicture' // Select fields you want to show
      }
    });

    if (!user || !user.subscriptions) {
      return successResponse(res, []);
    }

    return successResponse(res, user.subscriptions);

  } catch (error) {
    console.error('Get subscriptions error:', error);
    return errorResponse(res, 'Failed to fetch subscriptions', 500, error);
  }
};

/**
 * PUT /api/users/profile
 * Update current user's profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };

    // Prevent updating sensitive fields through this endpoint
    delete updates.password;
    delete updates.roles;
    delete updates._id;
    delete updates.id;

    // Sanitize ObjectId fields - convert empty strings to null
    const objectIdFields = ['coachId'];
    objectIdFields.forEach(field => {
      if (updates.hasOwnProperty(field) && updates[field] === '') {
        updates[field] = null;
      }
    });

    // Normalize email if being updated
    if (updates.email) {
      updates.email = normalizeEmail(updates.email);

      // Check if email already exists (excluding current user)
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: req.user.id }
      });

      if (existingUser) {
        return errorResponse(res, 'Email already in use', 400);
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, cleanUserData(user), 'Profile updated successfully');

  } catch (error) {
    console.error('Update profile error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, messages.join(', '), 400, error);
    }

    // Handle CastError (ObjectId parsing)
    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid data format provided', 400, error);
    }

    return errorResponse(res, 'Failed to update profile', 500, error);
  }
};

/**
 * GET /api/users
 * Get all users (any authenticated user can view)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const { role, search, isActive, limit = 100, skip = 0 } = req.query;
    
    // Build query
    const query = {};
    
    if (role) {
      query.roles = role;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    // Execute query with pagination
    const users = await User.find(query)
      .select('-password')
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort('-createdAt');
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    // Clean all user data
    const cleanedUsers = users.map(user => cleanUserData(user));
    
    return res.json({
      success: true,
      data: cleanedUsers,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: (parseInt(skip) + cleanedUsers.length) < total
      }
    });
    
  } catch (error) {
    console.error('Get all users error:', error);
    return errorResponse(res, 'Failed to fetch users', 500, error);
  }
};

/**
 * POST /api/users
 * Create new user (admin/owner only)
 * ✅ FIXED: Let User model handle password hashing
 */
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, roles, ...otherFields } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return errorResponse(res, 'Name, email, and password are required', 400);
    }
    
    // Normalize email
    const normalizedEmail = normalizeEmail(email);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return errorResponse(res, 'User with this email already exists', 400);
    }
    
    // Validate password strength
    if (password.length < 6) {
      return errorResponse(res, 'Password must be at least 6 characters long', 400);
    }
    
    // Validate and normalize roles
    const validatedRoles = validateRoles(roles || ['client']);
    
    // ✅ FIXED: DO NOT hash password here - let model do it
    const userData = {
      name: name.trim(),
      email: normalizedEmail,
      password: password, // ✅ Plain password - model will hash it
      roles: validatedRoles,
      isActive: true,
      ...otherFields
    };
    
    // Create user (User model pre-save hook will hash password)
  const user = new User(userData);
  await user.save(); // ✅ This triggers the pre-save hook!
    
    // Log creation
    console.log(`✅ User created: ${user.email} (${user.roles.join(', ')})`);
    
    return successResponse(
      res, 
      cleanUserData(user), 
      'User created successfully', 
      201
    );
    
  } catch (error) {
    console.error('Create user error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return errorResponse(res, 'User with this email already exists', 400, error);
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, messages.join(', '), 400, error);
    }
    
    return errorResponse(res, 'Failed to create user', 500, error);
  }
};

/**
 * PUT /api/users/:id
 * Update user (admin/owner only)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Find user first to check existence
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return errorResponse(res, 'User not found', 404);
    }
    
    // Handle password update separately
    // ✅ FIXED: Don't hash here - let model do it
    if (updates.password) {
      if (updates.password.length < 6) {
        return errorResponse(res, 'Password must be at least 6 characters long', 400);
      }
      // Password will be hashed by User model pre-save hook
    }
    
    // Normalize email if being updated
    if (updates.email) {
      updates.email = normalizeEmail(updates.email);
      
      // Check if email already exists (excluding current user)
      const emailExists = await User.findOne({ 
        email: updates.email,
        _id: { $ne: id }
      });
      
      if (emailExists) {
        return errorResponse(res, 'Email already in use', 400);
      }
    }
    
    // Validate roles if being updated
    if (updates.roles) {
      updates.roles = validateRoles(updates.roles);
    }
    
    // Prevent modifying critical fields
    delete updates._id;
    delete updates.createdAt;
    
    // Update user
    const user = await User.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');
    
    console.log(`✅ User updated: ${user.email}`);
    
    return successResponse(res, cleanUserData(user), 'User updated successfully');
    
  } catch (error) {
    console.error('Update user error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return errorResponse(res, messages.join(', '), 400, error);
    }
    
    // Handle cast errors (invalid ID)
    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid user ID', 400, error);
    }
    
    return errorResponse(res, 'Failed to update user', 500, error);
  }
};

/**
 * DELETE /api/users/:id
 * Delete user (admin/owner only)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Prevent self-deletion
    if (id === req.user.id) {
      return errorResponse(res, 'You cannot delete your own account', 400);
    }
    
    // Find and delete user
    const user = await User.findByIdAndDelete(id);
    
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }
    
    console.log(`🗑️ User deleted: ${user.email}`);
    
    return successResponse(res, cleanUserData(user), 'User deleted successfully');
    
  } catch (error) {
    console.error('Delete user error:', error);
    
    // Handle cast errors (invalid ID)
    if (error.name === 'CastError') {
      return errorResponse(res, 'Invalid user ID', 400, error);
    }
    
    return errorResponse(res, 'Failed to delete user', 500, error);
  }
};

/**
 * GET /api/users/specialist/:specialistId/clients
 * Get all clients assigned to a specialist
 */
exports.getClientsBySpecialist = async (req, res) => {
  try {
    const { specialistId } = req.params;
    
    const clients = await User.find({
      roles: 'client',
      specialistIds: specialistId
    }).select('-password');
    
    const cleanedClients = clients.map(client => cleanUserData(client));
    
    return successResponse(res, cleanedClients);
    
  } catch (error) {
    console.error('Get clients by specialist error:', error);
    return errorResponse(res, 'Failed to fetch clients', 500, error);
  }
};

/**
 * POST /api/users/assign-client
 * Assign client to specialist
 * ✅ ENHANCED: Added client role validation
 */
exports.assignClientToSpecialist = async (req, res) => {
  try {
    const { clientId, specialistId } = req.body;
    
    if (!clientId || !specialistId) {
      return errorResponse(res, 'Both clientId and specialistId are required', 400);
    }
    
    // Verify both users exist
    const [client, specialist] = await Promise.all([
      User.findById(clientId),
      User.findById(specialistId)
    ]);
    
    if (!client) {
      return errorResponse(res, 'Client not found', 404);
    }
    
    if (!specialist) {
      return errorResponse(res, 'Specialist not found', 404);
    }
    
    // ✅ NEW: Verify client has client role
    if (!client.roles.includes('client')) {
      return errorResponse(res, 'Target user is not a client', 400);
    }
    
    // Verify specialist has specialist role
    if (!specialist.roles.includes('specialist')) {
      return errorResponse(res, 'Target user is not a specialist', 400);
    }
    
    // Add relationship (using $addToSet to avoid duplicates)
    await Promise.all([
      User.findByIdAndUpdate(clientId, { 
        $addToSet: { specialistIds: specialistId } 
      }),
      User.findByIdAndUpdate(specialistId, { 
        $addToSet: { clientIds: clientId } 
      })
    ]);
    
    console.log(`✅ Client ${client.email} assigned to specialist ${specialist.email}`);
    
    return successResponse(res, {
      clientId,
      specialistId,
      clientName: client.name,
      specialistName: specialist.name
    }, 'Client assigned to specialist successfully');
    
  } catch (error) {
    console.error('Assign client error:', error);
    return errorResponse(res, 'Failed to assign client', 500, error);
  }
};

/**
 * POST /api/users/unassign-client
 * Unassign client from specialist
 */
exports.unassignClientFromSpecialist = async (req, res) => {
  try {
    const { clientId, specialistId } = req.body;
    
    if (!clientId || !specialistId) {
      return errorResponse(res, 'Both clientId and specialistId are required', 400);
    }
    
    // Verify both users exist
    const [client, specialist] = await Promise.all([
      User.findById(clientId),
      User.findById(specialistId)
    ]);
    
    if (!client) {
      return errorResponse(res, 'Client not found', 404);
    }
    
    if (!specialist) {
      return errorResponse(res, 'Specialist not found', 404);
    }
    
    // Remove relationship
    await Promise.all([
      User.findByIdAndUpdate(clientId, { 
        $pull: { specialistIds: specialistId } 
      }),
      User.findByIdAndUpdate(specialistId, { 
        $pull: { clientIds: clientId } 
      })
    ]);
    
    console.log(`🔓 Client ${client.email} unassigned from specialist ${specialist.email}`);
    
    return successResponse(res, {
      clientId,
      specialistId
    }, 'Client unassigned from specialist successfully');
    
  } catch (error) {
    console.error('Unassign client error:', error);
    return errorResponse(res, 'Failed to unassign client', 500, error);
  }
};

// ============================================
// PERSONAL RECORDS (PRs)
// ============================================

/**
 * Calculate estimated 1RM using Brzycki formula
 */
const calculate1RM = (weight, reps) => {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight / (1.0278 - 0.0278 * reps));
};

/**
 * GET /api/users/prs
 * Get current user's personal records
 */
exports.getPersonalRecords = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('personalRecords');

    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    return successResponse(res, {
      personalRecords: user.personalRecords || []
    });

  } catch (error) {
    console.error('Get PRs error:', error);
    return errorResponse(res, 'Failed to fetch personal records', 500, error);
  }
};

/**
 * POST /api/users/prs
 * Update personal records (add new PRs from workout)
 */
exports.updatePersonalRecords = async (req, res) => {
  try {
    const { newPRs } = req.body;

    if (!newPRs || !Array.isArray(newPRs) || newPRs.length === 0) {
      return errorResponse(res, 'newPRs array is required', 400);
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Initialize personalRecords if empty
    if (!user.personalRecords) {
      user.personalRecords = [];
    }

    const addedPRs = [];

    for (const pr of newPRs) {
      if (!pr.exerciseName || !pr.weight || !pr.reps) continue;

      const oneRepMax = calculate1RM(pr.weight, pr.reps);

      // Find existing PR for this exercise
      const existingIndex = user.personalRecords.findIndex(
        p => p.exerciseName.toLowerCase() === pr.exerciseName.toLowerCase()
      );

      const newPR = {
        exerciseName: pr.exerciseName,
        exerciseId: pr.exerciseId || null,
        weight: pr.weight,
        reps: pr.reps,
        oneRepMax,
        date: new Date(),
        notes: pr.notes || null
      };

      if (existingIndex >= 0) {
        // Update if new 1RM is higher
        const existing = user.personalRecords[existingIndex];
        if (oneRepMax > (existing.oneRepMax || 0)) {
          user.personalRecords[existingIndex] = newPR;
          addedPRs.push(newPR);
        }
      } else {
        // Add new PR
        user.personalRecords.push(newPR);
        addedPRs.push(newPR);
      }
    }

    await user.save();

    console.log(`🏆 ${addedPRs.length} new PRs saved for user ${user.email}`);

    return successResponse(res, {
      addedPRs,
      totalPRs: user.personalRecords.length
    }, `${addedPRs.length} personal record(s) updated`);

  } catch (error) {
    console.error('Update PRs error:', error);
    return errorResponse(res, 'Failed to update personal records', 500, error);
  }
};

module.exports = exports;
