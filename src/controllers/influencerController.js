const InfluencerApplication = require('../models/InfluencerApplication');

// @desc    Submit an influencer application
// @route   POST /api/influencers/apply
// @access  Public
exports.apply = async (req, res) => {
  try {
    const { name, email, platform, followerCount, engagementRate, videoLinks } = req.body;

    // Basic validation
    if (!name || !email || !platform || !followerCount) {
      return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const newApplication = new InfluencerApplication({
      name,
      email,
      platform,
      followerCount,
      engagementRate,
      videoLinks
    });

    await newApplication.save();

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      data: newApplication
    });
  } catch (error) {
    console.error('Error submitting influencer application:', error);
    res.status(500).json({ message: 'Server error while submitting application.' });
  }
};

// @desc    Get influencer dashboard data
// @route   GET /api/influencers/dashboard
// @access  Private (Influencer)
exports.getDashboard = async (req, res) => {
    try {
        // req.influencer is attached by the requireInfluencer middleware
        const influencer = req.influencer;
        const user = req.user;

        res.json({
            success: true,
            data: {
                user: {
                    name: user.name,
                    email: user.email,
                },
                influencer: {
                    affiliateCode: influencer.affiliateCode,
                    stats: influencer.stats,
                }
            }
        });
    } catch (error) {
        console.error('Error fetching influencer dashboard:', error);
        res.status(500).json({ message: 'Server error while fetching dashboard data.' });
    }
};
