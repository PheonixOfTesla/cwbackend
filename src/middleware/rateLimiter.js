// Src/middleware/rateLimiter.js - ClockWork Rate Limiting Middleware
// Prevents brute force attacks, spam, and AI cost abuse

const rateLimit = require('express-rate-limit');

// ============================================
// RATE LIMITER CONFIGURATIONS
// ============================================

// Trust proxy configuration - Railway/production environments
// express-rate-limit will automatically handle X-Forwarded-For headers
const rateLimitConfig = {
  standardHeaders: 'draft-7', // Use draft-7 standard (RateLimit-* headers)
  legacyHeaders: false,
  // trust proxy is handled by app.set('trust proxy', 1) in server.js
  // Using numeric value (1) instead of true for security
}


/**
 * Auth Registration Rate Limiter
 * Prevents spam account creation
 * Limit: 15 registrations per hour per IP (tripled from 5)
 */
const registerLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    message: {
        success: false,
        message: 'Too many registration attempts. Please try again in an hour.',
        retryAfter: '1 hour'
    },
    skipSuccessfulRequests: false
});

/**
 * Auth Login Rate Limiter
 * Prevents password brute force attacks
 * Limit: 30 login attempts per 15 minutes per IP (tripled from 10)
 */
const loginLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: false
});

/**
 * OTP Verification Rate Limiter
 * Prevents OTP brute force attacks
 * Limit: 15 OTP attempts per 15 minutes per IP (tripled from 5)
 */
const otpLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15,
    message: {
        success: false,
        message: 'Too many OTP verification attempts. Please try again in 15 minutes.',
        retryAfter: '15 minutes'
    },
    skipSuccessfulRequests: false
});

/**
 * Password Reset Rate Limiter
 * Prevents password reset abuse
 * Limit: 9 password resets per hour per IP (tripled from 3)
 */
const passwordResetLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 9,
    message: {
        success: false,
        message: 'Too many password reset attempts. Please try again in an hour.',
        retryAfter: '1 hour'
    },
    skipSuccessfulRequests: false
});

/**
 * AI Coach Generation Rate Limiter
 * Prevents AI cost explosion from program/workout generation
 * Limit: 60 generations per day per IP (tripled from 20)
 */
const aiGenerationLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 60,
    message: {
        success: false,
        message: 'AI generation limit reached. You can generate 60 programs per day.',
        retryAfter: '24 hours'
    },
    skipSuccessfulRequests: false
});

/**
 * AI Coach Query Rate Limiter
 * Prevents AI cost abuse from unlimited queries
 * Limit: 90 AI queries per day per IP (tripled from 30)
 */
const aiQueryLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 90,
    message: {
        success: false,
        message: 'AI query limit reached. You can ask 90 questions per day.',
        retryAfter: '24 hours'
    },
    skipSuccessfulRequests: false
});

/**
 * Coach Invite Rate Limiter
 * Prevents spam invitations
 * Limit: 30 invites per hour per IP (tripled from 10)
 */
const coachInviteLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    message: {
        success: false,
        message: 'Too many invite attempts. Please try again in an hour.',
        retryAfter: '1 hour'
    },
    skipSuccessfulRequests: false
});

/**
 * Global API Rate Limiter (Fallback)
 * General protection for all endpoints
 * Limit: 100 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
    ...rateLimitConfig,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP. Please try again later.',
        retryAfter: '15 minutes'
    },
    skip: (req) => {
        // Skip rate limiting for health check endpoint
        return req.path === '/api/health';
    }
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
    registerLimiter,
    loginLimiter,
    otpLimiter,
    passwordResetLimiter,
    aiGenerationLimiter,
    aiQueryLimiter,
    coachInviteLimiter,
    globalLimiter
};
