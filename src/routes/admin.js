// Src/routes/admin.js - Admin Dashboard Routes
const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/adminAuth');
const adminController = require('../controllers/adminController');

// All admin routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/users - List all users with search/filter
router.get('/users', adminController.getUsers);

// GET /api/admin/stats - App insights and statistics
router.get('/stats', adminController.getStats);

// GET /api/admin/vip - List all VIP users
router.get('/vip', adminController.getVIPUsers);

// POST /api/admin/vip - Add VIP user
router.post('/vip', adminController.addVIP);

// DELETE /api/admin/vip/:email - Remove VIP user
router.delete('/vip/:email', adminController.removeVIP);

// Documentation
router.get('/docs', (req, res) => {
  res.json({
    message: 'Admin API Documentation',
    security: 'All endpoints require ADMIN_EMAILS authentication',
    endpoints: {
      users: {
        GET: '/api/admin/users',
        description: 'List all users with optional search/filter',
        params: {
          search: 'Search by email or name',
          userType: 'Filter by coach/client/individual',
          tier: 'Filter by subscription tier',
          page: 'Page number (default 1)',
          limit: 'Items per page (default 50)',
          sortBy: 'Sort field (default createdAt)',
          sortOrder: 'asc or desc (default desc)'
        }
      },
      stats: {
        GET: '/api/admin/stats',
        description: 'Get app-wide statistics and insights'
      },
      vip: {
        GET: '/api/admin/vip',
        description: 'List all VIP users',
        POST: '/api/admin/vip',
        body: { email: 'User email to upgrade to VIP' },
        DELETE: '/api/admin/vip/:email',
        deleteDescription: 'Remove VIP status from user'
      }
    }
  });
});

module.exports = router;
