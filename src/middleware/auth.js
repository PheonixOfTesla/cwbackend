const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    
    // Allow OPTIONS requests to pass through
    if (req.method === 'OPTIONS') {
        return next();
    }
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract token
            token = req.headers.authorization.split(' ')[1];
            
            console.log('Token received:', token ? 'Yes' : 'No');
            
            // Verify token - use the same secret that authController uses
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this');
            
            console.log('Decoded token:', decoded);
            console.log('Roles from token:', decoded.roles);
            
            // Handle both possible token formats
            // The token might have either 'userId' or 'id' field
            const userIdToFind = decoded.userId || decoded.id;
            
            if (!userIdToFind) {
                console.error('No user ID found in token:', decoded);
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid token format' 
                });
            }
            
            // Find user
            req.user = await User.findById(userIdToFind).select('-password');
            
            // Check if user was found
            if (!req.user) {
                console.error('User not found for ID:', userIdToFind);
                return res.status(401).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }
            
            // IMPORTANT: If roles are in the token but not in the database user,
            // use the roles from the token (they were set during login)
            if (decoded.roles && decoded.roles.length > 0) {
                req.user.roles = decoded.roles;
                console.log('Using roles from token:', decoded.roles);
            } else if (!req.user.roles || req.user.roles.length === 0) {
                // If no roles in token or user, something is wrong
                console.error('No roles found for user');
                req.user.roles = ['client']; // Default fallback
            }
            
            // FIXED: Standardize user ID assignment - ALWAYS set both formats
            req.user.id = req.user._id.toString();
            req.user.userId = req.user._id.toString();
            // Keep _id as well for MongoDB operations
            
            console.log('Auth successful for user:', req.user.email);
            console.log('User roles:', req.user.roles);
            console.log('User ID formats - id:', req.user.id, 'userId:', req.user.userId);
            
            next();
        } catch (error) {
            console.error('Auth middleware error:', error.message);
            
            // Check if it's a JWT specific error
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid token' 
                });
            }
            
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Token expired, please login again' 
                });
            }
            
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized, token failed',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    } else {
        console.log('No token provided in request');
        return res.status(401).json({ 
            success: false, 
            message: 'Not authorized, no token' 
        });
    }
};

module.exports = { protect };
