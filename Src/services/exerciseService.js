/**
 * ClockWork Exercise Service
 * Integrates MuscleWiki (videos) + Free Exercise DB (images)
 *
 * Sources:
 * - MuscleWiki API: https://workoutapi.vercel.app/exercises (videos)
 * - Free Exercise DB: https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json (images)
 */

const axios = require('axios');

// Cache for exercises (refreshed every 24 hours)
let exerciseCache = {
    muscleWiki: [],
    freeExerciseDb: [],
    merged: [],
    lastFetch: null
};

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// API URLs
const MUSCLE_WIKI_API = 'https://workoutapi.vercel.app/exercises';
const FREE_EXERCISE_DB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const FREE_EXERCISE_IMAGES_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

// Muscle group mappings
const MUSCLE_MAP = {
    'abdominals': 'abs',
    'abs': 'abs',
    'biceps': 'biceps',
    'calves': 'calves',
    'chest': 'chest',
    'forearms': 'forearms',
    'glutes': 'glutes',
    'hamstrings': 'hamstrings',
    'lats': 'lats',
    'lower back': 'lower_back',
    'lower_back': 'lower_back',
    'middle back': 'back',
    'neck': 'neck',
    'quadriceps': 'quads',
    'quads': 'quads',
    'shoulders': 'shoulders',
    'traps': 'traps',
    'triceps': 'triceps',
    'adductors': 'adductors',
    'abductors': 'abductors',
    'obliques': 'obliques'
};

// Equipment mappings
const EQUIPMENT_MAP = {
    'barbell': 'barbell',
    'dumbbell': 'dumbbell',
    'dumbbells': 'dumbbell',
    'cable': 'cable',
    'cables': 'cable',
    'machine': 'machine',
    'body only': 'bodyweight',
    'bodyweight': 'bodyweight',
    'kettlebell': 'kettlebell',
    'kettlebells': 'kettlebell',
    'bands': 'resistance_band',
    'band': 'resistance_band',
    'e-z curl bar': 'ez_bar',
    'medicine ball': 'medicine_ball',
    'exercise ball': 'swiss_ball',
    'foam roll': 'foam_roller',
    'other': 'other',
    'none': 'bodyweight',
    'trx': 'trx',
    'stretches': 'bodyweight',
    'plate': 'plate'
};

/**
 * Fetch exercises from MuscleWiki API (has videos!)
 */
async function fetchMuscleWikiExercises() {
    try {
        console.log('[ExerciseService] Fetching from MuscleWiki API...');
        const response = await axios.get(MUSCLE_WIKI_API, { timeout: 30000 });

        const exercises = response.data.map(ex => ({
            id: `mw_${ex.id}`,
            source: 'musclewiki',
            name: ex.exercise_name,
            category: ex.Category?.toLowerCase() || 'other',
            difficulty: mapDifficulty(ex.Difficulty),
            force: ex.Force?.toLowerCase() || null,
            grip: ex.Grips || null,

            // Muscles
            primaryMuscles: ex.target?.Primary?.map(m => MUSCLE_MAP[m.toLowerCase()] || m.toLowerCase()) || [],
            secondaryMuscles: ex.target?.Secondary?.map(m => MUSCLE_MAP[m.toLowerCase()] || m.toLowerCase()) || [],

            // Instructions
            instructions: ex.steps || [],
            details: ex.details || null,

            // VIDEOS - the gold!
            videos: ex.videoURL || [],
            youtubeUrl: ex.youtubeURL || null,

            // Equipment
            equipment: EQUIPMENT_MAP[ex.Category?.toLowerCase()] || ex.Category?.toLowerCase() || 'other',

            // Metadata
            hasVideo: ex.videoURL && ex.videoURL.length > 0,
            hasYoutube: !!ex.youtubeURL
        }));

        console.log(`[ExerciseService] Fetched ${exercises.length} exercises from MuscleWiki`);
        return exercises;
    } catch (error) {
        console.error('[ExerciseService] MuscleWiki fetch error:', error.message);
        return [];
    }
}

/**
 * Fetch exercises from Free Exercise DB (has images!)
 */
async function fetchFreeExerciseDb() {
    try {
        console.log('[ExerciseService] Fetching from Free Exercise DB...');
        const response = await axios.get(FREE_EXERCISE_DB, { timeout: 30000 });

        const exercises = response.data.map(ex => ({
            id: `fed_${ex.id}`,
            source: 'free_exercise_db',
            name: ex.name,
            category: ex.category?.toLowerCase() || 'strength',
            difficulty: mapDifficulty(ex.level),
            force: ex.force?.toLowerCase() || null,
            mechanic: ex.mechanic?.toLowerCase() || null,

            // Muscles
            primaryMuscles: ex.primaryMuscles?.map(m => MUSCLE_MAP[m.toLowerCase()] || m.toLowerCase()) || [],
            secondaryMuscles: ex.secondaryMuscles?.map(m => MUSCLE_MAP[m.toLowerCase()] || m.toLowerCase()) || [],

            // Instructions
            instructions: ex.instructions || [],

            // Images
            images: ex.images?.map(img => `${FREE_EXERCISE_IMAGES_BASE}${img}`) || [],

            // Equipment
            equipment: EQUIPMENT_MAP[ex.equipment?.toLowerCase()] || ex.equipment?.toLowerCase() || 'bodyweight',

            // Metadata
            hasImages: ex.images && ex.images.length > 0,
            hasVideo: false
        }));

        console.log(`[ExerciseService] Fetched ${exercises.length} exercises from Free Exercise DB`);
        return exercises;
    } catch (error) {
        console.error('[ExerciseService] Free Exercise DB fetch error:', error.message);
        return [];
    }
}

/**
 * Map difficulty strings to numbers
 */
function mapDifficulty(level) {
    if (!level) return 2;
    const lower = level.toLowerCase();
    if (lower === 'beginner') return 1;
    if (lower === 'intermediate') return 2;
    if (lower === 'advanced' || lower === 'expert') return 3;
    return 2;
}

/**
 * Merge exercises from both sources, prioritizing MuscleWiki (has videos)
 */
function mergeExercises(muscleWiki, freeExerciseDb) {
    const merged = new Map();

    // Add MuscleWiki exercises first (priority - has videos)
    muscleWiki.forEach(ex => {
        const key = ex.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        merged.set(key, ex);
    });

    // Add Free Exercise DB exercises (only if not already present)
    freeExerciseDb.forEach(ex => {
        const key = ex.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!merged.has(key)) {
            merged.set(key, ex);
        } else {
            // Merge images into MuscleWiki entry if available
            const existing = merged.get(key);
            if (ex.images && ex.images.length > 0 && (!existing.images || existing.images.length === 0)) {
                existing.images = ex.images;
                existing.hasImages = true;
            }
        }
    });

    return Array.from(merged.values());
}

/**
 * Refresh exercise cache
 */
async function refreshCache() {
    try {
        const [muscleWiki, freeExerciseDb] = await Promise.all([
            fetchMuscleWikiExercises(),
            fetchFreeExerciseDb()
        ]);

        exerciseCache.muscleWiki = muscleWiki;
        exerciseCache.freeExerciseDb = freeExerciseDb;
        exerciseCache.merged = mergeExercises(muscleWiki, freeExerciseDb);
        exerciseCache.lastFetch = Date.now();

        console.log(`[ExerciseService] Cache refreshed: ${exerciseCache.merged.length} total exercises`);
        console.log(`[ExerciseService] - MuscleWiki: ${muscleWiki.length} (with videos)`);
        console.log(`[ExerciseService] - Free Exercise DB: ${freeExerciseDb.length} (with images)`);

        return exerciseCache.merged;
    } catch (error) {
        console.error('[ExerciseService] Cache refresh error:', error);
        return exerciseCache.merged;
    }
}

/**
 * Get all exercises (with auto-refresh)
 */
async function getAllExercises() {
    if (!exerciseCache.lastFetch || Date.now() - exerciseCache.lastFetch > CACHE_DURATION) {
        await refreshCache();
    }
    return exerciseCache.merged;
}

/**
 * Search exercises
 */
async function searchExercises(query) {
    const exercises = await getAllExercises();
    const q = query.toLowerCase();

    return exercises.filter(ex =>
        ex.name.toLowerCase().includes(q) ||
        ex.primaryMuscles.some(m => m.includes(q)) ||
        ex.secondaryMuscles.some(m => m.includes(q)) ||
        ex.equipment?.includes(q) ||
        ex.category?.includes(q)
    );
}

/**
 * Get exercises by muscle group
 */
async function getByMuscle(muscle) {
    const exercises = await getAllExercises();
    const normalizedMuscle = MUSCLE_MAP[muscle.toLowerCase()] || muscle.toLowerCase();

    return exercises.filter(ex =>
        ex.primaryMuscles.includes(normalizedMuscle) ||
        ex.secondaryMuscles.includes(normalizedMuscle)
    );
}

/**
 * Get exercises by equipment
 */
async function getByEquipment(equipment) {
    const exercises = await getAllExercises();
    const normalizedEquipment = EQUIPMENT_MAP[equipment.toLowerCase()] || equipment.toLowerCase();

    return exercises.filter(ex => ex.equipment === normalizedEquipment);
}

/**
 * Get exercises with videos only
 */
async function getWithVideos() {
    const exercises = await getAllExercises();
    return exercises.filter(ex => ex.hasVideo);
}

/**
 * Get exercise by ID
 */
async function getById(id) {
    const exercises = await getAllExercises();
    return exercises.find(ex => ex.id === id);
}

/**
 * Get exercise count stats
 */
async function getStats() {
    const exercises = await getAllExercises();

    const withVideos = exercises.filter(ex => ex.hasVideo).length;
    const withImages = exercises.filter(ex => ex.hasImages).length;
    const withYoutube = exercises.filter(ex => ex.hasYoutube).length;

    // Count by muscle
    const byMuscle = {};
    exercises.forEach(ex => {
        ex.primaryMuscles.forEach(m => {
            byMuscle[m] = (byMuscle[m] || 0) + 1;
        });
    });

    // Count by equipment
    const byEquipment = {};
    exercises.forEach(ex => {
        byEquipment[ex.equipment] = (byEquipment[ex.equipment] || 0) + 1;
    });

    return {
        total: exercises.length,
        withVideos,
        withImages,
        withYoutube,
        byMuscle,
        byEquipment,
        lastUpdated: exerciseCache.lastFetch
    };
}

/**
 * Get all available muscle groups
 */
async function getMuscleGroups() {
    const exercises = await getAllExercises();
    const muscles = new Set();

    exercises.forEach(ex => {
        ex.primaryMuscles.forEach(m => muscles.add(m));
        ex.secondaryMuscles.forEach(m => muscles.add(m));
    });

    return Array.from(muscles).sort();
}

/**
 * Get all available equipment types
 */
async function getEquipmentTypes() {
    const exercises = await getAllExercises();
    const equipment = new Set();

    exercises.forEach(ex => {
        if (ex.equipment) equipment.add(ex.equipment);
    });

    return Array.from(equipment).sort();
}

// Initialize cache on module load
refreshCache().catch(console.error);

module.exports = {
    getAllExercises,
    searchExercises,
    getByMuscle,
    getByEquipment,
    getWithVideos,
    getById,
    getStats,
    getMuscleGroups,
    getEquipmentTypes,
    refreshCache
};
