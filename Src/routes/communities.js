// Src/routes/communities.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const communityController = require('../controllers/communityController');

// Public routes
router.get('/', communityController.getCommunities);
router.get('/:groupId', communityController.getCommunity);

// Protected routes
router.use(protect);

router.post('/', communityController.createCommunity);
router.get('/user/my-communities', communityController.getMyCommunities);
router.post('/:groupId/join', communityController.joinCommunity);
router.post('/:groupId/leave', communityController.leaveCommunity);
router.get('/:groupId/members', communityController.getMembers);
router.put('/:groupId', communityController.updateCommunity);
router.delete('/:groupId', communityController.deleteCommunity);
router.post('/seed/official', communityController.seedOfficialCommunities);

module.exports = router;
