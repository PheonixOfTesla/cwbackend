// Src/routes/user.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const userController = require('../controllers/userController');

// ============================================
// DOCUMENTATION ROUTE
// ============================================
router.get('/docs', (req, res) => {
    res.json({
        message: 'User API Documentation',
        endpoints: {
            profile: {
                GET: '/api/users/profile',
                PUT: '/api/users/profile',
                description: 'Get or update current user profile',
                authentication: 'required'
            },
            users: {
                GET: '/api/users',
                POST: '/api/users',
                description: 'List all users or create new user',
                authentication: 'required',
                roles: 'POST requires admin/owner'
            },
            userById: {
                GET: '/api/users/:id',
                PUT: '/api/users/:id',
                DELETE: '/api/users/:id',
                description: 'Get, update, or delete specific user',
                authentication: 'required',
                roles: 'PUT/DELETE require admin/owner'
            },
            clientManagement: {
                GET: '/api/users/specialist/:specialistId/clients',
                POST: '/api/users/assign-client',
                POST_UNASSIGN: '/api/users/unassign-client',
                description: 'Manage specialist-client relationships',
                authentication: 'required',
                roles: 'specialist/admin/owner for assignment'
            }
        }
    });
});

// ============================================
// PROFILE ROUTES (Any authenticated user)
// ============================================
router.get('/profile', protect, userController.getProfile);
router.put('/profile', protect, userController.updateProfile);

// ============================================
// USER LISTING & CREATION
// ============================================
router.get('/', protect, userController.getAllUsers);
router.post('/', protect, checkRole('admin', 'owner'), userController.createUser);

// ============================================
// SPECIALIST-CLIENT RELATIONSHIPS (THE 3 MISSING ROUTES)
// ============================================
router.get('/specialist/:specialistId/clients', protect, userController.getClientsBySpecialist);
router.post('/assign-client', protect, checkRole('admin', 'owner', 'specialist'), userController.assignClientToSpecialist);
router.post('/unassign-client', protect, checkRole('admin', 'owner', 'specialist'), userController.unassignClientFromSpecialist);

// ============================================
// PERSONAL RECORDS (PRs)
// ============================================
router.get('/prs', protect, userController.getPersonalRecords);
router.post('/prs', protect, userController.updatePersonalRecords);

// ============================================
// INDIVIDUAL USER MANAGEMENT
// ============================================
router.get('/:id', protect, userController.getProfile);
router.put('/:id', protect, checkRole('admin', 'owner'), userController.updateUser);
router.delete('/:id', protect, checkRole('admin', 'owner'), userController.deleteUser);

// ============================================
// ERROR HANDLING FOR INVALID ROUTES
// ============================================
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'User endpoint not found',
        availableEndpoints: [
            'GET /api/users/docs',
            'GET /api/users/profile',
            'PUT /api/users/profile',
            'GET /api/users',
            'POST /api/users',
            'GET /api/users/specialist/:specialistId/clients',
            'POST /api/users/assign-client',
            'POST /api/users/unassign-client',
            'GET /api/users/:id',
            'PUT /api/users/:id',
            'DELETE /api/users/:id'
        ]
    });
});

module.exports = router;
