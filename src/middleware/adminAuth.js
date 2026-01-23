// Src/middleware/adminAuth.js - Admin-only authentication middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Get admin emails from environment variable
const getAdminEmails = () => {
  const adminEmails = process.env.ADMIN_EMAILS || '';
  return adminEmails.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
};

// Get VIP emails from environment variable
const getVIPEmails = () => {
  const vipEmails = process.env.VIP_EMAILS || '';
  return vipEmails.split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
};

// Check if email is an admin
const isAdminEmail = (email) => {
  const adminEmails = getAdminEmails();
  return adminEmails.includes(email.toLowerCase());
};

// Check if email is VIP
const isVIPEmail = (email) => {
  const vipEmails = getVIPEmails();
  return vipEmails.includes(email.toLowerCase());
};

// Admin-only middleware (requires authentication first)
const requireAdmin = async (req, res, next) => {
  try {
    // Extract token
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('CRITICAL: JWT_SECRET environment variable is not set');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }

    const decoded = jwt.verify(token, secret);
    const userIdToFind = decoded.id || decoded.userId || decoded._id;

    if (!userIdToFind) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    // Find user
    const user = await User.findById(userIdToFind).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is admin
    if (!isAdminEmail(user.email)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    // Attach user to request
    req.user = user;
    req.user.id = user._id.toString();
    req.user.userId = user._id.toString();

    next();
  } catch (error) {
    console.error('Admin auth error:', error.message);

    let errorMessage = 'Authentication failed';
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expired';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token';
    }

    return res.status(401).json({
      success: false,
      message: errorMessage
    });
  }
};

// Auto-upgrade VIP users on login/registration
const checkAndUpgradeVIP = async (user) => {
  if (isVIPEmail(user.email)) {
    if (user.subscription?.tier !== 'vip') {
      user.subscription = user.subscription || {};
      user.subscription.tier = 'vip';
      user.subscription.status = 'active';
      await user.save();
      console.log(`VIP upgrade applied for: ${user.email}`);
      return true;
    }
  }
  return false;
};

module.exports = {
  requireAdmin,
  isAdminEmail,
  isVIPEmail,
  getAdminEmails,
  getVIPEmails,
  checkAndUpgradeVIP
};
