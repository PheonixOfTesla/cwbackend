// Src/controllers/authController.js - FIXED VERSION
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ============================================
// REGISTER
// ============================================
exports.register = async (req, res) => {
    try {
        const { name, email, password, roles, gymId } = req.body;
        
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
        
        
        const user = new User({
    name,
    email: email.toLowerCase(),
    password: password,  // Plain password - let the model hash it
    roles: roles || ['client'],
    gymId: gymId || null
});

await user.save();  // The pre-save hook will hash the password
        
        // ✅ FIXED: Use 'id' instead of 'userId' for consistency with middleware
        const token = jwt.sign(
            { id: user._id, roles: user.roles },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                gymId: user.gymId
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
// LOGIN
// ============================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }
        
        console.log(`🔐 Login attempt for: ${email}`);
        
        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log(`❌ User not found: ${email}`);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }
        
        console.log(`✅ User found: ${user.email}, checking password...`);
        
        // Check password
        const isValidPassword = await user.comparePassword(password);
if (!isValidPassword) {
    console.log(`❌ Invalid password for: ${email}`);
    return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
    });
}
        
        console.log(`✅ Password valid for: ${email}`);
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // ✅ FIXED: Use 'id' instead of 'userId' for consistency with middleware
        const token = jwt.sign(
            { id: user._id, roles: user.roles },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        console.log(`✅ Token generated for: ${email}`);
        
        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                roles: user.roles,
                gymId: user.gymId
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
        // In a JWT system, logout is handled client-side by deleting the token
        // Optional: You can implement token blacklisting here if needed
        
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
        
        // Always return same message to prevent email enumeration
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
        // For now, log it (in production, send via email service like SendGrid)
        console.log(`🔐 Password reset code for ${email}: ${resetCode}`);
        console.log(`⏰ Expires at: ${new Date(user.resetPasswordExpires)}`);
        
        // ✅ SECURITY FIX: Never expose reset code in production
        const response = {
            success: true,
            message: successMessage
        };
        
        // Only include reset code in development mode
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
        
        // Hash the provided token to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        // Find user with valid reset token
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
        
        // Hash new password
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
// GET CURRENT USER (Optional - useful for token refresh)
// ============================================
exports.getCurrentUser = async (req, res) => {
    try {
        // req.user is set by protect middleware
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
                roles: user.roles,
                gymId: user.gymId,
                lastLogin: user.lastLogin
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
// CHANGE PASSWORD (for logged-in users)
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
        
        // Get user with password field
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false,
                message: 'Current password is incorrect' 
            });
        }
        
        // Hash and save new password
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

module.exports = exports;
