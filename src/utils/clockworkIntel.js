/**
 * ClockWork Intel - Unified Intelligence Engine
 *
 * Processes ALL wearable data into actionable metrics:
 * - Recovery Score (0-100)
 * - Performance Readiness (0-100)
 * - Wellness Score (0-100)
 * - Training Load (0-21 strain scale)
 * - Adaptive Recommendations
 */

// ============================================
// RECOVERY SCORE CALCULATION
// ============================================
// Factors: HRV, RHR, Sleep Quality, Sleep Duration, Breathing Rate

const calculateRecoveryScore = (data) => {
    const weights = {
        hrv: 0.30,           // HRV is the gold standard
        rhr: 0.20,           // Resting heart rate
        sleepDuration: 0.20, // Total sleep time
        sleepQuality: 0.15,  // Deep + REM percentage
        breathingRate: 0.10, // Respiratory health
        spo2: 0.05           // Blood oxygen
    };

    let score = 0;
    let totalWeight = 0;
    const factors = {};

    // HRV Score (higher is better, baseline around 40-60ms for most adults)
    if (data.hrv && data.hrv > 0) {
        // Elite athletes: 60-100+ms, Average: 30-50ms, Poor: <30ms
        let hrvScore;
        if (data.hrvBaseline) {
            // Compare to personal baseline
            const deviation = ((data.hrv - data.hrvBaseline) / data.hrvBaseline) * 100;
            hrvScore = Math.min(100, Math.max(0, 50 + deviation));
        } else {
            // General population scoring
            if (data.hrv >= 80) hrvScore = 100;
            else if (data.hrv >= 60) hrvScore = 80 + ((data.hrv - 60) / 20) * 20;
            else if (data.hrv >= 40) hrvScore = 60 + ((data.hrv - 40) / 20) * 20;
            else if (data.hrv >= 25) hrvScore = 40 + ((data.hrv - 25) / 15) * 20;
            else hrvScore = Math.max(0, (data.hrv / 25) * 40);
        }
        score += hrvScore * weights.hrv;
        totalWeight += weights.hrv;
        factors.hrv = { value: data.hrv, score: hrvScore, weight: weights.hrv };
    }

    // Resting Heart Rate (lower is better for athletes)
    if (data.restingHeartRate && data.restingHeartRate > 0) {
        // Elite: 40-50, Good: 50-60, Average: 60-70, Poor: 70+
        let rhrScore;
        if (data.restingHeartRate <= 45) rhrScore = 100;
        else if (data.restingHeartRate <= 55) rhrScore = 90 - ((data.restingHeartRate - 45) / 10) * 10;
        else if (data.restingHeartRate <= 65) rhrScore = 80 - ((data.restingHeartRate - 55) / 10) * 20;
        else if (data.restingHeartRate <= 75) rhrScore = 60 - ((data.restingHeartRate - 65) / 10) * 20;
        else rhrScore = Math.max(0, 40 - ((data.restingHeartRate - 75) / 10) * 20);

        score += rhrScore * weights.rhr;
        totalWeight += weights.rhr;
        factors.rhr = { value: data.restingHeartRate, score: rhrScore, weight: weights.rhr };
    }

    // Sleep Duration (optimal: 7-9 hours)
    if (data.sleepDuration && data.sleepDuration > 0) {
        const sleepHours = data.sleepDuration / 60;
        let sleepDurationScore;
        if (sleepHours >= 7 && sleepHours <= 9) sleepDurationScore = 100;
        else if (sleepHours >= 6 && sleepHours < 7) sleepDurationScore = 80;
        else if (sleepHours >= 9 && sleepHours <= 10) sleepDurationScore = 90;
        else if (sleepHours >= 5 && sleepHours < 6) sleepDurationScore = 60;
        else if (sleepHours > 10) sleepDurationScore = 70;
        else sleepDurationScore = Math.max(0, (sleepHours / 5) * 60);

        score += sleepDurationScore * weights.sleepDuration;
        totalWeight += weights.sleepDuration;
        factors.sleepDuration = { value: sleepHours.toFixed(1), score: sleepDurationScore, weight: weights.sleepDuration };
    }

    // Sleep Quality (Deep + REM should be ~40-50% of total)
    if (data.deepSleep && data.remSleep && data.sleepDuration) {
        const qualitySleep = data.deepSleep + data.remSleep;
        const qualityPercent = (qualitySleep / data.sleepDuration) * 100;
        let sleepQualityScore;
        if (qualityPercent >= 45) sleepQualityScore = 100;
        else if (qualityPercent >= 35) sleepQualityScore = 80 + ((qualityPercent - 35) / 10) * 20;
        else if (qualityPercent >= 25) sleepQualityScore = 60 + ((qualityPercent - 25) / 10) * 20;
        else sleepQualityScore = Math.max(0, (qualityPercent / 25) * 60);

        score += sleepQualityScore * weights.sleepQuality;
        totalWeight += weights.sleepQuality;
        factors.sleepQuality = { value: qualityPercent.toFixed(1), score: sleepQualityScore, weight: weights.sleepQuality };
    }

    // Breathing Rate (optimal: 12-20 breaths/min during sleep)
    if (data.breathingRate && data.breathingRate > 0) {
        let breathingScore;
        if (data.breathingRate >= 12 && data.breathingRate <= 16) breathingScore = 100;
        else if (data.breathingRate >= 10 && data.breathingRate <= 20) breathingScore = 80;
        else if (data.breathingRate >= 8 && data.breathingRate <= 22) breathingScore = 60;
        else breathingScore = 40;

        score += breathingScore * weights.breathingRate;
        totalWeight += weights.breathingRate;
        factors.breathingRate = { value: data.breathingRate, score: breathingScore, weight: weights.breathingRate };
    }

    // SpO2 (optimal: 95-100%)
    if (data.spo2Avg && data.spo2Avg > 0) {
        let spo2Score;
        if (data.spo2Avg >= 96) spo2Score = 100;
        else if (data.spo2Avg >= 94) spo2Score = 80;
        else if (data.spo2Avg >= 92) spo2Score = 60;
        else if (data.spo2Avg >= 90) spo2Score = 40;
        else spo2Score = 20; // Medical concern below 90%

        score += spo2Score * weights.spo2;
        totalWeight += weights.spo2;
        factors.spo2 = { value: data.spo2Avg, score: spo2Score, weight: weights.spo2 };
    }

    const finalScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;

    return {
        score: finalScore,
        grade: getGrade(finalScore),
        factors,
        status: getRecoveryStatus(finalScore),
        recommendation: getRecoveryRecommendation(finalScore, factors)
    };
};

// ============================================
// PERFORMANCE READINESS CALCULATION
// ============================================
// How ready is the body for high-intensity training today?

const calculatePerformanceReadiness = (data, recovery) => {
    const weights = {
        recovery: 0.40,        // Yesterday's recovery
        recentTraining: 0.25,  // Recent training load
        sleepDebt: 0.20,       // Accumulated sleep debt
        muscleReadiness: 0.15  // Time since last heavy session
    };

    let score = 0;
    let totalWeight = 0;
    const factors = {};

    // Recovery contribution
    if (recovery && recovery.score) {
        score += recovery.score * weights.recovery;
        totalWeight += weights.recovery;
        factors.recovery = { value: recovery.score, weight: weights.recovery };
    }

    // Recent training (Active Zone Minutes indicate training stress)
    if (data.activeZoneMinutes) {
        const azm = typeof data.activeZoneMinutes === 'object'
            ? data.activeZoneMinutes.total
            : data.activeZoneMinutes;

        // Moderate AZM (22-44) is optimal, too high means fatigue
        let trainingScore;
        if (azm >= 22 && azm <= 44) trainingScore = 100;
        else if (azm < 22) trainingScore = 80; // Under-trained
        else if (azm <= 66) trainingScore = 70; // High but manageable
        else if (azm <= 88) trainingScore = 50; // High fatigue likely
        else trainingScore = 30; // Very high, needs recovery

        score += trainingScore * weights.recentTraining;
        totalWeight += weights.recentTraining;
        factors.recentTraining = { value: azm, score: trainingScore, weight: weights.recentTraining };
    }

    // Sleep debt (comparing to 8-hour baseline)
    if (data.sleepDuration) {
        const sleepHours = data.sleepDuration / 60;
        const debt = 8 - sleepHours;
        let debtScore;
        if (debt <= 0) debtScore = 100;
        else if (debt <= 1) debtScore = 85;
        else if (debt <= 2) debtScore = 65;
        else if (debt <= 3) debtScore = 45;
        else debtScore = 25;

        score += debtScore * weights.sleepDebt;
        totalWeight += weights.sleepDebt;
        factors.sleepDebt = { value: debt.toFixed(1), score: debtScore, weight: weights.sleepDebt };
    }

    // Muscle readiness (based on calories burned as proxy for activity)
    if (data.caloriesBurned) {
        // High calorie burn yesterday = muscles need recovery
        let muscleScore;
        if (data.caloriesBurned < 2000) muscleScore = 100;
        else if (data.caloriesBurned < 2500) muscleScore = 85;
        else if (data.caloriesBurned < 3000) muscleScore = 70;
        else if (data.caloriesBurned < 3500) muscleScore = 55;
        else muscleScore = 40;

        score += muscleScore * weights.muscleReadiness;
        totalWeight += weights.muscleReadiness;
        factors.muscleReadiness = { value: data.caloriesBurned, score: muscleScore, weight: weights.muscleReadiness };
    }

    const finalScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;

    return {
        score: finalScore,
        grade: getGrade(finalScore),
        factors,
        trainingZone: getTrainingZone(finalScore),
        recommendation: getPerformanceRecommendation(finalScore)
    };
};

// ============================================
// WELLNESS SCORE CALCULATION
// ============================================
// Overall health and lifestyle balance

const calculateWellnessScore = (data) => {
    const weights = {
        activity: 0.25,    // Daily movement
        sleep: 0.25,       // Sleep health
        heart: 0.20,       // Cardiovascular health
        stress: 0.15,      // Stress indicators (HRV)
        nutrition: 0.15    // Calorie balance (if available)
    };

    let score = 0;
    let totalWeight = 0;
    const factors = {};

    // Activity Score (steps + active minutes)
    if (data.steps || data.activeMinutes) {
        let activityScore = 0;

        // Steps (10,000 is gold standard)
        if (data.steps) {
            if (data.steps >= 10000) activityScore += 50;
            else if (data.steps >= 7500) activityScore += 40;
            else if (data.steps >= 5000) activityScore += 30;
            else activityScore += (data.steps / 5000) * 30;
        }

        // Active minutes (150/week = ~22/day recommended)
        if (data.activeMinutes) {
            if (data.activeMinutes >= 30) activityScore += 50;
            else if (data.activeMinutes >= 22) activityScore += 40;
            else if (data.activeMinutes >= 15) activityScore += 30;
            else activityScore += (data.activeMinutes / 15) * 30;
        }

        activityScore = Math.min(100, activityScore);
        score += activityScore * weights.activity;
        totalWeight += weights.activity;
        factors.activity = {
            steps: data.steps,
            activeMinutes: data.activeMinutes,
            score: activityScore,
            weight: weights.activity
        };
    }

    // Sleep Score
    if (data.sleepDuration) {
        const sleepHours = data.sleepDuration / 60;
        let sleepScore;
        if (sleepHours >= 7 && sleepHours <= 9) sleepScore = 100;
        else if (sleepHours >= 6) sleepScore = 75;
        else if (sleepHours >= 5) sleepScore = 50;
        else sleepScore = 25;

        // Bonus for sleep efficiency
        if (data.sleepEfficiency && data.sleepEfficiency >= 85) {
            sleepScore = Math.min(100, sleepScore + 10);
        }

        score += sleepScore * weights.sleep;
        totalWeight += weights.sleep;
        factors.sleep = { value: sleepHours.toFixed(1), efficiency: data.sleepEfficiency, score: sleepScore, weight: weights.sleep };
    }

    // Heart Health Score
    if (data.restingHeartRate || data.vo2Max) {
        let heartScore = 0;
        let heartFactors = 0;

        if (data.restingHeartRate) {
            if (data.restingHeartRate <= 60) heartScore += 50;
            else if (data.restingHeartRate <= 70) heartScore += 40;
            else if (data.restingHeartRate <= 80) heartScore += 30;
            else heartScore += 20;
            heartFactors++;
        }

        if (data.vo2Max) {
            // VO2 Max scoring (age-adjusted would be ideal)
            if (data.vo2Max >= 50) heartScore += 50;
            else if (data.vo2Max >= 40) heartScore += 40;
            else if (data.vo2Max >= 35) heartScore += 30;
            else heartScore += 20;
            heartFactors++;
        }

        heartScore = heartFactors > 0 ? heartScore / heartFactors * 2 : 0;
        score += heartScore * weights.heart;
        totalWeight += weights.heart;
        factors.heart = { rhr: data.restingHeartRate, vo2Max: data.vo2Max, score: heartScore, weight: weights.heart };
    }

    // Stress Score (inverse - low HRV = high stress)
    if (data.hrv) {
        let stressScore;
        if (data.hrv >= 60) stressScore = 100; // Low stress
        else if (data.hrv >= 45) stressScore = 80;
        else if (data.hrv >= 30) stressScore = 60;
        else if (data.hrv >= 20) stressScore = 40;
        else stressScore = 20; // High stress

        score += stressScore * weights.stress;
        totalWeight += weights.stress;
        factors.stress = { hrv: data.hrv, score: stressScore, weight: weights.stress };
    }

    // Nutrition Balance (if tracking)
    if (data.caloriesBurned && data.nutritionCalories) {
        const balance = data.caloriesBurned - data.nutritionCalories;
        let nutritionScore;
        // Ideal: slight deficit for weight loss, or balanced
        if (Math.abs(balance) <= 200) nutritionScore = 100; // Balanced
        else if (balance > 0 && balance <= 500) nutritionScore = 85; // Healthy deficit
        else if (balance < 0 && balance >= -300) nutritionScore = 80; // Slight surplus
        else if (balance > 500) nutritionScore = 60; // Large deficit
        else nutritionScore = 50; // Large surplus

        score += nutritionScore * weights.nutrition;
        totalWeight += weights.nutrition;
        factors.nutrition = { burned: data.caloriesBurned, consumed: data.nutritionCalories, balance, score: nutritionScore, weight: weights.nutrition };
    }

    const finalScore = totalWeight > 0 ? Math.round(score / totalWeight) : 0;

    return {
        score: finalScore,
        grade: getGrade(finalScore),
        factors,
        status: getWellnessStatus(finalScore),
        insights: generateWellnessInsights(factors)
    };
};

// ============================================
// STRAIN / TRAINING LOAD CALCULATION
// ============================================
// 0-21 scale (WHOOP-style)

const calculateStrainScore = (data) => {
    let strain = 0;

    // Heart rate zone contribution
    if (data.heartRateZones && Array.isArray(data.heartRateZones)) {
        data.heartRateZones.forEach(zone => {
            const minutes = zone.minutes || 0;
            switch (zone.name?.toLowerCase()) {
                case 'out of range':
                    strain += minutes * 0.01;
                    break;
                case 'fat burn':
                    strain += minutes * 0.05;
                    break;
                case 'cardio':
                    strain += minutes * 0.15;
                    break;
                case 'peak':
                    strain += minutes * 0.30;
                    break;
            }
        });
    }

    // Active Zone Minutes boost
    if (data.activeZoneMinutes) {
        const azm = typeof data.activeZoneMinutes === 'object'
            ? data.activeZoneMinutes.total
            : data.activeZoneMinutes;
        strain += azm * 0.1;
    }

    // Calorie expenditure factor
    if (data.caloriesBurned && data.caloriesBurned > 2000) {
        strain += ((data.caloriesBurned - 2000) / 1000) * 2;
    }

    // Cap at 21
    strain = Math.min(21, Math.max(0, strain));

    return {
        score: Math.round(strain * 10) / 10,
        level: getStrainLevel(strain),
        recommendation: getStrainRecommendation(strain)
    };
};

// ============================================
// MASTER INTELLIGENCE FUNCTION
// ============================================

const processWearableData = (data) => {
    const startTime = Date.now();

    // Calculate all scores
    const recovery = calculateRecoveryScore(data);
    const performance = calculatePerformanceReadiness(data, recovery);
    const wellness = calculateWellnessScore(data);
    const strain = calculateStrainScore(data);

    // Generate overall status
    const overallScore = Math.round(
        (recovery.score * 0.35) +
        (performance.score * 0.30) +
        (wellness.score * 0.35)
    );

    // Generate adaptive recommendations
    const recommendations = generateAdaptiveRecommendations(recovery, performance, wellness, strain);

    // Training recommendation
    const trainingAdvice = generateTrainingAdvice(recovery, performance, strain);

    return {
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,

        // Core Scores
        overall: {
            score: overallScore,
            grade: getGrade(overallScore),
            status: getOverallStatus(overallScore)
        },

        recovery,
        performance,
        wellness,
        strain,

        // Recommendations
        recommendations,
        trainingAdvice,

        // Quick summary for UI
        summary: {
            recoveryScore: recovery.score,
            performanceScore: performance.score,
            wellnessScore: wellness.score,
            strainScore: strain.score,
            todaysFocus: getTodaysFocus(recovery, performance, wellness),
            quickTip: getQuickTip(recovery, performance)
        }
    };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getGrade(score) {
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'A-';
    if (score >= 75) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 65) return 'B-';
    if (score >= 60) return 'C+';
    if (score >= 55) return 'C';
    if (score >= 50) return 'C-';
    if (score >= 45) return 'D+';
    if (score >= 40) return 'D';
    return 'F';
}

function getRecoveryStatus(score) {
    if (score >= 80) return { level: 'optimal', message: 'Fully recovered and ready for high intensity' };
    if (score >= 60) return { level: 'good', message: 'Well recovered, moderate-high intensity OK' };
    if (score >= 40) return { level: 'moderate', message: 'Partial recovery, consider lighter training' };
    if (score >= 20) return { level: 'low', message: 'Under-recovered, prioritize rest' };
    return { level: 'critical', message: 'Significant recovery deficit, rest recommended' };
}

function getRecoveryRecommendation(score, factors) {
    const recs = [];

    if (factors.hrv && factors.hrv.score < 60) {
        recs.push('HRV is below optimal - focus on stress management and sleep quality');
    }
    if (factors.sleepDuration && factors.sleepDuration.score < 70) {
        recs.push('Increase sleep duration to 7-9 hours for better recovery');
    }
    if (factors.rhr && factors.rhr.score < 60) {
        recs.push('Elevated resting heart rate detected - consider a recovery day');
    }

    if (recs.length === 0) {
        if (score >= 80) recs.push('Recovery is excellent - you are cleared for intense training');
        else recs.push('Recovery is adequate - listen to your body during training');
    }

    return recs;
}

function getTrainingZone(score) {
    if (score >= 80) return { zone: 'green', intensity: 'high', description: 'All training types cleared' };
    if (score >= 60) return { zone: 'yellow', intensity: 'moderate', description: 'Moderate intensity recommended' };
    if (score >= 40) return { zone: 'orange', intensity: 'light', description: 'Light activity or technique work' };
    return { zone: 'red', intensity: 'rest', description: 'Active recovery or rest day' };
}

function getPerformanceRecommendation(score) {
    if (score >= 80) return 'Peak performance day - ideal for PRs, competitions, or high-intensity sessions';
    if (score >= 60) return 'Good performance potential - standard training is appropriate';
    if (score >= 40) return 'Reduced capacity - focus on technique and moderate loads';
    return 'Low readiness - prioritize recovery activities';
}

function getWellnessStatus(score) {
    if (score >= 80) return { level: 'thriving', message: 'Excellent overall wellness' };
    if (score >= 60) return { level: 'balanced', message: 'Good lifestyle balance' };
    if (score >= 40) return { level: 'attention', message: 'Some areas need attention' };
    return { level: 'concern', message: 'Multiple wellness factors need improvement' };
}

function generateWellnessInsights(factors) {
    const insights = [];

    if (factors.activity && factors.activity.score < 60) {
        insights.push({ type: 'activity', message: 'Increase daily movement - aim for 10,000 steps', icon: 'fa-walking' });
    }
    if (factors.sleep && factors.sleep.score < 70) {
        insights.push({ type: 'sleep', message: 'Sleep quality needs improvement', icon: 'fa-moon' });
    }
    if (factors.stress && factors.stress.score < 60) {
        insights.push({ type: 'stress', message: 'Stress levels elevated - consider relaxation techniques', icon: 'fa-brain' });
    }
    if (factors.heart && factors.heart.score < 60) {
        insights.push({ type: 'cardio', message: 'Cardiovascular health could improve with more aerobic activity', icon: 'fa-heart-pulse' });
    }

    return insights;
}

function getStrainLevel(strain) {
    if (strain >= 18) return { level: 'all-out', description: 'Maximum effort day', color: '#dc2626' };
    if (strain >= 14) return { level: 'strenuous', description: 'High intensity training', color: '#f97316' };
    if (strain >= 10) return { level: 'moderate', description: 'Solid training session', color: '#eab308' };
    if (strain >= 6) return { level: 'light', description: 'Light activity day', color: '#22c55e' };
    return { level: 'minimal', description: 'Rest or very light activity', color: '#3b82f6' };
}

function getStrainRecommendation(strain) {
    if (strain >= 18) return 'Very high strain - ensure adequate recovery in coming days';
    if (strain >= 14) return 'High strain day - good stimulus for adaptation';
    if (strain >= 10) return 'Moderate strain - balanced training day';
    if (strain >= 6) return 'Light strain - good for active recovery';
    return 'Minimal strain - rest day or very light activity';
}

function getOverallStatus(score) {
    if (score >= 80) return { status: 'optimal', message: 'All systems go', icon: 'fa-bolt' };
    if (score >= 60) return { status: 'good', message: 'Performing well', icon: 'fa-check' };
    if (score >= 40) return { status: 'moderate', message: 'Room for improvement', icon: 'fa-exclamation' };
    return { status: 'low', message: 'Needs attention', icon: 'fa-triangle-exclamation' };
}

function generateAdaptiveRecommendations(recovery, performance, wellness, strain) {
    const recs = [];

    // Priority-based recommendations
    if (recovery.score < 50) {
        recs.push({
            priority: 'high',
            category: 'recovery',
            title: 'Recovery Deficit',
            message: 'Your body needs rest. Consider a light day or complete rest.',
            action: 'Take a recovery day',
            icon: 'fa-bed'
        });
    }

    if (performance.score >= 80 && recovery.score >= 70) {
        recs.push({
            priority: 'high',
            category: 'performance',
            title: 'Peak Day',
            message: 'Excellent readiness detected. Great day for high-intensity training or testing.',
            action: 'Go for that PR',
            icon: 'fa-fire'
        });
    }

    if (strain.score > 15 && recovery.score < 60) {
        recs.push({
            priority: 'high',
            category: 'balance',
            title: 'High Strain, Low Recovery',
            message: 'Recent high training load with insufficient recovery. Risk of overtraining.',
            action: 'Reduce intensity today',
            icon: 'fa-scale-unbalanced'
        });
    }

    if (wellness.score < 60) {
        recs.push({
            priority: 'medium',
            category: 'wellness',
            title: 'Wellness Check',
            message: 'Multiple lifestyle factors need attention for optimal health.',
            action: 'Review sleep and activity habits',
            icon: 'fa-heart'
        });
    }

    return recs;
}

function generateTrainingAdvice(recovery, performance, strain) {
    const advice = {
        cleared: [],
        caution: [],
        avoid: []
    };

    if (recovery.score >= 70 && performance.score >= 70) {
        advice.cleared = ['Heavy compound lifts', 'High-intensity intervals', 'Competition prep', 'Max attempts'];
        advice.caution = ['Multiple high-intensity sessions', 'Extended duration workouts'];
    } else if (recovery.score >= 50 || performance.score >= 50) {
        advice.cleared = ['Moderate intensity training', 'Technique work', 'Hypertrophy training'];
        advice.caution = ['Heavy singles', 'High-volume sessions'];
        advice.avoid = ['PR attempts', 'Competition-style training'];
    } else {
        advice.cleared = ['Light cardio', 'Mobility work', 'Stretching'];
        advice.caution = ['Any high-intensity work'];
        advice.avoid = ['Heavy lifting', 'High-intensity intervals', 'Extended sessions'];
    }

    return advice;
}

function getTodaysFocus(recovery, performance, wellness) {
    if (recovery.score < 50) return 'Recovery';
    if (performance.score >= 80) return 'Performance';
    if (wellness.score < 60) return 'Wellness';
    return 'Training';
}

function getQuickTip(recovery, performance) {
    if (recovery.score >= 80 && performance.score >= 80) {
        return 'Green light for intense training today';
    }
    if (recovery.score < 50) {
        return 'Prioritize sleep and light activity today';
    }
    if (performance.score < 50) {
        return 'Focus on technique over intensity today';
    }
    return 'Listen to your body and train accordingly';
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    processWearableData,
    calculateRecoveryScore,
    calculatePerformanceReadiness,
    calculateWellnessScore,
    calculateStrainScore,
    getGrade,
    getTrainingZone
};
