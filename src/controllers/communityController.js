// Src/controllers/communityController.js
const Group = require('../models/Group');
const Message = require('../models/Message');

// Get all public communities
exports.getCommunities = async (req, res) => {
  try {
    const { discipline, search, official } = req.query;

    const query = { isPublic: true };

    if (discipline) {
      query.discipline = discipline;
    }

    if (official === 'true') {
      query.isOfficial = true;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const communities = await Group.find(query)
      .populate('createdBy', 'name')
      .sort('-isOfficial -memberCount')
      .limit(50);

    res.json({ success: true, data: communities });
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single community
exports.getCommunity = async (req, res) => {
  try {
    const community = await Group.findById(req.params.groupId)
      .populate('createdBy', 'name')
      .populate('members.userId', 'name');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({ success: true, data: community });
  } catch (error) {
    console.error('Get community error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create community
exports.createCommunity = async (req, res) => {
  try {
    const community = await Group.create({
      ...req.body,
      createdBy: req.user.id,
      members: [{
        userId: req.user.id,
        role: 'owner',
        joinedAt: new Date()
      }],
      memberCount: 1
    });

    res.status(201).json({ success: true, data: community });
  } catch (error) {
    console.error('Create community error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Join community
exports.joinCommunity = async (req, res) => {
  try {
    const community = await Group.findById(req.params.groupId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if already a member
    const isMember = community.members.some(
      m => m.userId.toString() === req.user.id
    );

    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this community'
      });
    }

    // Check max members
    if (community.memberCount >= community.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Community is full'
      });
    }

    community.members.push({
      userId: req.user.id,
      role: 'member',
      joinedAt: new Date()
    });
    community.memberCount = community.members.length;
    await community.save();

    res.json({ success: true, message: 'Joined community', data: community });
  } catch (error) {
    console.error('Join community error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Leave community
exports.leaveCommunity = async (req, res) => {
  try {
    const community = await Group.findById(req.params.groupId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    const memberIndex = community.members.findIndex(
      m => m.userId.toString() === req.user.id
    );

    if (memberIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Not a member of this community'
      });
    }

    // Check if owner
    if (community.members[memberIndex].role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'Owner cannot leave. Transfer ownership first.'
      });
    }

    community.members.splice(memberIndex, 1);
    community.memberCount = community.members.length;
    await community.save();

    res.json({ success: true, message: 'Left community' });
  } catch (error) {
    console.error('Leave community error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get community members
exports.getMembers = async (req, res) => {
  try {
    const community = await Group.findById(req.params.groupId)
      .populate('members.userId', 'name email');

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    res.json({ success: true, data: community.members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's communities
exports.getMyCommunities = async (req, res) => {
  try {
    const communities = await Group.find({
      'members.userId': req.user.id
    }).sort('-lastActivityAt');

    res.json({ success: true, data: communities });
  } catch (error) {
    console.error('Get my communities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update community
exports.updateCommunity = async (req, res) => {
  try {
    const community = await Group.findById(req.params.groupId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is owner or admin
    const member = community.members.find(
      m => m.userId.toString() === req.user.id
    );

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this community'
      });
    }

    const allowedUpdates = ['name', 'description', 'iconUrl', 'bannerUrl', 'color', 'isPublic', 'maxMembers'];
    const updates = {};

    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const updated = await Group.findByIdAndUpdate(
      req.params.groupId,
      updates,
      { new: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update community error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete community
exports.deleteCommunity = async (req, res) => {
  try {
    const community = await Group.findById(req.params.groupId);

    if (!community) {
      return res.status(404).json({
        success: false,
        message: 'Community not found'
      });
    }

    // Check if user is owner
    const member = community.members.find(
      m => m.userId.toString() === req.user.id
    );

    if (!member || member.role !== 'owner') {
      return res.status(403).json({
        success: false,
        message: 'Only the owner can delete this community'
      });
    }

    // Don't allow deleting official communities
    if (community.isOfficial) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete official communities'
      });
    }

    await Group.findByIdAndDelete(req.params.groupId);

    res.json({ success: true, message: 'Community deleted' });
  } catch (error) {
    console.error('Delete community error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Seed official communities
exports.seedOfficialCommunities = async (req, res) => {
  try {
    const existingOfficial = await Group.countDocuments({ isOfficial: true });

    if (existingOfficial > 0) {
      return res.json({
        success: true,
        message: 'Official communities already exist',
        count: existingOfficial
      });
    }

    const communities = Group.OFFICIAL_COMMUNITIES.map(c => ({
      ...c,
      type: 'discipline',
      isPublic: true,
      createdBy: req.user.id,
      members: [],
      memberCount: 0
    }));

    await Group.insertMany(communities);

    res.json({
      success: true,
      message: 'Official communities created',
      count: communities.length
    });
  } catch (error) {
    console.error('Seed communities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
