const Influencer = require('../models/Influencer');

const requireInfluencer = async (req, res, next) => {
    try {
        const influencer = await Influencer.findOne({ user: req.user.id });

        if (!influencer) {
            return res.status(403).json({
                success: false,
                message: 'Influencer access required.'
            });
        }

        req.influencer = influencer;
        next();

    } catch (error) {
        console.error('Influencer auth error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error during influencer authorization.'
        });
    }
};

module.exports = { requireInfluencer };
