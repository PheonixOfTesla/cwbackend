// Src/middleware/auth.js

// REQUIRED IMPORTS - All dependencies
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Main authentication middleware function
const protect = async (req, res, next) => {
    console.log('Auth middleware triggered');
    
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token from "Bearer TOKEN" format
            token = req.headers.authorization.split(' ')[1];
            console.log('Token received:', token ? 'Yes' : 'No');
            
            // Get JWT secret from environment or use default
            const secret = process.env.JWT_SECRET || 'your-secret-key';
            console.log('Using JWT secret:', secret ? 'From ENV' : 'Default');
            
            // Verify and decode the token
            const decoded = jwt.verify(token, secret);
            console.log('Token decoded:', decoded);
            
            // Handle multiple possible user ID field names in token
            const userIdToFind = decoded.id || decoded.userId || decoded._id;
            
            if (!userIdToFind) {
                console.error('No user ID in token');
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid token format' 
                });
            }
            
            // Find user in database (exclude password from result)
            req.user = await User.findById(userIdToFind).select('-password');
            
            if (!req.user) {
                console.error('User not found for ID:', userIdToFind);
                return res.status(401).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }
            
            // Ensure consistent user object properties
            req.user.id = req.user._id.toString();
            req.user.userId = req.user._id.toString();
            
            console.log('Auth successful for:', req.user.email);
            next(); // Continue to next middleware/route handler
            
        } catch (error) {
            console.error('Auth error:', error.message);
            
            // Handle specific JWT errors
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
        // No token provided in request
        console.log('No token provided');
        return res.status(401).json({ 
            success: false, 
            message: 'No token provided' 
        });
    }
};

// Optional: Admin-only middleware
const admin = (req, res, next) => {
    if (req.user && req.user.roles && req.user.roles.includes('admin')) {
        next();
    } else {
        res.status(403).json({ 
            success: false, 
            message: 'Admin access required' 
        });
    }
};

// REQUIRED EXPORTS - Must export the middleware functions
module.exports = {
    protect,
    admin
};
