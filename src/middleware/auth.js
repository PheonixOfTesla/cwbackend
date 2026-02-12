
// Src/middleware/auth.js - ClockWork B2C/B2B Authentication Middleware

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ============================================
// MAIN AUTHENTICATION MIDDLEWARE
// ============================================
const protect = async (req, res, next) => {
    let token;

    // Check Authorization header first, then cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (token) {
        try {

            // SECURITY: No fallback - JWT_SECRET must be set
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                console.error('❌ CRITICAL: JWT_SECRET environment variable is not set');
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

            // Populate the virtual subscriptions array
            req.user = await User.findById(userIdToFind).populate('subscriptions').select('-password');

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            req.user.id = req.user._id.toString();
            req.user.userId = req.user._id.toString();

            next();

        } catch (error) {
            console.error('Auth error:', error.message);

            let errorMessage = 'Token invalid';
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
    } else {
        return res.status(401).json({
            success: false,
            message: 'No token provided'
        });
    }
};

// ============================================
// USER TYPE MIDDLEWARE (NEW B2C/B2B Model)
// ============================================

// Require user to be a coach
const requireCoach = (req, res, next) => {
    if (req.user && req.user.userType === 'coach') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Coach access required'
        });
    }
};

// Require user to be a client
const requireClient = (req, res, next) => {
    if (req.user && req.user.userType === 'client') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Client access required'
        });
    }
};

// Require user to be an individual (AI-only coaching)
const requireIndividual = (req, res, next) => {
    if (req.user && req.user.userType === 'individual') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Individual user access required'
        });
    }
};

// Require user to be either coach or individual (not a client)
const requireCoachOrIndividual = (req, res, next) => {
    if (req.user && (req.user.userType === 'coach' || req.user.userType === 'individual')) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Coach or individual access required'
        });
    }
};

// Require user to have AI coach access (individual or client)
const requireAICoachAccess = (req, res, next) => {
    if (req.user && (req.user.userType === 'individual' || req.user.userType === 'client')) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'AI coach access required (individual or client)'
        });
    }
};

// ============================================
// SUBSCRIPTION MIDDLEWARE
// ============================================

// Require active subscription
const requireActiveSubscription = (req, res, next) => {
    // TODO: Refactor this logic. It needs to know WHICH subscription to check.
    // This probably needs to be a controller-level check, not a generic middleware.
    res.status(501).json({ success: false, message: 'Subscription check not implemented for multi-sub model.' });
};

// Require pro subscription (individuals)
const requireProSubscription = (req, res, next) => {
    const hasPro = req.user?.subscriptions?.some(s => s.tier === 'pro' || s.tier?.startsWith('coach_'));
    if (hasPro) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Pro subscription required'
        });
    }
};

// Require coach subscription
const requireCoachSubscription = (req, res, next) => {
    const hasCoachSub = req.user?.subscriptions?.some(s => s.tier?.startsWith('coach_'));
    if (hasCoachSub) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Coach subscription required'
        });
    }
};

// ============================================
// OPTIONAL AUTH (For routes that work with or without login)
// ============================================
const optionalAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const secret = process.env.JWT_SECRET;

            if (secret) {
                const decoded = jwt.verify(token, secret);
                const userIdToFind = decoded.id || decoded.userId || decoded._id;

                if (userIdToFind) {
                    // Populate the virtual subscriptions array
                    req.user = await User.findById(userIdToFind).populate('subscriptions').select('-password');
                    if (req.user) {
                        req.user.id = req.user._id.toString();
                        req.user.userId = req.user._id.toString();
                    }
                }
            }
        } catch (error) {
            // Silently ignore auth errors for optional auth
            req.user = null;
        }
    }

    next();
};

// ============================================
// LEGACY ADMIN MIDDLEWARE (for backwards compatibility)
// ============================================
const admin = (req, res, next) => {
    const hasAdminTier = req.user?.subscriptions?.some(s => s.tier === 'coach_enterprise');
    const hasAdminRole = req.user?.roles?.includes('admin');

    if (req.user && (hasAdminTier || hasAdminRole)) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
    protect,
    optionalAuth,
    admin,
    // New B2C/B2B middleware
    requireCoach,
    requireClient,
    requireIndividual,
    requireCoachOrIndividual,
    requireAICoachAccess,
    // Subscription middleware
    // TODO: Review and re-enable these with updated logic if needed.
    // requireActiveSubscription,
    // requireProSubscription,
    // requireCoachSubscription
};
