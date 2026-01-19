// Src/services/prDetectionService.js - Personal Record Detection Intelligence
// Automatically detects PRs across all exercises and rep ranges

const User = require('../models/User');

/**
 * Calculate estimated 1RM using Brzycki formula
 * @param {number} weight - Weight lifted
 * @param {number} reps - Reps completed
 * @returns {number} Estimated 1RM
 */
function calculate1RM(weight, reps) {
    if (reps === 1) return weight;
    if (reps > 12) return weight * (1 + reps / 30); // Epley for higher reps
    // Brzycki formula: 1RM = weight × (36 / (37 - reps))
    return Math.round(weight * (36 / (37 - reps)));
}

/**
 * Calculate estimated weight for a given rep range
 * @param {number} oneRM - 1 rep max
 * @param {number} targetReps - Target rep count
 * @returns {number} Estimated weight
 */
function calculateWeightForReps(oneRM, targetReps) {
    if (targetReps === 1) return oneRM;
    // Reverse Brzycki
    return Math.round(oneRM * ((37 - targetReps) / 36));
}

/**
 * Detect PRs from a workout completion
 * @param {string} userId - User ID
 * @param {Array} exercises - Array of exercise data with sets
 * @returns {Object} Detected PRs and updates
 */
exports.detectPRs = async (userId, exercises) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Initialize PRs array if doesn't exist
        if (!user.personalRecords) {
            user.personalRecords = [];
        }

        const newPRs = [];
        const updatedPRs = [];

        for (const exercise of exercises) {
            if (!exercise.name || !exercise.sets || !Array.isArray(exercise.sets)) {
                continue;
            }

            // Find best set from this exercise (highest estimated 1RM)
            let bestSet = null;
            let bestEstimated1RM = 0;

            for (const set of exercise.sets) {
                if (!set.weight || !set.reps || set.reps === 0) continue;

                const estimated1RM = calculate1RM(set.weight, set.reps);
                if (estimated1RM > bestEstimated1RM) {
                    bestEstimated1RM = estimated1RM;
                    bestSet = {
                        weight: set.weight,
                        reps: set.reps,
                        rpe: set.rpe || null
                    };
                }
            }

            if (!bestSet || bestEstimated1RM === 0) continue;

            // Normalize exercise name for comparison
            const normalizedName = normalizeExerciseName(exercise.name);

            // Find existing PR for this exercise
            const existingPRIndex = user.personalRecords.findIndex(
                pr => normalizeExerciseName(pr.exerciseName) === normalizedName
            );

            const prData = {
                exerciseName: exercise.name,
                normalizedName,
                weight: bestSet.weight,
                reps: bestSet.reps,
                rpe: bestSet.rpe,
                estimated1RM: bestEstimated1RM,
                date: new Date(),
                // Calculate rep maxes for common rep ranges
                repMaxes: {
                    '1RM': bestEstimated1RM,
                    '3RM': calculateWeightForReps(bestEstimated1RM, 3),
                    '5RM': calculateWeightForReps(bestEstimated1RM, 5),
                    '8RM': calculateWeightForReps(bestEstimated1RM, 8),
                    '10RM': calculateWeightForReps(bestEstimated1RM, 10)
                }
            };

            if (existingPRIndex === -1) {
                // New exercise - first PR
                user.personalRecords.push(prData);
                newPRs.push({
                    ...prData,
                    type: 'first-pr',
                    improvement: null,
                    message: `First recorded ${exercise.name}: ${bestSet.weight}lbs x ${bestSet.reps} (est. 1RM: ${bestEstimated1RM}lbs)`
                });
            } else {
                const existingPR = user.personalRecords[existingPRIndex];
                const previousBest = existingPR.estimated1RM || calculate1RM(existingPR.weight, existingPR.reps);

                if (bestEstimated1RM > previousBest) {
                    // New PR!
                    const improvement = bestEstimated1RM - previousBest;
                    const improvementPercent = ((improvement / previousBest) * 100).toFixed(1);

                    // Store previous for history
                    if (!existingPR.history) existingPR.history = [];
                    existingPR.history.push({
                        weight: existingPR.weight,
                        reps: existingPR.reps,
                        estimated1RM: previousBest,
                        date: existingPR.date
                    });

                    // Update to new PR
                    user.personalRecords[existingPRIndex] = {
                        ...prData,
                        history: existingPR.history.slice(-10) // Keep last 10
                    };

                    newPRs.push({
                        ...prData,
                        type: 'new-pr',
                        previousBest,
                        improvement,
                        improvementPercent,
                        message: `NEW PR! ${exercise.name}: ${bestSet.weight}lbs x ${bestSet.reps} (est. 1RM: ${bestEstimated1RM}lbs, +${improvement}lbs / +${improvementPercent}%)`
                    });
                } else if (bestEstimated1RM === previousBest) {
                    // Matched PR
                    updatedPRs.push({
                        exerciseName: exercise.name,
                        type: 'matched',
                        message: `Matched PR: ${exercise.name} at ${bestEstimated1RM}lbs estimated 1RM`
                    });
                }
            }
        }

        // Save updates
        if (newPRs.length > 0) {
            await user.save();
        }

        return {
            newPRs,
            updatedPRs,
            totalPRs: user.personalRecords.length,
            hasPRs: newPRs.length > 0
        };

    } catch (error) {
        console.error('[PRDetection] Error detecting PRs:', error);
        return { newPRs: [], updatedPRs: [], error: error.message };
    }
};

/**
 * Get all PRs for a user
 */
exports.getAllPRs = async (userId) => {
    try {
        const user = await User.findById(userId).select('personalRecords');
        if (!user) {
            throw new Error('User not found');
        }

        const prs = user.personalRecords || [];

        // Group by category
        const grouped = {
            compounds: [],
            accessories: [],
            cardio: []
        };

        const compoundLifts = ['squat', 'bench', 'deadlift', 'overhead press', 'row', 'pull-up', 'chin-up'];

        for (const pr of prs) {
            const normalized = normalizeExerciseName(pr.exerciseName);
            const isCompound = compoundLifts.some(lift => normalized.includes(lift));

            if (isCompound) {
                grouped.compounds.push(pr);
            } else {
                grouped.accessories.push(pr);
            }
        }

        // Sort by estimated 1RM within each category
        grouped.compounds.sort((a, b) => (b.estimated1RM || 0) - (a.estimated1RM || 0));
        grouped.accessories.sort((a, b) => (b.estimated1RM || 0) - (a.estimated1RM || 0));

        return {
            prs,
            grouped,
            total: prs.length,
            bigThreeTotal: calculateBigThreeTotal(prs)
        };

    } catch (error) {
        console.error('[PRDetection] Error getting PRs:', error);
        return { prs: [], error: error.message };
    }
};

/**
 * Calculate powerlifting total from Big 3
 */
function calculateBigThreeTotal(prs) {
    const squat = prs.find(pr => normalizeExerciseName(pr.exerciseName).includes('squat') &&
        !normalizeExerciseName(pr.exerciseName).includes('front') &&
        !normalizeExerciseName(pr.exerciseName).includes('pause'));
    const bench = prs.find(pr => normalizeExerciseName(pr.exerciseName).includes('bench') &&
        !normalizeExerciseName(pr.exerciseName).includes('close') &&
        !normalizeExerciseName(pr.exerciseName).includes('incline'));
    const deadlift = prs.find(pr => normalizeExerciseName(pr.exerciseName).includes('deadlift') &&
        !normalizeExerciseName(pr.exerciseName).includes('romanian') &&
        !normalizeExerciseName(pr.exerciseName).includes('deficit'));

    if (!squat || !bench || !deadlift) {
        return null;
    }

    return {
        squat: squat.estimated1RM,
        bench: bench.estimated1RM,
        deadlift: deadlift.estimated1RM,
        total: squat.estimated1RM + bench.estimated1RM + deadlift.estimated1RM
    };
}

/**
 * Normalize exercise name for consistent comparison
 */
function normalizeExerciseName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Get PR history for specific exercise
 */
exports.getExerciseHistory = async (userId, exerciseName) => {
    try {
        const user = await User.findById(userId).select('personalRecords');
        if (!user) {
            throw new Error('User not found');
        }

        const normalized = normalizeExerciseName(exerciseName);
        const pr = user.personalRecords.find(
            p => normalizeExerciseName(p.exerciseName) === normalized
        );

        if (!pr) {
            return { found: false };
        }

        return {
            found: true,
            current: {
                weight: pr.weight,
                reps: pr.reps,
                estimated1RM: pr.estimated1RM,
                date: pr.date,
                repMaxes: pr.repMaxes
            },
            history: pr.history || [],
            progression: calculateProgression(pr)
        };

    } catch (error) {
        console.error('[PRDetection] Error getting exercise history:', error);
        return { found: false, error: error.message };
    }
};

/**
 * Calculate progression stats
 */
function calculateProgression(pr) {
    if (!pr.history || pr.history.length === 0) {
        return null;
    }

    const oldest = pr.history[0];
    const totalImprovement = pr.estimated1RM - (oldest.estimated1RM || calculate1RM(oldest.weight, oldest.reps));
    const daysBetween = Math.ceil((new Date(pr.date) - new Date(oldest.date)) / (1000 * 60 * 60 * 24));
    const weeklyGain = (totalImprovement / daysBetween) * 7;

    return {
        totalImprovement,
        percentImprovement: ((totalImprovement / (oldest.estimated1RM || 1)) * 100).toFixed(1),
        daysTracked: daysBetween,
        averageWeeklyGain: weeklyGain.toFixed(1),
        prCount: pr.history.length + 1
    };
}

module.exports = exports;
