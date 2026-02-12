// Src/controllers/authController.js - ClockWork B2C/B2B Auth Controller
const User = require('../models/User');
const AICoach = require('../models/AICoach');
const Earnings = require('../models/Earnings');
const InfluencerApplication = require('../models/InfluencerApplication');
const Influencer = require('../models/Influencer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationCode, sendPasswordResetCode, sendWelcomeEmail } = require('../utils/email');
const { checkAndUpgradeVIP, isVIPEmail } = require('../middleware/adminAuth');

// Twilio Verify for email verification (with validation)
const twilio = require('twilio');
let twilioClient = null;
const VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE;

// Only initialize Twilio if credentials are valid
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
if (accountSid && authToken && accountSid.startsWith('AC')) {
    try {
        twilioClient = twilio(accountSid, authToken);
        console.log('✅ Twilio client initialized successfully');
    } catch (err) {
        console.error('⚠️ Twilio initialization failed:', err.message);
    }
} else if (accountSid && !accountSid.startsWith('AC')) {
    console.error('⚠️ TWILIO_ACCOUNT_SID is invalid (must start with AC). Current value starts with:', accountSid.substring(0, 4));
} else {
    console.log('⚠️ Twilio not configured - email verification disabled');
}

// ============================================
// DEBUG: Check Twilio Status
// ============================================
exports.twilioStatus = async (req, res) => {
    res.json({
        twilioConfigured: !!twilioClient,
        verifyServiceConfigured: !!VERIFY_SERVICE_SID,
        accountSidSet: !!accountSid,
        accountSidPrefix: accountSid ? accountSid.substring(0, 4) : null,
        authTokenSet: !!authToken,
        verifyServiceSid: VERIFY_SERVICE_SID ? VERIFY_SERVICE_SID.substring(0, 10) + '...' : null
    });
};

// ============================================
// REGISTER (Updated for userType)
// ============================================
exports.register = async (req, res) => {
    try {
        const { name, email, password, userType, phone } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and password are required'
            });
        }

        // Validate phone format if provided
        if (phone) {
            const phoneClean = phone.replace(/\D/g, '');
            if (phoneClean.length < 10 || phoneClean.length > 15) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid phone number format'
                });
            }
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
        let subscriptionStatus = 'trialing'; // Start everyone on trial

        // Check if user is VIP (auto-upgrade from VIP_EMAILS env var)
        if (isVIPEmail(email)) {
            subscriptionTier = 'vip';
            subscriptionStatus = 'active';
            console.log(`👑 VIP registration detected for: ${email}`);
        } else if (finalUserType === 'coach') {
            subscriptionTier = 'coach_starter'; // Coaches start with starter tier
        }

        // Calculate trial period (24 hours from now)
        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

        // Create user with new B2C/B2B model + 24-hour trial
        const user = new User({
            name,
            email: email.toLowerCase(),
            password: password,
            phone: phone ? phone.replace(/\D/g, '') : undefined,
            userType: finalUserType,
            subscription: {
                tier: subscriptionTier,
                status: subscriptionStatus,
                trialStartDate,
                trialEndDate,
                trialUsed: true
            }
        });

        await user.save();

        // Create AI Coach profile for individuals and clients
        if (finalUserType === 'individual' || finalUserType === 'client') {
            await AICoach.create({ user: user._id });
        }

        // Generate referral code for new user (PATF system)
        try {
            const referralCode = await Earnings.generateReferralCode(name);
            await Earnings.create({
                user: user._id,
                earnerType: finalUserType === 'coach' ? 'coach' : 'referrer',
                referralCode
            });
            console.log(`🎯 Referral code generated: ${referralCode}`);
        } catch (err) {
            console.error('Referral code generation failed:', err.message);
        }

        // Generate token
        const token = jwt.sign(
            { id: user._id, userType: user.userType },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ New ${finalUserType} registered with 24h trial: ${email}`);

        // Send welcome email (async, don't block response)
        sendWelcomeEmail(email.toLowerCase(), name).catch(err => {
            console.error('Welcome email failed:', err.message);
        });

        // Set HTTP-only cookie (cross-origin compatible)
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.status(201).json({
            success: true,
            message: 'Welcome! Your 24-hour Pro trial has started.',
            token, // Include for backward compatibility
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                userType: user.userType,
                subscription: {
                    ...user.subscription.toObject(),
                    isTrialActive: true,
                    trialHoursRemaining: 24
                },
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
// LOGIN (With Email Verification via Twilio)
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

        // Direct login - no email verification required
        return completeLogin(user, res);

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
// VERIFY LOGIN CODE (Twilio Verify)
// ============================================
exports.verifyLogin = async (req, res) => {
    try {
        const { pendingToken, code } = req.body;

        if (!pendingToken || !code) {
            return res.status(400).json({
                success: false,
                message: 'Pending token and verification code are required'
            });
        }

        // Verify the pending token
        let decoded;
        try {
            decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                success: false,
                message: 'Verification expired. Please login again.'
            });
        }

        if (!decoded.pending) {
            return res.status(400).json({
                success: false,
                message: 'Invalid token type'
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify the code with Twilio
        if (!twilioClient || !VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'Verification service not configured'
            });
        }

        try {
            const verification = await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
                .verificationChecks
                .create({ to: user.email, code: code });

            if (verification.status !== 'approved') {
                console.log(`❌ Invalid verification code for: ${user.email}`);
                return res.status(401).json({
                    success: false,
                    message: 'Invalid verification code'
                });
            }
        } catch (twilioError) {
            console.error('Twilio check error:', twilioError.message);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        console.log(`✅ Email verified for: ${user.email}`);

        // Mark email as verified if not already
        if (!user.emailVerified) {
            user.emailVerified = true;
        }

        // Complete the login
        return completeLogin(user, res);

    } catch (error) {
        console.error('Verify login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during verification'
        });
    }
};

// ============================================
// RESEND VERIFICATION CODE
// ============================================
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if user exists
            return res.json({
                success: true,
                message: 'If that email exists, a new code has been sent'
            });
        }

        if (!twilioClient || !VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'Verification service not configured'
            });
        }

        try {
            await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
                .verifications
                .create({ to: email.toLowerCase(), channel: 'email' });

            console.log(`📧 Resent verification code to: ${email}`);

            // Create new pending token
            const pendingToken = jwt.sign(
                { id: user._id, pending: true },
                process.env.JWT_SECRET,
                { expiresIn: '10m' }
            );

            res.json({
                success: true,
                message: 'New verification code sent',
                pendingToken
            });
        } catch (twilioError) {
            console.error('Twilio resend error:', twilioError.message);
            res.status(500).json({
                success: false,
                message: 'Failed to send verification code'
            });
        }

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============================================
// HELPER: Complete Login (shared logic)
// ============================================
async function completeLogin(user, res) {
    // Auto-upgrade VIP users if in VIP_EMAILS env var
    const wasUpgraded = await checkAndUpgradeVIP(user);
    if (wasUpgraded) {
        console.log(`👑 VIP auto-upgrade applied for: ${user.email}`);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate full token with userType
    const token = jwt.sign(
        { id: user._id, userType: user.userType },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    console.log(`✅ Login successful for ${user.userType}: ${user.email}`);

    // Set HTTP-only cookie (cross-origin compatible)
    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({
        success: true,
        message: 'Login successful',
        token, // Include for backward compatibility with admin/other pages
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            userType: user.userType,
            emailVerified: user.emailVerified || false,
            subscription: user.subscription,
            onboarding: user.onboarding,
            coachId: user.coachId
        }
    });
}

// ============================================
// LOGOUT
// ============================================
exports.logout = async (req, res) => {
    try {
        // Clear the auth cookie
        res.cookie('token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            expires: new Date(0)
        });
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
// REQUEST PASSWORD RESET (via Twilio Verify email)
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

        // Generate 6-digit reset code (stored in DB as fallback)
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.resetPasswordCode = resetCode;
        user.resetPasswordExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        // Send password reset code via email
        await sendPasswordResetCode(email.toLowerCase(), resetCode);

        res.json({
            success: true,
            message: successMessage
        });

    } catch (error) {
        console.error('Password reset request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing reset request'
        });
    }
};

// ============================================
// RESET PASSWORD WITH CODE (via Twilio Verify)
// ============================================
exports.resetPassword = async (req, res) => {
    try {
        const { resetToken } = req.params; // This is the 6-digit code
        const { password, email } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Find user by email with valid reset code
        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset request or code expired'
            });
        }

        // Verify the reset code against DB
        if (user.resetPasswordCode !== resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset code'
            });
        }

        // Code verified - reset password
        user.password = password; // Will be hashed by pre-save hook
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
// REQUEST PASSWORD RESET VIA SMS (Twilio Verify)
// ============================================
exports.resetPasswordSmsRequest = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Clean phone number
        const phoneClean = phone.replace(/\D/g, '');

        // Find user by phone
        const user = await User.findOne({ phone: phoneClean });
        const successMessage = 'If that phone number is registered, a reset code has been sent';

        if (!user) {
            return res.json({
                success: true,
                message: successMessage
            });
        }

        if (!twilioClient || !VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'SMS service not configured'
            });
        }

        try {
            // Format phone for Twilio (needs +1 for US)
            const formattedPhone = phoneClean.length === 10 ? `+1${phoneClean}` : `+${phoneClean}`;

            await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
                .verifications
                .create({ to: formattedPhone, channel: 'sms' });

            console.log(`📱 SMS reset code sent to: ${formattedPhone}`);

            res.json({
                success: true,
                message: successMessage,
                phone: phoneClean.slice(-4) // Return last 4 digits for UI
            });
        } catch (twilioError) {
            console.error('Twilio SMS error:', twilioError.message);
            res.status(500).json({
                success: false,
                message: 'Failed to send SMS. Please try email reset instead.'
            });
        }

    } catch (error) {
        console.error('SMS reset request error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing reset request'
        });
    }
};

// ============================================
// VERIFY SMS CODE AND RESET PASSWORD
// ============================================
exports.resetPasswordSmsVerify = async (req, res) => {
    try {
        const { phone, code, newPassword } = req.body;

        if (!phone || !code || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Phone, code, and new password are required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        const phoneClean = phone.replace(/\D/g, '');
        const user = await User.findOne({ phone: phoneClean });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number'
            });
        }

        if (!twilioClient || !VERIFY_SERVICE_SID) {
            return res.status(500).json({
                success: false,
                message: 'SMS service not configured'
            });
        }

        try {
            const formattedPhone = phoneClean.length === 10 ? `+1${phoneClean}` : `+${phoneClean}`;

            const verification = await twilioClient.verify.v2.services(VERIFY_SERVICE_SID)
                .verificationChecks
                .create({ to: formattedPhone, code: code });

            if (verification.status !== 'approved') {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid verification code'
                });
            }
        } catch (twilioError) {
            console.error('Twilio verify error:', twilioError.message);
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        // Code verified - reset password
        user.password = newPassword; // Will be hashed by pre-save hook
        user.phoneVerified = true; // Mark phone as verified since they proved ownership
        await user.save();

        console.log(`✅ Password reset via SMS for: ${user.email}`);

        res.json({
            success: true,
            message: 'Password reset successful. You can now login with your new password.'
        });

    } catch (error) {
        console.error('SMS reset verify error:', error);
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

// ============================================
// VALIDATE CREATOR APPROVAL TOKEN
// ============================================
exports.validateApprovalToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Approval token is required'
            });
        }

        // Find application with valid token
        const application = await InfluencerApplication.findOne({
            approvalToken: token,
            approvalTokenExpires: { $gt: new Date() },
            status: 'approved'
        });

        if (!application) {
            return res.json({
                success: false,
                message: 'Invalid or expired approval link. Please contact support for assistance.'
            });
        }

        // Check if account already exists
        const existingUser = await User.findOne({ email: application.email });
        if (existingUser) {
            return res.json({
                success: false,
                message: 'Account already exists. Please sign in instead.'
            });
        }

        // Token is valid
        res.json({
            success: true,
            email: application.email,
            name: application.name
        });

    } catch (error) {
        console.error('Validate approval token error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error validating token'
        });
    }
};

// ============================================
// CREATOR SIGNUP WITH APPROVAL TOKEN
// ============================================
exports.creatorSignup = async (req, res) => {
    try {
        const { token, password } = req.body;

        // Validate input
        if (!token || !password) {
            return res.status(400).json({
                success: false,
                message: 'Approval token and password are required'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Find application with valid token
        const application = await InfluencerApplication.findOne({
            approvalToken: token,
            approvalTokenExpires: { $gt: new Date() },
            status: 'approved'
        });

        if (!application) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired approval token'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: application.email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Account already exists. Please sign in instead.'
            });
        }

        // Create user account
        const user = new User({
            email: application.email,
            password: password, // Will be hashed by pre-save hook
            name: application.name,
            userType: 'influencer',
            emailVerified: true, // Auto-verify since admin approved
            coachProfile: {
                verified: false,
                bio: '',
                handle: null
            }
        });
        await user.save();

        // Create Influencer record
        const influencer = new Influencer({
            user: user._id,
            application: application._id,
            affiliateCode: application.affiliateCode,
            status: 'active'
        });
        await influencer.save();

        // Clear the approval token (one-time use)
        application.approvalToken = null;
        application.approvalTokenExpires = null;
        await application.save();

        // Generate JWT token
        const authToken = jwt.sign(
            { id: user._id, userType: user.userType },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log(`✅ Creator account created for: ${user.email}`);

        // Set HTTP-only cookie (cross-origin compatible)
        res.cookie('token', authToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({
            success: true,
            message: 'Account created successfully',
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                userType: user.userType
            }
        });

    } catch (error) {
        console.error('Creator signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during account creation'
        });
    }
};

module.exports = exports;
