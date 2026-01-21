const OpenAI = require('openai');
const CheckIn = require('../models/CheckIn');
const WearableData = require('../models/WearableData');
const Goal = require('../models/Goal');
const Workout = require('../models/Workout');
const CalendarEvent = require('../models/CalendarEvent');

// Initialize OpenRouter with Kimi K2 - 100% FREE
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
const AI_MODEL = 'moonshotai/kimi-k2:free'; // Kimi K2 - FREE

/**
 * Get today's check-in (or pre-filled template)
 * GET /api/check-ins/today
 */
exports.getTodayCheckIn = async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkIn = await CheckIn.findOne({
      userId,
      date: { $gte: today }
    }).populate('goalUpdates.goalId');

    // Auto-fill from wearables if no check-in yet
    if (!checkIn) {
      const wearableData = await getLatestWearableData(userId);
      const activeGoals = await Goal.find({ clientId: userId, completed: false }).lean();

      checkIn = {
        date: today,
        wearableData,
        prefilled: true,
        suggestedGoalUpdates: activeGoals.map(g => ({
          goalId: g._id,
          goalName: g.name,
          currentValue: g.current,
          targetValue: g.target,
          stillOnTrack: null,
          needsAdjustment: false
        }))
      };
    }

    res.json({
      success: true,
      data: checkIn
    });
  } catch (error) {
    console.error('Get today check-in error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Submit or update today's check-in
 * POST /api/check-ins
 */
exports.submitCheckIn = async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prepare check-in data
    const checkInData = {
      ...req.body,
      userId,
      date: today
    };

    // Upsert today's check-in
    let checkIn = await CheckIn.findOneAndUpdate(
      { userId, date: today },
      checkInData,
      { upsert: true, new: true, runValidators: true }
    );

    // Generate AI recommendation based on check-in
    const recommendation = await generateTrainingRecommendation(checkIn, userId);
    if (recommendation) {
      checkIn.aiRecommendation = recommendation;
      await checkIn.save();
    }

    // Update goal progress if provided
    if (req.body.goalUpdates && req.body.goalUpdates.length > 0) {
      for (const update of req.body.goalUpdates) {
        if (update.goalId && update.currentValue !== undefined) {
          await Goal.findByIdAndUpdate(update.goalId, {
            current: update.currentValue
          });
        }
      }
    }

    res.json({
      success: true,
      data: checkIn,
      message: 'Check-in submitted successfully'
    });
  } catch (error) {
    console.error('Submit check-in error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get check-in history
 * GET /api/check-ins/:userId/history?days=30
 */
exports.getHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const days = parseInt(req.query.days) || 30;

    const checkIns = await CheckIn.getHistory(userId, days);

    res.json({
      success: true,
      data: checkIns
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get check-in trends and analytics
 * GET /api/check-ins/trends?days=30
 */
exports.getTrends = async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const days = parseInt(req.query.days) || 30;

    const trends = await CheckIn.getTrends(userId, days);

    // Add additional insights
    const insights = generateTrendInsights(trends);

    res.json({
      success: true,
      data: {
        ...trends,
        insights
      }
    });
  } catch (error) {
    console.error('Get trends error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Auto-fill check-in from wearables
 * POST /api/check-ins/auto-fill
 */
exports.autoFill = async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;

    const wearableData = await getLatestWearableData(userId);

    if (!wearableData) {
      return res.status(404).json({
        success: false,
        message: 'No wearable data available'
      });
    }

    // Map wearable data to check-in fields
    const autoFilledData = {
      sleepHours: wearableData.sleepDuration ? Math.round(wearableData.sleepDuration / 60 * 10) / 10 : null,
      sleepQuality: wearableData.sleepScore ? Math.min(5, Math.max(1, Math.round(wearableData.sleepScore / 20))) : null,
      wearableData: {
        source: wearableData.source || 'unknown',
        hrv: wearableData.hrv,
        restingHR: wearableData.restingHeartRate,
        sleepScore: wearableData.sleepScore,
        recoveryScore: wearableData.recoveryScore,
        steps: wearableData.steps,
        activeMinutes: wearableData.activeMinutes,
        syncedAt: new Date()
      }
    };

    res.json({
      success: true,
      data: autoFilledData,
      message: 'Check-in auto-filled from wearable data'
    });
  } catch (error) {
    console.error('Auto-fill error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get a specific check-in by ID
 * GET /api/check-ins/:checkInId
 */
exports.getCheckInById = async (req, res) => {
  try {
    const { checkInId } = req.params;

    const checkIn = await CheckIn.findById(checkInId)
      .populate('goalUpdates.goalId');

    if (!checkIn) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found'
      });
    }

    res.json({
      success: true,
      data: checkIn
    });
  } catch (error) {
    console.error('Get check-in error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Delete a check-in
 * DELETE /api/check-ins/:checkInId
 */
exports.deleteCheckIn = async (req, res) => {
  try {
    const { checkInId } = req.params;

    const checkIn = await CheckIn.findByIdAndDelete(checkInId);

    if (!checkIn) {
      return res.status(404).json({
        success: false,
        message: 'Check-in not found'
      });
    }

    res.json({
      success: true,
      data: checkIn,
      message: 'Check-in deleted successfully'
    });
  } catch (error) {
    console.error('Delete check-in error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get latest wearable data for user
 */
async function getLatestWearableData(userId) {
  try {
    const wearableData = await WearableData.findOne({ userId })
      .sort('-date')
      .lean();

    return wearableData;
  } catch (error) {
    console.error('Get wearable data error:', error);
    return null;
  }
}

/**
 * Generate AI training recommendation based on check-in
 */
async function generateTrainingRecommendation(checkIn, userId) {
  if (!process.env.OPENROUTER_API_KEY) {
    return generateRuleBasedRecommendation(checkIn);
  }

  try {
    // Fetch today's scheduled workouts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayEvents = await CalendarEvent.find({
      userId,
      date: { $gte: today, $lt: tomorrow },
      type: 'workout'
    }).populate('workoutId');

    const prompt = `Based on this athlete's check-in data, provide a training intensity recommendation.

CHECK-IN DATA:
- Sleep Quality: ${checkIn.sleepQuality}/5
- Sleep Hours: ${checkIn.sleepHours}h
- Energy Level: ${checkIn.energyLevel}/5
- Motivation: ${checkIn.motivation}/5
- Stress Level: ${checkIn.stressLevel}/5 (higher = more stressed)
- Muscle Soreness: ${checkIn.muscleSoreness}/5 (higher = more sore)
- Mood: ${checkIn.mood}
- Readiness Score: ${checkIn.readinessScore}/100
${checkIn.wearableData?.hrv ? `- HRV: ${checkIn.wearableData.hrv}ms` : ''}
${checkIn.wearableData?.restingHR ? `- Resting HR: ${checkIn.wearableData.restingHR}bpm` : ''}
${checkIn.wearableData?.recoveryScore ? `- Recovery Score: ${checkIn.wearableData.recoveryScore}/100` : ''}

SCHEDULED TODAY:
${todayEvents.length > 0 ? todayEvents.map(e => `- ${e.title}`).join('\n') : '- No workouts scheduled'}

Return ONLY valid JSON:
{
  "trainingIntensity": "full-send" | "normal" | "moderate" | "light" | "rest",
  "reason": "Brief 1-2 sentence explanation",
  "nutritionTip": "One specific nutrition tip for today"
}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }]
    });
    const aiText = completion.choices[0].message.content;

    // Parse JSON
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const recommendation = JSON.parse(jsonMatch[0]);
      return recommendation;
    }
  } catch (error) {
    console.error('AI recommendation error:', error);
  }

  return generateRuleBasedRecommendation(checkIn);
}

/**
 * Generate rule-based recommendation when AI is unavailable
 */
function generateRuleBasedRecommendation(checkIn) {
  const score = checkIn.readinessScore || 50;

  let trainingIntensity;
  let reason;

  if (score >= 80) {
    trainingIntensity = 'full-send';
    reason = 'Readiness is optimal. Push hard today.';
  } else if (score >= 60) {
    trainingIntensity = 'normal';
    reason = 'Good readiness. Proceed with planned training.';
  } else if (score >= 40) {
    trainingIntensity = 'moderate';
    reason = 'Below optimal readiness. Consider reducing intensity 15-20%.';
  } else if (score >= 20) {
    trainingIntensity = 'light';
    reason = 'Low readiness detected. Light movement or mobility work recommended.';
  } else {
    trainingIntensity = 'rest';
    reason = 'Very low readiness. Full rest day recommended for recovery.';
  }

  // Adjust for specific factors
  if (checkIn.mood === 'sick') {
    trainingIntensity = 'rest';
    reason = 'Feeling sick. Rest and recovery is priority.';
  } else if (checkIn.muscleSoreness >= 4) {
    if (trainingIntensity !== 'rest') {
      trainingIntensity = trainingIntensity === 'full-send' ? 'normal' : 'light';
      reason += ' High soreness - focus on non-affected muscle groups.';
    }
  }

  return {
    trainingIntensity,
    reason,
    nutritionTip: score < 60
      ? 'Focus on anti-inflammatory foods and adequate protein for recovery.'
      : 'Fuel appropriately for your training intensity. Stay hydrated.'
  };
}

/**
 * Generate insights from trends data
 */
function generateTrendInsights(trends) {
  const insights = [];

  // Check-in streak insight
  if (trends.checkInStreak >= 7) {
    insights.push({
      type: 'success',
      message: `Amazing! ${trends.checkInStreak}-day check-in streak. Consistency is key.`
    });
  } else if (trends.checkInStreak >= 3) {
    insights.push({
      type: 'info',
      message: `${trends.checkInStreak}-day streak. Keep it going!`
    });
  } else if (trends.totalCheckIns > 0) {
    insights.push({
      type: 'warning',
      message: 'Check in daily to build momentum and get better insights.'
    });
  }

  // Readiness trend insight
  if (trends.avgReadiness) {
    if (trends.avgReadiness >= 70) {
      insights.push({
        type: 'success',
        message: `Average readiness ${trends.avgReadiness}/100. You're recovering well.`
      });
    } else if (trends.avgReadiness >= 50) {
      insights.push({
        type: 'info',
        message: `Average readiness ${trends.avgReadiness}/100. Room for optimization.`
      });
    } else {
      insights.push({
        type: 'warning',
        message: `Average readiness ${trends.avgReadiness}/100. Consider more recovery focus.`
      });
    }
  }

  // Sleep trend insight
  if (trends.avgSleep) {
    if (trends.avgSleep >= 7.5) {
      insights.push({
        type: 'success',
        message: `Averaging ${trends.avgSleep.toFixed(1)}h sleep. Excellent recovery foundation.`
      });
    } else if (trends.avgSleep >= 6.5) {
      insights.push({
        type: 'info',
        message: `Averaging ${trends.avgSleep.toFixed(1)}h sleep. Try to add 30 more minutes.`
      });
    } else {
      insights.push({
        type: 'warning',
        message: `Only ${trends.avgSleep.toFixed(1)}h average sleep. This limits recovery.`
      });
    }
  }

  return insights;
}

module.exports = exports;
