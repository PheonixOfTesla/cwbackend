const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');
const testController = require('../controllers/testController');

// Get all tests for a client
router.get('/client/:clientId', protect, testController.getTestsByClient);

// Create test (specialists/admins only)
router.post('/client/:clientId', protect, checkRole(['specialist', 'admin', 'owner']), testController.createTest);

// Update test
router.put('/:id', protect, checkRole(['specialist', 'admin', 'owner']), testController.updateTest);

// Delete test
router.delete('/:id', protect, checkRole(['specialist', 'admin', 'owner']), testController.deleteTest);

module.exports = router;
