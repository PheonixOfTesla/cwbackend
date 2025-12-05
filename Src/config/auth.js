// Src/config/auth.js - FIXED VERSION
const jwt = require('jsonwebtoken');

/**
 * Generate JWT token for user authentication
 * @param {string} userId - User's MongoDB _id
 * @param {array} roles - User's roles array
 * @returns {string} JWT token
 */
const generateToken = (userId, roles = []) => {
    return jwt.sign(
        { 
            id: userId,      // ✅ Use 'id' for consistency with middleware
            roles: roles     // ✅ Include roles for authorization checks
        },
        process.env.JWT_SECRET || 'your-secret-key-change-in-production', 
        { 
            expiresIn: process.env.JWT_EXPIRE || '7d'  // ✅ Changed default from 30d to 7d for better security
        }
    );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
};

/**
 * Decode JWT token without verification (use with caution)
 * @param {string} token - JWT token to decode
 * @returns {object} Decoded token payload
 */
const decodeToken = (token) => {
    return jwt.decode(token);
};

/**
 * Check if token is expired
 * @param {string} token - JWT token to check
 * @returns {boolean} True if expired, false otherwise
 */
const isTokenExpired = (token) => {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return true;
        return decoded.exp < Date.now() / 1000;
    } catch (error) {
        return true;
    }
};

module.exports = {
    generateToken,
    verifyToken,
    decodeToken,
    isTokenExpired
};
