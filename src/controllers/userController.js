const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { password, ...userData } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = await User.create({
      ...userData,
      password: hashedPassword
    });
    
    // FIXED: Consistent response format
    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles
      },
      message: 'User created successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // FIXED: Consistent response format
    res.json({ 
      success: true,
      message: 'User deleted successfully',
      data: user
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

exports.getClientsBySpecialist = async (req, res) => {
  try {
    const clients = await User.find({
      roles: 'client',
      specialistIds: req.params.specialistId
    }).select('-password');
    
    // FIXED: Consistent response format
    res.json({
      success: true,
      data: clients
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// FIXED: Implemented missing function
exports.assignClientToSpecialist = async (req, res) => {
  try {
    const { clientId, specialistId } = req.body;
    
    if (!clientId || !specialistId) {
      return res.status(400).json({ 
        success: false,
        message: 'Both clientId and specialistId are required' 
      });
    }
    
    // Verify both users exist
    const client = await User.findById(clientId);
    const specialist = await User.findById(specialistId);
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    if (!specialist) {
      return res.status(404).json({ 
        success: false,
        message: 'Specialist not found' 
      });
    }
    
    // Verify specialist has specialist role
    if (!specialist.roles.includes('specialist')) {
      return res.status(400).json({ 
        success: false,
        message: 'Target user is not a specialist' 
      });
    }
    
    // Add specialist to client's specialistIds array (using $addToSet to avoid duplicates)
    await User.findByIdAndUpdate(
      clientId, 
      { $addToSet: { specialistIds: specialistId } }
    );
    
    // Add client to specialist's clientIds array
    await User.findByIdAndUpdate(
      specialistId,
      { $addToSet: { clientIds: clientId } }
    );
    
    res.json({ 
      success: true,
      message: 'Client assigned to specialist successfully',
      data: {
        clientId,
        specialistId
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};

// FIXED: Implemented missing function
exports.unassignClientFromSpecialist = async (req, res) => {
  try {
    const { clientId, specialistId } = req.body;
    
    if (!clientId || !specialistId) {
      return res.status(400).json({ 
        success: false,
        message: 'Both clientId and specialistId are required' 
      });
    }
    
    // Verify both users exist
    const client = await User.findById(clientId);
    const specialist = await User.findById(specialistId);
    
    if (!client) {
      return res.status(404).json({ 
        success: false,
        message: 'Client not found' 
      });
    }
    
    if (!specialist) {
      return res.status(404).json({ 
        success: false,
        message: 'Specialist not found' 
      });
    }
    
    // Remove specialist from client's specialistIds array
    await User.findByIdAndUpdate(
      clientId,
      { $pull: { specialistIds: specialistId } }
    );
    
    // Remove client from specialist's clientIds array
    await User.findByIdAndUpdate(
      specialistId,
      { $pull: { clientIds: clientId } }
    );
    
    res.json({ 
      success: true,
      message: 'Client unassigned from specialist successfully',
      data: {
        clientId,
        specialistId
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
};
