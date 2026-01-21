// Src/controllers/intelligenceController.js
const OpenAI = require('openai');
const WearableData = require('../models/WearableData');
const Workout = require('../models/Workout');
const Measurement = require('../models/Measurement');
const Nutrition = require('../models/Nutrition');
const Goal = require('../models/Goal');
const { getLatestCompleteData } = require('./wearableController');

// Initialize OpenRouter with Kimi K2 - 100% FREE AI provider
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});
const AI_MODEL = 'moonshotai/kimi-k2:free'; // Kimi K2 - FREE on OpenRouter

/**
 * ✅ CLOCKWORK ELITE INTELLIGENCE ENGINE
 * - AI model: Kimi K2 (Moonshot AI via OpenRouter) - 100% FREE
 * - Smart data fetching with fallback from history
 * - Always returns insights
 */
exports.getHealthMetrics = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log('🧠 ClockWork Intelligence: Loading data for', userId);
    
    // ============================================
    // 1. FETCH ALL DATA - SMARTER APPROACH
    // ============================================
    
    // First, get 30-day wearable history (this is reliable)
    const last30DaysWearable = await WearableData.find({
      userId: userId,
      date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    }).sort('-date').lean();
    
    console.log(`📊 Found ${last30DaysWearable.length} days of wearable data`);
    
    // Smart fallback: use most recent complete data from history
    let wearableData = null;
    if (last30DaysWearable.length > 0) {
      // Find most recent day with meaningful data (prefer today, fallback to yesterday)
      wearableData = last30DaysWearable.find(d => 
        d.steps > 100 || d.sleepDuration > 0 || d.recoveryScore > 0
      ) || last30DaysWearable[0]; // Use most recent even if incomplete
      
      console.log(`✅ Using data from ${wearableData.date}: ${wearableData.steps} steps, ${wearableData.sleepDuration}min sleep`);
    } else {
      console.log('⚠️ No wearable data found - trying live fetch');
      // Try live fetch as last resort
      try {
        wearableData = await getLatestCompleteData(userId, 'fitbit');
      } catch (err) {
        console.log('❌ Live fetch failed:', err.message);
      }
    }
    
    // Fetch remaining data
    const [
      last7DaysWorkouts,
      last30DaysWorkouts,
      allMeasurements,
      nutritionPlan,
      activeGoals,
      completedGoals
    ] = await Promise.all([
      Workout.find({ 
        clientId: userId,
        scheduledDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).sort('-scheduledDate').lean(),
      
      Workout.find({ 
        clientId: userId,
        scheduledDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }).sort('-scheduledDate').lean(),
      
      Measurement.find({ clientId: userId }).sort('-date').limit(30).lean(),
      
      Nutrition.findOne({ clientId: userId }).lean(),
      
      Goal.find({ 
        clientId: userId,
        completed: false 
      }).sort('-createdAt').lean(),
      
      Goal.find({ 
        clientId: userId,
        completed: true 
      }).sort('-completedAt').limit(10).lean()
    ]);
    
    console.log('✅ Data loaded:', {
      wearable: !!wearableData,
      wearableHistory: last30DaysWearable.length,
      workouts7d: last7DaysWorkouts.length,
      workouts30d: last30DaysWorkouts.length,
      measurements: allMeasurements.length,
      nutrition: !!nutritionPlan,
      activeGoals: activeGoals.length
    });
    
    // ============================================
    // 2. CALCULATE REAL METRICS (NO GUESSING)
    // ============================================
    
    // RECOVERY ANALYSIS
    const recoveryAnalysis = calculateRecoveryMetrics(wearableData, last30DaysWearable);
    
    // TRAINING LOAD ANALYSIS
    const trainingAnalysis = calculateTrainingMetrics(last7DaysWorkouts, last30DaysWorkouts, wearableData);
    
    // BODY COMPOSITION TRENDS
    const bodyAnalysis = calculateBodyMetrics(allMeasurements);
    
    // NUTRITION ADHERENCE
    const nutritionAnalysis = calculateNutritionMetrics(nutritionPlan);
    
    // GOAL PROGRESS
    const goalAnalysis = calculateGoalMetrics(activeGoals, completedGoals);
    
    // ============================================
    // 3. CLOCKWORK UNIFIED SCORES (0-100)
    // ============================================
    
    const clockworkScores = {
      recovery: {
        score: recoveryAnalysis.score,
        trend: recoveryAnalysis.trend,
        insights: recoveryAnalysis.insights,
        data: recoveryAnalysis.data
      },
      performance: {
        score: trainingAnalysis.score,
        trend: trainingAnalysis.trend,
        insights: trainingAnalysis.insights,
        data: trainingAnalysis.data
      },
      wellness: {
        score: nutritionAnalysis.score + bodyAnalysis.score,
        trend: bodyAnalysis.trend,
        insights: [...nutritionAnalysis.insights, ...bodyAnalysis.insights],
        data: {
          nutrition: nutritionAnalysis.data,
          body: bodyAnalysis.data
        }
      },
      progress: {
        score: goalAnalysis.score,
        trend: goalAnalysis.trend,
        insights: goalAnalysis.insights,
        data: goalAnalysis.data
      }
    };
    
    // ============================================
    // 4. GENERATE ELITE AI COACHING (ALWAYS TRY)
    // ============================================
    
    let aiInsights = null;
    
    // Always attempt AI if we have ANY data
    const hasAnyData = recoveryAnalysis.score > 0 ||
                       trainingAnalysis.score > 0 ||
                       nutritionAnalysis.score > 0 ||
                       goalAnalysis.score > 0;

    if (process.env.OPENROUTER_API_KEY && hasAnyData) {
      try {
        console.log('🤖 Generating Elite AI Coaching with Kimi K2 (FREE)...');

        const prompt = buildEliteCoachingPrompt(
          recoveryAnalysis,
          trainingAnalysis,
          bodyAnalysis,
          nutritionAnalysis,
          goalAnalysis,
          last7DaysWorkouts,
          activeGoals
        );

        console.log('📤 Sending prompt to Kimi K2...');
        const completion = await openai.chat.completions.create({
          model: AI_MODEL,
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        });
        aiInsights = completion.choices[0].message.content;

        console.log('✅ Elite AI Coaching Generated Successfully (FREE)');
        console.log(`📊 AI Response Length: ${aiInsights.length} characters`);
      } catch (aiError) {
        console.error('⚠️ AI Generation Error:', aiError.message);
        console.error('Full AI Error:', aiError);

        // Fallback with detailed error info
        aiInsights = generateEliteFallbackInsights(
          clockworkScores,
          trainingAnalysis,
          recoveryAnalysis,
          `AI temporarily unavailable (${aiError.message})`
        );
      }
    } else {
      if (!process.env.OPENROUTER_API_KEY) {
        console.log('⚠️ OPENROUTER_API_KEY not set - using rule-based insights');
      } else {
        console.log('⚠️ Insufficient data for AI analysis');
      }
      aiInsights = generateEliteFallbackInsights(clockworkScores, trainingAnalysis, recoveryAnalysis);
    }
    
    // ============================================
    // 5. HEALTH METRICS FOR DASHBOARD
    // ============================================
    
    const healthMetrics = wearableData ? {
      heartRate: {
        current: wearableData.restingHeartRate || 0,
        zones: wearableData.heartRateZones || [],
        trend: recoveryAnalysis.hrvTrend
      },
      sleep: {
        score: wearableData.sleepScore || 0,
        duration: wearableData.sleepDuration || 0,
        deep: wearableData.deepSleep || 0,
        rem: wearableData.remSleep || 0,
        light: wearableData.lightSleep || 0,
        awake: wearableData.awakeTime || 0,
        efficiency: wearableData.sleepEfficiency || 0
      },
      recovery: {
        score: wearableData.recoveryScore || 0,
        hrv: wearableData.hrv || 0,
        restingHR: wearableData.restingHeartRate || 0
      },
      activity: {
        steps: wearableData.steps || 0,
        activeMinutes: wearableData.activeMinutes || 0,
        calories: wearableData.caloriesBurned || 0,
        distance: wearableData.distance || 0
      }
    } : null;
    
    // ============================================
    // 6. RETURN COMPLETE INTELLIGENCE PACKAGE
    // ============================================
    
    res.json({
      success: true,
      data: {
        // Core metrics for display
        metrics: {
          steps: wearableData?.steps || 0,
          sleep: wearableData?.sleepDuration || 0,
          recoveryScore: wearableData?.recoveryScore || null,
          hrv: wearableData?.hrv || null,
          restingHR: wearableData?.restingHeartRate || null,
          trainingLoad: wearableData?.trainingLoad || null,
          workoutsThisWeek: trainingAnalysis.data.completedThisWeek,
          workoutCompletionRate: trainingAnalysis.data.completionRate,
          totalWorkouts: trainingAnalysis.data.totalScheduled,
          weight: allMeasurements[0]?.weight || null,
          bodyFat: allMeasurements[0]?.bodyFat || null,
          proteinTarget: nutritionPlan?.protein?.target || 0,
          proteinCurrent: nutritionPlan?.protein?.current || 0,
          caloriesTarget: nutritionPlan?.calories?.target || 0,
          caloriesCurrent: nutritionPlan?.calories?.current || 0,
          activeGoalsCount: activeGoals.length,
          goals: activeGoals.map(g => ({
            name: g.name,
            progress: Math.round((g.current / g.target) * 100),
            current: g.current,
            target: g.target
          }))
        },
        
        // Elite AI insights
        insights: aiInsights,
        
        // Dashboard panels data
        healthMetrics: healthMetrics,
        wearableData: last30DaysWearable,
        
        // ClockWork Unified Scores with deep analytics
        clockworkScores: clockworkScores,
        
        // Data quality indicators
        dataQuality: {
          wearable: !!wearableData,
          wearableHistory: last30DaysWearable.length >= 7,
          workouts: last7DaysWorkouts.length > 0,
          measurements: allMeasurements.length > 0,
          nutrition: !!nutritionPlan,
          goals: activeGoals.length > 0
        },
        
        lastUpdated: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Intelligence Engine Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate intelligence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// CALCULATION FUNCTIONS (REAL MATH, NO GUESSING)
// ============================================

function calculateRecoveryMetrics(current, history) {
  if (!current) {
    return {
      score: 0,
      trend: 'insufficient_data',
      insights: ['Connect a wearable device to track recovery metrics'],
      data: {},
      hrvTrend: 'stable'
    };
  }
  
  const insights = [];
  let score = 0;
  let weights = 0;
  
  // HRV Analysis (40% weight)
  if (current.hrv && current.hrv > 0) {
    const hrvScore = Math.min((current.hrv / 80) * 100, 100);
    score += hrvScore * 0.4;
    weights += 0.4;
    
    if (current.hrv < 40) {
      insights.push(`🔴 HRV critically low (${current.hrv}ms). High stress or overtraining detected. Rest day recommended.`);
    } else if (current.hrv < 50) {
      insights.push(`🟡 HRV below optimal (${current.hrv}ms). Active recovery or light training only.`);
    } else if (current.hrv >= 70) {
      insights.push(`🟢 HRV excellent (${current.hrv}ms). Ready for high-intensity training.`);
    }
  }
  
  // Sleep Analysis (35% weight)
  if (current.sleepDuration && current.sleepDuration > 0) {
    const sleepHours = current.sleepDuration / 60;
    const sleepScore = Math.min((sleepHours / 8) * 100, 100);
    score += sleepScore * 0.35;
    weights += 0.35;
    
    if (sleepHours < 6) {
      insights.push(`🔴 Critically low sleep (${sleepHours.toFixed(1)}h). Need ${(8 - sleepHours).toFixed(1)}h more for recovery.`);
    } else if (sleepHours < 7) {
      insights.push(`🟡 Suboptimal sleep (${sleepHours.toFixed(1)}h). Target 8h for optimal recovery.`);
    } else if (sleepHours >= 8) {
      insights.push(`🟢 Excellent sleep duration (${sleepHours.toFixed(1)}h). Body fully recovered.`);
    }
    
    // Sleep quality check
    if (current.deepSleep && current.sleepDuration > 0) {
      const deepPercent = (current.deepSleep / current.sleepDuration) * 100;
      if (deepPercent < 15) {
        insights.push(`⚠️ Low deep sleep (${deepPercent.toFixed(0)}%). Consider sleep hygiene improvements.`);
      }
    }
  }
  
  // Resting HR Analysis (25% weight)
  if (current.restingHeartRate && current.restingHeartRate > 0) {
    const rhrScore = Math.max(0, 100 - ((current.restingHeartRate - 40) / 40 * 100));
    score += Math.min(rhrScore, 100) * 0.25;
    weights += 0.25;
    
    if (current.restingHeartRate > 75) {
      insights.push(`🔴 Elevated resting HR (${current.restingHeartRate}bpm). Sign of stress or inadequate recovery.`);
    } else if (current.restingHeartRate > 70) {
      insights.push(`🟡 Resting HR slightly elevated (${current.restingHeartRate}bpm). Monitor stress levels.`);
    } else if (current.restingHeartRate <= 55) {
      insights.push(`🟢 Excellent cardiovascular fitness (${current.restingHeartRate}bpm resting HR).`);
    }
  }
  
  const finalScore = weights > 0 ? Math.round(score / weights) : 0;
  
  // Calculate trend from history
  let trend = 'stable';
  if (history.length >= 7) {
    const recentAvg = history.slice(0, 3).reduce((sum, d) => sum + (d.recoveryScore || 0), 0) / 3;
    const olderAvg = history.slice(4, 7).reduce((sum, d) => sum + (d.recoveryScore || 0), 0) / 3;
    if (recentAvg > olderAvg + 5) trend = 'improving';
    if (recentAvg < olderAvg - 5) trend = 'declining';
  }
  
  return {
    score: finalScore,
    trend,
    insights: insights.length > 0 ? insights : ['Recovery metrics within normal range'],
    data: {
      hrv: current.hrv || 0,
      sleepHours: current.sleepDuration ? (current.sleepDuration / 60).toFixed(1) : 0,
      restingHR: current.restingHeartRate || 0,
      sleepQuality: current.sleepScore || 0
    },
    hrvTrend: trend
  };
}

function calculateTrainingMetrics(last7Days, last30Days, wearableData) {
  if (last7Days.length === 0) {
    return {
      score: 0,
      trend: 'no_data',
      insights: ['Start logging workouts to track performance'],
      data: {
        completedThisWeek: 0,
        totalScheduled: 0,
        completionRate: 0
      }
    };
  }
  
  const insights = [];
  let score = 0;
  let weights = 0;
  
  // Workout completion (40% weight)
  const completedLast7 = last7Days.filter(w => w.completed).length;
  const completionRate = Math.round((completedLast7 / last7Days.length) * 100);
  score += completionRate * 0.4;
  weights += 0.4;
  
  if (completionRate < 60) {
    const needed = Math.ceil(last7Days.length * 0.8) - completedLast7;
    insights.push(`🔴 Low consistency (${completionRate}%). Complete ${needed} more workouts this week to hit 80%.`);
  } else if (completionRate < 80) {
    insights.push(`🟡 Good consistency (${completionRate}%). Push for 80%+ to see optimal results.`);
  } else {
    insights.push(`🟢 Excellent consistency (${completionRate}%). Outstanding discipline!`);
  }
  
  // Activity level (30% weight)
  if (wearableData?.steps && wearableData.steps > 0) {
    const stepsScore = Math.min((wearableData.steps / 10000) * 100, 100);
    score += stepsScore * 0.3;
    weights += 0.3;
    
    if (wearableData.steps < 5000) {
      insights.push(`🔴 Very low activity (${wearableData.steps.toLocaleString()} steps). Aim for 10k daily.`);
    } else if (wearableData.steps < 8000) {
      const needed = Math.round((10000 - wearableData.steps) / 1000);
      insights.push(`🟡 Add ${needed}k more steps to hit 10k daily target.`);
    } else if (wearableData.steps >= 10000) {
      insights.push(`🟢 Excellent daily activity (${wearableData.steps.toLocaleString()} steps).`);
    }
  }
  
  // Training load balance (30% weight)
  if (wearableData?.trainingLoad && wearableData.trainingLoad > 0) {
    const loadScore = wearableData.trainingLoad >= 50 && wearableData.trainingLoad <= 85
      ? 100
      : Math.max(0, 100 - Math.abs(70 - wearableData.trainingLoad) * 2);
    score += loadScore * 0.3;
    weights += 0.3;
    
    if (wearableData.trainingLoad > 90) {
      insights.push(`🔴 Training load very high (${wearableData.trainingLoad}/100). Schedule rest day to prevent overtraining.`);
    } else if (wearableData.trainingLoad > 85) {
      insights.push(`🟡 Training load elevated (${wearableData.trainingLoad}/100). Monitor recovery closely.`);
    } else if (wearableData.trainingLoad < 40) {
      insights.push(`🟡 Training load low (${wearableData.trainingLoad}/100). Room to increase intensity.`);
    } else {
      insights.push(`🟢 Training load optimal (${wearableData.trainingLoad}/100). Well-balanced program.`);
    }
  }
  
  const finalScore = weights > 0 ? Math.round(score / weights) : 0;
  
  // Calculate 30-day trend
  let trend = 'stable';
  if (last30Days.length >= 14) {
    const firstHalfCompleted = last30Days.slice(15).filter(w => w.completed).length;
    const secondHalfCompleted = last30Days.slice(0, 15).filter(w => w.completed).length;
    const firstHalfTotal = last30Days.slice(15).length;
    const secondHalfTotal = last30Days.slice(0, 15).length;
    
    const oldRate = (firstHalfCompleted / firstHalfTotal) * 100;
    const newRate = (secondHalfCompleted / secondHalfTotal) * 100;
    
    if (newRate > oldRate + 10) trend = 'improving';
    if (newRate < oldRate - 10) trend = 'declining';
  }
  
  return {
    score: finalScore,
    trend,
    insights,
    data: {
      completedThisWeek: completedLast7,
      totalScheduled: last7Days.length,
      completionRate,
      trainingLoad: wearableData?.trainingLoad || 0
    }
  };
}

function calculateBodyMetrics(measurements) {
  if (measurements.length === 0) {
    return {
      score: 0,
      trend: 'no_data',
      insights: ['Start tracking measurements to monitor body composition'],
      data: {}
    };
  }
  
  const insights = [];
  const latest = measurements[0];
  
  // Calculate trends if we have history
  if (measurements.length >= 2) {
    const previous = measurements[1];
    const weightChange = latest.weight - previous.weight;
    const daysBetween = Math.ceil((new Date(latest.date) - new Date(previous.date)) / (1000 * 60 * 60 * 24));
    
    if (daysBetween > 0) {
      const weeklyRate = (weightChange / daysBetween) * 7;
      
      if (Math.abs(weightChange) >= 0.5) {
        if (weightChange < 0) {
          insights.push(`🟢 Lost ${Math.abs(weightChange).toFixed(1)} lbs (${Math.abs(weeklyRate).toFixed(1)} lbs/week rate). Excellent progress!`);
        } else {
          insights.push(`🟡 Gained ${weightChange.toFixed(1)} lbs (${weeklyRate.toFixed(1)} lbs/week rate). Review nutrition if unintended.`);
        }
      }
    }
    
    // Body fat analysis
    if (latest.bodyFat && previous.bodyFat) {
      const bfChange = latest.bodyFat - previous.bodyFat;
      if (Math.abs(bfChange) >= 0.5) {
        if (bfChange < 0) {
          insights.push(`🟢 Body fat decreased ${Math.abs(bfChange).toFixed(1)}%. Improving body composition.`);
        } else {
          insights.push(`🟡 Body fat increased ${bfChange.toFixed(1)}%. Review training/nutrition plan.`);
        }
      }
    }
  }
  
  // Long-term trend (30 days)
  let trend = 'stable';
  if (measurements.length >= 4) {
    const recent = measurements.slice(0, 2).reduce((sum, m) => sum + m.weight, 0) / 2;
    const older = measurements.slice(2, 4).reduce((sum, m) => sum + m.weight, 0) / 2;
    if (recent < older - 1) trend = 'improving';
    if (recent > older + 1) trend = 'declining';
  }
  
  return {
    score: 50, // Neutral score, body metrics are trend-based
    trend,
    insights: insights.length > 0 ? insights : ['Body composition stable - maintain current approach'],
    data: {
      currentWeight: latest.weight,
      currentBodyFat: latest.bodyFat || null
    }
  };
}

function calculateNutritionMetrics(nutritionPlan) {
  if (!nutritionPlan) {
    return {
      score: 0,
      insights: ['Set up nutrition plan to track adherence'],
      data: {}
    };
  }
  
  const insights = [];
  let score = 0;
  let count = 0;
  
  const macros = [
    { name: 'Protein', data: nutritionPlan.protein, weight: 0.4 },
    { name: 'Carbs', data: nutritionPlan.carbs, weight: 0.3 },
    { name: 'Fat', data: nutritionPlan.fat, weight: 0.3 }
  ];
  
  macros.forEach(macro => {
    if (macro.data && macro.data.target > 0) {
      const adherence = Math.min((macro.data.current / macro.data.target) * 100, 100);
      score += adherence * macro.weight;
      count++;
      
      if (adherence < 70) {
        const needed = Math.round(macro.data.target - macro.data.current);
        insights.push(`🔴 ${macro.name} low (${macro.data.current}/${macro.data.target}g). Need ${needed}g more.`);
      } else if (adherence < 90) {
        insights.push(`🟡 ${macro.name} close (${macro.data.current}/${macro.data.target}g). Almost there!`);
      } else {
        insights.push(`🟢 ${macro.name} on target (${macro.data.current}/${macro.data.target}g). Perfect!`);
      }
    }
  });
  
  const finalScore = count > 0 ? Math.round(score) : 0;
  
  return {
    score: finalScore,
    insights: insights.length > 0 ? insights : ['No nutrition data available'],
    data: {
      proteinAdherence: nutritionPlan.protein?.target > 0 
        ? Math.round((nutritionPlan.protein.current / nutritionPlan.protein.target) * 100)
        : 0
    }
  };
}

function calculateGoalMetrics(activeGoals, completedGoals) {
  if (activeGoals.length === 0 && completedGoals.length === 0) {
    return {
      score: 0,
      trend: 'no_goals',
      insights: ['Set goals to track progress'],
      data: {}
    };
  }
  
  const insights = [];
  let score = 0;
  
  // Active goals progress (70% weight)
  if (activeGoals.length > 0) {
    const progresses = activeGoals.map(g => {
      const progress = Math.min((g.current / g.target) * 100, 100);
      
      // Individual goal feedback
      if (progress >= 80) {
        insights.push(`🟢 "${g.name}" is ${Math.round(progress)}% complete. Push to finish!`);
      } else if (progress >= 50) {
        insights.push(`🟡 "${g.name}" is ${Math.round(progress)}% complete. Keep going!`);
      } else if (progress < 30) {
        insights.push(`🔴 "${g.name}" only ${Math.round(progress)}% complete. Needs focus.`);
      }
      
      return progress;
    });
    
    const avgProgress = progresses.reduce((a, b) => a + b, 0) / progresses.length;
    score += avgProgress * 0.7;
  }
  
  // Recent completion rate (30% weight)
  if (completedGoals.length > 0) {
    const recentlyCompleted = completedGoals.filter(g => {
      const daysSinceCompletion = Math.ceil((new Date() - new Date(g.completedAt)) / (1000 * 60 * 60 * 24));
      return daysSinceCompletion <= 30;
    }).length;
    
    if (recentlyCompleted > 0) {
      score += 30;
      insights.push(`🟢 Completed ${recentlyCompleted} goal(s) in last 30 days. Excellent momentum!`);
    }
  }
  
  const finalScore = Math.round(Math.min(score, 100));
  
  return {
    score: finalScore,
    trend: finalScore >= 70 ? 'on_track' : finalScore >= 40 ? 'steady' : 'needs_focus',
    insights: insights.length > 0 ? insights : ['No active goals to track'],
    data: {
      activeCount: activeGoals.length,
      completedLast30Days: completedGoals.length
    }
  };
}

// ============================================
// ELITE AI COACHING PROMPT
// ============================================

function buildEliteCoachingPrompt(recovery, training, body, nutrition, goals, workouts, activeGoals) {
  return `You are an elite performance coach analyzing data for a serious athlete. Provide insights that are SPECIFIC, ACTIONABLE, and FORWARD-LOOKING.

══════════════════════════════════════════════════════════════
📊 CLOCKWORK INTELLIGENCE REPORT
══════════════════════════════════════════════════════════════

🛌 RECOVERY STATUS (${recovery.score}/100 - ${recovery.trend}):
${recovery.insights.join('\n')}
Data: HRV ${recovery.data.hrv}ms | Sleep ${recovery.data.sleepHours}h | RHR ${recovery.data.restingHR}bpm

💪 PERFORMANCE STATUS (${training.score}/100 - ${training.trend}):
${training.insights.join('\n')}
Data: ${training.data.completedThisWeek}/${training.data.totalScheduled} workouts (${training.data.completionRate}%)

🏋️ RECENT TRAINING:
${workouts.slice(0, 3).map((w, i) => `${i + 1}. ${w.name} - ${w.completed ? '✅' : '⏸️'} ${w.moodFeedback ? `(${w.moodFeedback}/5 mood)` : ''}`).join('\n')}

🥗 NUTRITION STATUS (${nutrition.score}/100):
${nutrition.insights.join('\n')}

📈 BODY COMPOSITION (${body.trend}):
${body.insights.join('\n')}

🎯 GOAL PROGRESS (${goals.score}/100):
${goals.insights.join('\n')}

══════════════════════════════════════════════════════════════
YOUR COACHING RESPONSE:
══════════════════════════════════════════════════════════════

Provide 4 concise paragraphs (150-200 words total):

1. **Recovery Assessment**: Based on HRV/sleep/RHR data, what does their recovery status mean for today's training?

2. **Training Recommendation**: Specific guidance for next 48 hours (intensity, volume, rest needed?)

3. **Nutrition Strategy**: Macro adjustments or timing recommendations based on their adherence

4. **Goal Focus**: Which goal needs attention? Specific action to take this week?

Use EXACT NUMBERS from the data. Be direct and actionable. No fluff.`;
}

// ============================================
// ELITE FALLBACK INSIGHTS (RULE-BASED)
// ============================================

function generateEliteFallbackInsights(scores, training, recovery, errorMsg) {
  const sections = [];
  
  if (errorMsg) {
    sections.push(`**System Note:** ${errorMsg}\n`);
  }
  
  // Recovery section
  sections.push(`**Recovery Analysis (${scores.recovery.score}/100):**`);
  sections.push(scores.recovery.insights.join(' '));
  
  // Performance section
  sections.push(`\n**Performance Analysis (${scores.performance.score}/100):**`);
  sections.push(scores.performance.insights.join(' '));
  
  // Wellness section
  sections.push(`\n**Wellness Analysis (${scores.wellness.score}/100):**`);
  sections.push(scores.wellness.insights.join(' '));
  
  // Progress section
  sections.push(`\n**Progress Analysis (${scores.progress.score}/100):**`);
  sections.push(scores.progress.insights.join(' '));
  
  // Overall recommendation
  const overallScore = Math.round(
    (scores.recovery.score + scores.performance.score + scores.wellness.score + scores.progress.score) / 4
  );
  
  sections.push(`\n**Overall Status:** ${overallScore}/100`);
  
  if (overallScore >= 80) {
    sections.push('Outstanding across all metrics. Maintain current trajectory and consider progressive overload.');
  } else if (overallScore >= 60) {
    sections.push('Solid foundation with room for optimization. Focus on lowest-scoring areas for maximum impact.');
  } else {
    sections.push('Multiple areas need attention. Prioritize recovery and consistency to build momentum.');
  }
  
  return sections.join('\n');
}

module.exports = exports;
