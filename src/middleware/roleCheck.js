const checkRole = (...roles) => {
    // FIXED: Flatten any nested arrays to handle both formats:
    // checkRole('admin', 'owner') OR checkRole(['admin', 'owner'])
    let requiredRoles = roles.flat();
    
    return (req, res, next) => {
        console.log('CheckRole middleware - Required roles:', requiredRoles);
        console.log('CheckRole middleware - User:', req.user ? req.user.email : 'No user');
        console.log('CheckRole middleware - User roles:', req.user ? req.user.roles : 'No roles');
        
        if (!req.user) {
            console.error('CheckRole: No user object in request');
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized - no user' 
            });
        }
        
        // Ensure user roles is always an array
        const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles].filter(Boolean);
        
        console.log('CheckRole middleware - Normalized user roles:', userRoles);
        console.log('CheckRole middleware - Checking against:', requiredRoles);
        
        // Check if user has at least one of the required roles
        const hasRole = userRoles.some(role => requiredRoles.includes(role));
        
        if (!hasRole) {
            console.error('CheckRole: User does not have required role');
            console.error('User has:', userRoles);
            console.error('Needs one of:', requiredRoles);
            return res.status(403).json({ 
                success: false, 
                message: 'You do not have permission to perform this action',
                required: requiredRoles,
                userRoles: userRoles
            });
        }
        
        console.log('CheckRole: Permission granted');
        next();
    };
};

module.exports = { checkRole };
