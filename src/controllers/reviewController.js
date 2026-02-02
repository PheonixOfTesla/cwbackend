// Src/controllers/reviewController.js - Coach Reviews (Amazon-style)
const Review = require('../models/Review');
const CoachSubscription = require('../models/CoachSubscription');
const User = require('../models/User');

// ============================================
// CREATE REVIEW (Coaching clients only)
// ============================================
exports.createReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;
    const { rating, title, text, coachingDuration, trainingGoal } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    if (!text || text.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Review must be at least 10 characters' });
    }

    // Check if user can review
    const canReviewResult = await Review.canUserReview(userId, coachId);
    if (!canReviewResult.canReview) {
      return res.status(403).json({ success: false, message: canReviewResult.reason });
    }

    // Create review
    const review = await Review.create({
      userId,
      coachId,
      rating,
      title: title?.trim() || '',
      text: text.trim(),
      coachingDuration: coachingDuration || 'less-than-month',
      trainingGoal: trainingGoal || 'general-fitness',
      verified: true // They have active coaching subscription
    });

    await review.populate('userId', 'name');

    // Update coach's average rating
    const ratingSummary = await Review.getCoachRatingSummary(coachId);
    await User.findByIdAndUpdate(coachId, {
      'coachProfile.rating': ratingSummary.averageRating,
      'coachProfile.reviewCount': ratingSummary.totalReviews
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review
    });

  } catch (error) {
    console.error('Create review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this coach' });
    }
    res.status(500).json({ success: false, message: 'Failed to create review' });
  }
};

// ============================================
// GET COACH REVIEWS (Public)
// ============================================
exports.getCoachReviews = async (req, res) => {
  try {
    const { coachId } = req.params;
    const { page = 1, limit = 10, sort = 'helpful' } = req.query;

    // Get reviews
    const reviews = await Review.getCoachReviews(coachId, parseInt(page), parseInt(limit));

    // Get rating summary
    const summary = await Review.getCoachRatingSummary(coachId);

    // Get total for pagination
    const total = await Review.countDocuments({ coachId, status: 'approved', isActive: true });

    res.json({
      success: true,
      reviews,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get coach reviews error:', error);
    res.status(500).json({ success: false, message: 'Failed to get reviews' });
  }
};

// ============================================
// GET MY REVIEW FOR A COACH
// ============================================
exports.getMyReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;

    const review = await Review.findOne({ userId, coachId });
    const canReviewResult = await Review.canUserReview(userId, coachId);

    res.json({
      success: true,
      review: review || null,
      canReview: canReviewResult.canReview,
      reason: canReviewResult.reason
    });

  } catch (error) {
    console.error('Get my review error:', error);
    res.status(500).json({ success: false, message: 'Failed to get review' });
  }
};

// ============================================
// UPDATE MY REVIEW
// ============================================
exports.updateReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;
    const { rating, title, text, coachingDuration, trainingGoal } = req.body;

    const review = await Review.findOne({ userId, coachId });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (rating) review.rating = rating;
    if (title !== undefined) review.title = title.trim();
    if (text) review.text = text.trim();
    if (coachingDuration) review.coachingDuration = coachingDuration;
    if (trainingGoal) review.trainingGoal = trainingGoal;

    await review.save();

    // Update coach's average rating
    const ratingSummary = await Review.getCoachRatingSummary(coachId);
    await User.findByIdAndUpdate(coachId, {
      'coachProfile.rating': ratingSummary.averageRating,
      'coachProfile.reviewCount': ratingSummary.totalReviews
    });

    res.json({
      success: true,
      message: 'Review updated',
      review
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ success: false, message: 'Failed to update review' });
  }
};

// ============================================
// DELETE MY REVIEW
// ============================================
exports.deleteReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { coachId } = req.params;

    const review = await Review.findOneAndUpdate(
      { userId, coachId },
      { isActive: false },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Update coach's average rating
    const ratingSummary = await Review.getCoachRatingSummary(coachId);
    await User.findByIdAndUpdate(coachId, {
      'coachProfile.rating': ratingSummary.averageRating,
      'coachProfile.reviewCount': ratingSummary.totalReviews
    });

    res.json({ success: true, message: 'Review deleted' });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
};

// ============================================
// MARK REVIEW AS HELPFUL
// ============================================
exports.markHelpful = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Check if already voted
    const alreadyVoted = review.helpfulVotes.some(v => v.userId.toString() === userId);

    if (alreadyVoted) {
      // Remove vote
      review.helpfulVotes = review.helpfulVotes.filter(v => v.userId.toString() !== userId);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add vote
      review.helpfulVotes.push({ userId });
      review.helpfulCount += 1;
    }

    await review.save();

    res.json({
      success: true,
      helpful: !alreadyVoted,
      helpfulCount: review.helpfulCount
    });

  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark helpful' });
  }
};

// ============================================
// COACH RESPOND TO REVIEW
// ============================================
exports.respondToReview = async (req, res) => {
  try {
    const coachId = req.user.id;
    const { reviewId } = req.params;
    const { text } = req.body;

    if (req.user.userType !== 'coach') {
      return res.status(403).json({ success: false, message: 'Only coaches can respond to reviews' });
    }

    const review = await Review.findOne({ _id: reviewId, coachId });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    review.coachResponse = {
      text: text.trim(),
      createdAt: new Date()
    };

    await review.save();

    res.json({
      success: true,
      message: 'Response added',
      coachResponse: review.coachResponse
    });

  } catch (error) {
    console.error('Respond to review error:', error);
    res.status(500).json({ success: false, message: 'Failed to respond' });
  }
};

module.exports = exports;
