// Src/routes/auth.js - COMPLETE VERSION WITH RATE LIMITING
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const authController = require('../controllers/authController');
const {
    registerLimiter,
    loginLimiter,
    otpLimiter,
    passwordResetLimiter
} = require('../middleware/rateLimiter');

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Register new user (RATE LIMITED: 5/hour)
router.post('/register', registerLimiter, authController.register);

// Login existing user (RATE LIMITED: 10/15min)
router.post('/login', loginLimiter, authController.login);

// Verify login code - 2FA via email (RATE LIMITED: 5/15min)
router.post('/verify-login', otpLimiter, authController.verifyLogin);

// Resend verification code (RATE LIMITED: 5/15min)
router.post('/resend-verification', otpLimiter, authController.resendVerification);

// Request password reset via EMAIL (RATE LIMITED: 3/hour)
router.post('/reset-password', passwordResetLimiter, authController.resetPasswordRequest);

// Request password reset via SMS - Twilio Verify (RATE LIMITED: 3/hour)
router.post('/reset-password-sms', passwordResetLimiter, authController.resetPasswordSmsRequest);

// Verify SMS code and reset password (RATE LIMITED: 5/15min)
router.post('/reset-password-sms/verify', otpLimiter, authController.resetPasswordSmsVerify);

// Debug: Check Twilio status
router.get('/twilio-status', authController.twilioStatus);

// Reset password with code (email flow)
router.put('/reset-password/:resetToken', authController.resetPassword);

// Validate creator approval token
router.post('/validate-approval-token', authController.validateApprovalToken);

// Creator signup with approval token
router.post('/creator/signup', authController.creatorSignup);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Get current user info from token
router.get('/me', protect, authController.getCurrentUser);

// Change password (for logged-in users)
router.put('/change-password', protect, authController.changePassword);

// Logout (client-side token deletion, but endpoint for consistency)
router.post('/logout', protect, authController.logout);

// Upgrade from MEMBER to INDIVIDUAL tier
router.post('/upgrade/individual', protect, authController.upgradeToIndividual);

// ============================================
// DOCUMENTATION ROUTE
// ============================================
router.get('/docs', (req, res) => {
    res.json({
        message: 'Authentication API Documentation',
        endpoints: {
            public: {
                POST_register: {
                    path: '/api/auth/register',
                    body: {
                        name: 'string (required)',
                        email: 'string (required)',
                        password: 'string (required, min 6 chars)',
                        roles: 'array (optional, default: ["client"])',
                        gymId: 'string (optional)'
                    },
                    description: 'Register a new user account'
                },
                POST_login: {
                    path: '/api/auth/login',
                    body: {
                        email: 'string (required)',
                        password: 'string (required)'
                    },
                    description: 'Login and receive JWT token'
                },
                POST_reset_request: {
                    path: '/api/auth/reset-password',
                    body: {
                        email: 'string (required)'
                    },
                    description: 'Request password reset code (sent via email)'
                },
                PUT_reset_password: {
                    path: '/api/auth/reset-password/:resetToken',
                    body: {
                        password: 'string (required, min 6 chars)'
                    },
                    description: 'Reset password using reset code'
                }
            },
            protected: {
                GET_me: {
                    path: '/api/auth/me',
                    headers: {
                        Authorization: 'Bearer {token}'
                    },
                    description: 'Get current user information from token'
                },
                PUT_change_password: {
                    path: '/api/auth/change-password',
                    headers: {
                        Authorization: 'Bearer {token}'
                    },
                    body: {
                        currentPassword: 'string (required)',
                        newPassword: 'string (required, min 6 chars)'
                    },
                    description: 'Change password for logged-in user'
                },
                POST_logout: {
                    path: '/api/auth/logout',
                    headers: {
                        Authorization: 'Bearer {token}'
                    },
                    description: 'Logout (client should delete token)'
                }
            }
        },
        notes: {
            authentication: 'Include JWT token in Authorization header: "Bearer {token}"',
            tokenExpiry: '7 days',
            passwordRequirements: 'Minimum 6 characters'
        }
    });
});

module.exports = router;
