// Src/controllers/authController.js - ClockWork B2C/B2B Auth Controller
const User = require('../models/User');
const AICoach = require('../models/AICoach');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ============================================
// REGISTER (Updated for userType)
// ============================================
exports.register = async (req, res) => {
    try {
        const { name, email, password, userType } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            });
        }

        // Determine user type and subscription tier
        const finalUserType = userType || 'individual';
        let subscriptionTier = 'free';

        if (finalUserType === 'coach') {
            subscriptionTier = 'coach_starter'; // Coaches start with starter tier
        }

        // Create user with new B2C/B2B model
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: password,
            userType: finalUserType,
            subscription: {
                tier: subscriptionTier,
                status: 'active'
            }
        });

        await user.save();

        // Create AI Coach profile for individuals and clients
        if (finalUserType === 'individual' || finalUserType === 'client') {
            await AICoach.create({ user: user._id });
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id, userType: user.userType },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ New ${finalUserType} registered: ${email}`);

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                subscription: user.subscription,
                onboarding: user.onboarding
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// LOGIN (Updated for userType)
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        console.log(`🔐 Login attempt for: ${email}`);

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            console.log(`❌ Invalid password for: ${email}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate token with userType
        const token = jwt.sign(
            { id: user._id, userType: user.userType },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ Login successful for ${user.userType}: ${email}`);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                subscription: user.subscription,
                onboarding: user.onboarding,
                coachId: user.coachId
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ============================================
// LOGOUT
// ============================================
exports.logout = async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during logout'
        });
    }
};

// ============================================
// REQUEST PASSWORD RESET
// ============================================
exports.resetPasswordRequest = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        const successMessage = 'If that email exists, a reset code has been sent';

        if (!user) {
            return res.json({
                success: true,
                message: successMessage
            });
        }

        // Generate 3-digit code
        const resetCode = Math.floor(100 + Math.random() * 900).toString();
        const resetToken = crypto.createHash('sha256').update(resetCode).digest('hex');

        user.resetPasswordCode = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // TODO: Send email with resetCode
        console.log(`🔐 Password reset code for ${email}: ${resetCode}`);

        const response = {
            success: true,
            message: successMessage
        };

        if (process.env.NODE_ENV === 'development') {
            response.resetCode = resetCode;
            response._devNote = 'Reset code only shown in development mode';
        }

        res.json(response);

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing reset request'
        });
    }
};

// ============================================
// RESET PASSWORD WITH CODE
// ============================================
exports.resetPassword = async (req, res) => {
    try {
        const { resetToken } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const user = await User.findOne({
            resetPasswordCode: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code'
            });
        }

        user.password = await bcrypt.hash(password, 10);
        user.resetPasswordCode = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        console.log(`✅ Password reset successful for: ${user.email}`);

        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });

    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password reset'
        });
    }
};

// ============================================
// GET CURRENT USER (Updated for userType)
// ============================================
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                subscription: user.subscription,
                coachId: user.coachId,
                onboarding: user.onboarding,
                lastLogin: user.lastLogin,
                wearableConnections: user.wearableConnections
            }
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get user information'
        });
    }
};

// ============================================
// CHANGE PASSWORD
// ============================================
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        console.log(`✅ Password changed for: ${user.email}`);

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password change'
        });
    }
};

// ============================================
// UPGRADE TO COACH (Individual → Coach)
// ============================================
exports.upgradeToCoach = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.userType === 'coach') {
            return res.status(400).json({
                success: false,
                message: 'User is already a coach'
            });
        }

        if (user.userType === 'client') {
            return res.status(400).json({
                success: false,
                message: 'Clients cannot upgrade to coach. Please disconnect from your coach first.'
            });
        }

        // Upgrade to coach
        user.userType = 'coach';
        user.subscription.tier = 'coach_starter';
        await user.save();

        console.log(`✅ User upgraded to coach: ${user.email}`);

        res.json({
            success: true,
            message: 'Successfully upgraded to coach account',
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                subscription: user.subscription
            }
        });

    } catch (error) {
        console.error('Upgrade to coach error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upgrade account'
        });
    }
};

module.exports = exports;
