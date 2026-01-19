// Src/services/recoveryService.js - Training Readiness Intelligence
// Calculates training readiness from wearable data and recommends workout adjustments

const WearableData = require('../models/WearableData');
const CheckIn = require('../models/CheckIn');

/**
 * Calculate training readiness score and recommendations
 * @param {string} userId - User ID
 * @returns {Object} Training readiness data with recommendations
 */
exports.getTrainingReadiness = async (userId) => {
    try {
        // Get latest wearable data (last 7 days for trend analysis)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const wearableData = await WearableData.find({
            userId,
            date: { $gte: weekAgo }
        }).sort({ date: -1 }).limit(7);

        const latestData = wearableData[0];
        const latestCheckIn = await CheckIn.findOne({ user: userId }).sort({ date: -1 });

        // Default values if no data
        if (!latestData && !latestCheckIn) {
            return {
                readinessScore: 70,
                intensityModifier: 1.0,
                recommendation: 'full-intensity',
                dataAvailable: false,
                explanation: 'No wearable data available. Training at full intensity by default.',
                factors: {}
            };
        }

        // Calculate individual factors
        const factors = {};
        let totalScore = 0;
        let factorCount = 0;

        // 1. HRV Factor (30% weight) - Higher = better recovery
        if (latestData?.hrv) {
            const hrvBaseline = latestData.hrvBaseline || 50;
            const hrvRatio = latestData.hrv / hrvBaseline;
            factors.hrv = {
                value: latestData.hrv,
                baseline: hrvBaseline,
                score: Math.min(100, Math.max(0, hrvRatio * 70 + 30)),
                status: hrvRatio >= 1.1 ? 'elevated' : hrvRatio >= 0.9 ? 'normal' : 'low'
            };
            totalScore += factors.hrv.score * 0.30;
            factorCount += 0.30;
        }

        // 2. Sleep Factor (30% weight)
        if (latestData?.sleepDuration) {
            const sleepHours = latestData.sleepDuration / 60;
            const sleepTarget = 8; // 8 hours optimal
            const sleepRatio = sleepHours / sleepTarget;
            const sleepQualityBonus = latestData.sleepScore ? (latestData.sleepScore - 70) / 30 * 10 : 0;

            factors.sleep = {
                hours: sleepHours.toFixed(1),
                score: Math.min(100, Math.max(0, sleepRatio * 80 + 20 + sleepQualityBonus)),
                quality: latestData.sleepScore || null,
                deepSleep: latestData.deepSleep ? (latestData.deepSleep / 60).toFixed(1) : null,
                status: sleepHours >= 7 ? 'good' : sleepHours >= 6 ? 'fair' : 'poor'
            };
            totalScore += factors.sleep.score * 0.30;
            factorCount += 0.30;
        }

        // 3. Resting Heart Rate Factor (20% weight) - Lower = better recovery
        if (latestData?.restingHeartRate) {
            // Calculate 7-day average RHR for baseline
            const rhrValues = wearableData.filter(d => d.restingHeartRate).map(d => d.restingHeartRate);
            const avgRHR = rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length;
            const rhrDiff = avgRHR - latestData.restingHeartRate;

            factors.rhr = {
                value: latestData.restingHeartRate,
                average: Math.round(avgRHR),
                score: Math.min(100, Math.max(0, 70 + rhrDiff * 5)),
                status: rhrDiff >= 3 ? 'elevated' : rhrDiff >= -3 ? 'normal' : 'low'
            };
            totalScore += factors.rhr.score * 0.20;
            factorCount += 0.20;
        }

        // 4. Subjective Factor (20% weight) - From check-ins
        if (latestCheckIn) {
            const checkInAge = (Date.now() - new Date(latestCheckIn.date)) / (1000 * 60 * 60 * 24);
            if (checkInAge <= 2) { // Only use check-ins from last 2 days
                const moodScore = latestCheckIn.mood ? (latestCheckIn.mood / 5) * 100 : 70;
                const energyScore = latestCheckIn.energyLevel ? (latestCheckIn.energyLevel / 5) * 100 : 70;
                const sorenessScore = latestCheckIn.soreness ? (6 - latestCheckIn.soreness) / 5 * 100 : 70;

                factors.subjective = {
                    mood: latestCheckIn.mood,
                    energy: latestCheckIn.energyLevel,
                    soreness: latestCheckIn.soreness,
                    score: (moodScore + energyScore + sorenessScore) / 3,
                    status: 'from-checkin'
                };
                totalScore += factors.subjective.score * 0.20;
                factorCount += 0.20;
            }
        }

        // Calculate final readiness score (normalize to 0-100)
        const readinessScore = factorCount > 0 ? Math.round(totalScore / factorCount) : 70;

        // Determine intensity modifier and recommendation
        let intensityModifier = 1.0;
        let recommendation = 'full-intensity';
        let explanation = '';

        if (readinessScore >= 85) {
            intensityModifier = 1.05;
            recommendation = 'push-hard';
            explanation = 'Exceptional recovery. Consider pushing intensity or adding volume.';
        } else if (readinessScore >= 70) {
            intensityModifier = 1.0;
            recommendation = 'full-intensity';
            explanation = 'Good recovery. Train as programmed.';
        } else if (readinessScore >= 55) {
            intensityModifier = 0.9;
            recommendation = 'moderate-intensity';
            explanation = 'Moderate recovery. Reduce top sets by 5-10% or drop 1 set per exercise.';
        } else if (readinessScore >= 40) {
            intensityModifier = 0.75;
            recommendation = 'reduce-volume';
            explanation = 'Low recovery. Reduce volume by 25% and focus on technique.';
        } else {
            intensityModifier = 0.5;
            recommendation = 'active-recovery';
            explanation = 'Poor recovery. Consider light mobility work or full rest day.';
        }

        // Build detailed explanation
        const factorDetails = [];
        if (factors.hrv) {
            factorDetails.push(`HRV: ${factors.hrv.value} (${factors.hrv.status})`);
        }
        if (factors.sleep) {
            factorDetails.push(`Sleep: ${factors.sleep.hours}h (${factors.sleep.status})`);
        }
        if (factors.rhr) {
            factorDetails.push(`RHR: ${factors.rhr.value} bpm (${factors.rhr.status})`);
        }
        if (factors.subjective) {
            factorDetails.push(`Subjective: Energy ${factors.subjective.energy}/5`);
        }

        return {
            readinessScore,
            intensityModifier,
            recommendation,
            dataAvailable: true,
            explanation,
            factorSummary: factorDetails.join(' | '),
            factors,
            latestDataDate: latestData?.date,
            trend: calculateTrend(wearableData)
        };

    } catch (error) {
        console.error('[RecoveryService] Error calculating readiness:', error);
        return {
            readinessScore: 70,
            intensityModifier: 1.0,
            recommendation: 'full-intensity',
            dataAvailable: false,
            explanation: 'Error calculating recovery. Training at default intensity.',
            error: error.message
        };
    }
};

/**
 * Calculate 7-day recovery trend
 */
function calculateTrend(wearableData) {
    if (wearableData.length < 3) return 'insufficient-data';

    const recoveryScores = wearableData
        .filter(d => d.recoveryScore)
        .map(d => d.recoveryScore);

    if (recoveryScores.length < 3) return 'insufficient-data';

    const recent = recoveryScores.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const older = recoveryScores.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const diff = recent - older;

    if (diff > 5) return 'improving';
    if (diff < -5) return 'declining';
    return 'stable';
}

/**
 * Get weekly recovery summary
 */
exports.getWeeklySummary = async (userId) => {
    try {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const data = await WearableData.find({
            userId,
            date: { $gte: weekAgo }
        }).sort({ date: 1 });

        if (data.length === 0) {
            return { available: false };
        }

        const avgSleep = data.filter(d => d.sleepDuration).reduce((sum, d) => sum + d.sleepDuration / 60, 0) / data.filter(d => d.sleepDuration).length;
        const avgHRV = data.filter(d => d.hrv).reduce((sum, d) => sum + d.hrv, 0) / data.filter(d => d.hrv).length;
        const avgRHR = data.filter(d => d.restingHeartRate).reduce((sum, d) => sum + d.restingHeartRate, 0) / data.filter(d => d.restingHeartRate).length;
        const avgRecovery = data.filter(d => d.recoveryScore).reduce((sum, d) => sum + d.recoveryScore, 0) / data.filter(d => d.recoveryScore).length;

        return {
            available: true,
            dataPoints: data.length,
            averages: {
                sleep: avgSleep ? avgSleep.toFixed(1) : null,
                hrv: avgHRV ? Math.round(avgHRV) : null,
                rhr: avgRHR ? Math.round(avgRHR) : null,
                recovery: avgRecovery ? Math.round(avgRecovery) : null
            },
            best: {
                sleep: Math.max(...data.filter(d => d.sleepDuration).map(d => d.sleepDuration / 60)) || null,
                hrv: Math.max(...data.filter(d => d.hrv).map(d => d.hrv)) || null
            },
            worst: {
                sleep: Math.min(...data.filter(d => d.sleepDuration).map(d => d.sleepDuration / 60)) || null,
                recovery: Math.min(...data.filter(d => d.recoveryScore).map(d => d.recoveryScore)) || null
            }
        };
    } catch (error) {
        console.error('[RecoveryService] Weekly summary error:', error);
        return { available: false, error: error.message };
    }
};

/**
 * Calculate deload recommendation based on cumulative fatigue
 */
exports.shouldDeload = async (userId, weeksOfTraining = 4) => {
    try {
        const periodStart = new Date();
        periodStart.setDate(periodStart.getDate() - (weeksOfTraining * 7));

        const data = await WearableData.find({
            userId,
            date: { $gte: periodStart }
        }).sort({ date: 1 });

        if (data.length < 14) {
            return { recommend: false, reason: 'Insufficient data for deload analysis' };
        }

        // Check for declining trend
        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));

        const firstHalfAvg = firstHalf.filter(d => d.recoveryScore).reduce((sum, d) => sum + d.recoveryScore, 0) / firstHalf.filter(d => d.recoveryScore).length;
        const secondHalfAvg = secondHalf.filter(d => d.recoveryScore).reduce((sum, d) => sum + d.recoveryScore, 0) / secondHalf.filter(d => d.recoveryScore).length;

        const decline = firstHalfAvg - secondHalfAvg;

        // Check for consistently low scores
        const recentLow = secondHalf.filter(d => d.recoveryScore && d.recoveryScore < 60).length;
        const lowPercentage = recentLow / secondHalf.length;

        if (decline > 10 || lowPercentage > 0.5) {
            return {
                recommend: true,
                severity: decline > 15 || lowPercentage > 0.7 ? 'full-deload' : 'light-deload',
                reason: decline > 10
                    ? `Recovery declining (${Math.round(decline)} points over ${weeksOfTraining} weeks)`
                    : `${Math.round(lowPercentage * 100)}% of recent days below threshold`,
                suggestion: decline > 15 || lowPercentage > 0.7
                    ? 'Take a full deload week: reduce volume 50%, intensity 60-70%'
                    : 'Take a light deload: reduce volume 30%, maintain intensity'
            };
        }

        return { recommend: false, reason: 'Recovery metrics stable' };
    } catch (error) {
        console.error('[RecoveryService] Deload analysis error:', error);
        return { recommend: false, error: error.message };
    }
};

module.exports = exports;
