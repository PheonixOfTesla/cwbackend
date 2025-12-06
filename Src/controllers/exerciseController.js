const Exercise = require('../models/Exercise');
const { ExerciseLibrary, MUSCLE_GROUPS, EQUIPMENT, MOVEMENT_PATTERNS } = require('../data/exerciseLibrary');
const exerciseService = require('../services/exerciseService');

// ============================================
// VIDEO EXERCISE LIBRARY (MuscleWiki + Free Exercise DB)
// ============================================

// Get all video exercises
exports.getVideoLibrary = async (req, res) => {
    try {
        const { muscle, equipment, difficulty, hasVideo, limit = 50, offset = 0 } = req.query;
        let exercises = await exerciseService.getAllExercises();

        // Apply filters
        if (muscle) {
            exercises = exercises.filter(ex =>
                ex.primaryMuscles?.includes(muscle.toLowerCase()) ||
                ex.secondaryMuscles?.includes(muscle.toLowerCase())
            );
        }

        if (equipment) {
            exercises = exercises.filter(ex => ex.equipment === equipment.toLowerCase());
        }

        if (difficulty) {
            exercises = exercises.filter(ex => ex.difficulty === parseInt(difficulty));
        }

        if (hasVideo === 'true') {
            exercises = exercises.filter(ex => ex.hasVideo);
        }

        // Pagination
        const total = exercises.length;
        const paginated = exercises.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json({
            success: true,
            total,
            count: paginated.length,
            offset: parseInt(offset),
            limit: parseInt(limit),
            exercises: paginated
        });
    } catch (error) {
        console.error('Get video library error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Search video exercises
exports.searchVideoLibrary = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ success: false, message: 'Search query required' });
        }

        const results = await exerciseService.searchExercises(q);
        res.json({
            success: true,
            query: q,
            count: results.length,
            exercises: results
        });
    } catch (error) {
        console.error('Search video library error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get video exercises by muscle
exports.getVideoByMuscle = async (req, res) => {
    try {
        const { muscle } = req.params;
        const exercises = await exerciseService.getByMuscle(muscle);

        res.json({
            success: true,
            muscle,
            count: exercises.length,
            exercises
        });
    } catch (error) {
        console.error('Get video by muscle error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get video exercises by equipment
exports.getVideoByEquipment = async (req, res) => {
    try {
        const { equipment } = req.params;
        const exercises = await exerciseService.getByEquipment(equipment);

        res.json({
            success: true,
            equipment,
            count: exercises.length,
            exercises
        });
    } catch (error) {
        console.error('Get video by equipment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get only exercises with videos
exports.getExercisesWithVideos = async (req, res) => {
    try {
        const exercises = await exerciseService.getWithVideos();
        res.json({
            success: true,
            count: exercises.length,
            exercises
        });
    } catch (error) {
        console.error('Get exercises with videos error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single video exercise by ID
exports.getVideoExerciseById = async (req, res) => {
    try {
        const { id } = req.params;
        const exercise = await exerciseService.getById(id);

        if (!exercise) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found'
            });
        }

        res.json({
            success: true,
            exercise
        });
    } catch (error) {
        console.error('Get video exercise by ID error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get video library stats
exports.getVideoLibraryStats = async (req, res) => {
    try {
        const stats = await exerciseService.getStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get video library stats error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get available muscle groups from video library
exports.getVideoMuscleGroups = async (req, res) => {
    try {
        const muscleGroups = await exerciseService.getMuscleGroups();
        res.json({
            success: true,
            muscleGroups
        });
    } catch (error) {
        console.error('Get video muscle groups error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get available equipment from video library
exports.getVideoEquipment = async (req, res) => {
    try {
        const equipment = await exerciseService.getEquipmentTypes();
        res.json({
            success: true,
            equipment
        });
    } catch (error) {
        console.error('Get video equipment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Refresh video library cache
exports.refreshVideoLibrary = async (req, res) => {
    try {
        await exerciseService.refreshCache();
        const stats = await exerciseService.getStats();
        res.json({
            success: true,
            message: 'Video library cache refreshed',
            stats
        });
    } catch (error) {
        console.error('Refresh video library error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get exercise variations and why it's recommended
exports.getExerciseVariations = async (req, res) => {
    try {
        const { id } = req.params;
        const exercise = await exerciseService.getById(id);

        if (!exercise) {
            return res.status(404).json({ success: false, message: 'Exercise not found' });
        }

        // Get all exercises to find variations
        const allExercises = await exerciseService.getAllExercises();

        // Find variations: same primary muscle, different name
        const primaryMuscle = exercise.primaryMuscles?.[0]?.toLowerCase();
        const variations = allExercises
            .filter(ex =>
                ex.id !== exercise.id &&
                ex.primaryMuscles?.some(m => m.toLowerCase() === primaryMuscle)
            )
            .slice(0, 6)
            .map(ex => ({
                id: ex.id,
                name: ex.name,
                equipment: ex.equipment,
                difficulty: ex.difficulty,
                hasVideo: ex.hasVideo,
                difficultyLabel: ex.equipment === exercise.equipment ? 'same' :
                    (ex.equipment === 'bodyweight' ? 'easier' : 'harder')
            }));

        // Generate personalized "why it's recommended" based on user goal
        const userGoal = req.user?.primaryGoal?.type || 'general-health';
        const recommendations = {
            'build-strength': {
                reason: `${exercise.name} is excellent for building raw strength. The ${exercise.equipment || 'compound'} movement allows for progressive overload - the key to getting stronger.`,
                tip: 'Focus on 3-5 reps with heavy weight. Rest 3-5 minutes between sets.'
            },
            'build-muscle': {
                reason: `${exercise.name} targets your ${primaryMuscle || 'muscles'} effectively for hypertrophy. The full range of motion maximizes muscle fiber recruitment.`,
                tip: 'Aim for 8-12 reps with controlled tempo. Mind-muscle connection is key.'
            },
            'lose-fat': {
                reason: `${exercise.name} is a ${exercise.equipment === 'bodyweight' ? 'bodyweight' : 'resistance'} exercise that burns calories while preserving muscle mass during your cut.`,
                tip: 'Keep rest periods short (30-60s) and superset with another exercise.'
            },
            'improve-endurance': {
                reason: `${exercise.name} can be performed for higher reps to build muscular endurance in your ${primaryMuscle || 'target muscles'}.`,
                tip: 'Try 15-20 reps with lighter weight, or circuit-style training.'
            },
            'general-health': {
                reason: `${exercise.name} is a fundamental movement that improves overall fitness and functional strength.`,
                tip: 'Focus on proper form first. 10-15 reps is a good starting point.'
            }
        };

        const recommendation = recommendations[userGoal] || recommendations['general-health'];

        res.json({
            success: true,
            exercise: {
                id: exercise.id,
                name: exercise.name,
                primaryMuscles: exercise.primaryMuscles,
                equipment: exercise.equipment
            },
            whyRecommended: recommendation,
            variations
        });
    } catch (error) {
        console.error('Get exercise variations error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// STATIC EXERCISE LIBRARY (500+ exercises)
// ============================================

// Get all exercises from library
exports.getLibrary = async (req, res) => {
    try {
        const { muscle, equipment, pattern, difficulty, type, search, limit = 50, offset = 0 } = req.query;

        let exercises = ExerciseLibrary.getAll();

        // Apply filters
        if (muscle) {
            exercises = exercises.filter(e =>
                e.primary?.includes(muscle) || e.secondary?.includes(muscle)
            );
        }

        if (equipment) {
            exercises = exercises.filter(e => e.equipment?.includes(equipment));
        }

        if (pattern) {
            exercises = exercises.filter(e => e.pattern === pattern);
        }

        if (difficulty) {
            exercises = exercises.filter(e => e.difficulty === parseInt(difficulty));
        }

        if (type) {
            exercises = exercises.filter(e => e.type === type);
        }

        if (search) {
            const q = search.toLowerCase();
            exercises = exercises.filter(e =>
                e.name.toLowerCase().includes(q) ||
                e.searchTerms.includes(q)
            );
        }

        // Pagination
        const total = exercises.length;
        exercises = exercises.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        res.json({
            success: true,
            total,
            count: exercises.length,
            offset: parseInt(offset),
            limit: parseInt(limit),
            exercises
        });
    } catch (error) {
        console.error('Get library error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single exercise by ID from library
exports.getLibraryExercise = async (req, res) => {
    try {
        const { id } = req.params;
        const exercise = ExerciseLibrary.getById(id);

        if (!exercise) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found in library'
            });
        }

        // Get substitutes and progressions
        const substitutes = ExerciseLibrary.getSubstitutes(id);
        const progression = ExerciseLibrary.getProgression(id);

        res.json({
            success: true,
            exercise,
            substitutes,
            progression
        });
    } catch (error) {
        console.error('Get library exercise error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Search exercises
exports.searchLibrary = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query required'
            });
        }

        const results = ExerciseLibrary.search(q);
        res.json({
            success: true,
            query: q,
            count: results.length,
            exercises: results
        });
    } catch (error) {
        console.error('Search library error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get exercises by muscle group
exports.getByMuscle = async (req, res) => {
    try {
        const { muscle } = req.params;
        const exercises = ExerciseLibrary.getByMuscle(muscle);

        res.json({
            success: true,
            muscle,
            count: exercises.length,
            exercises
        });
    } catch (error) {
        console.error('Get by muscle error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get exercises by equipment
exports.getByEquipment = async (req, res) => {
    try {
        const { equipment } = req.params;
        const exercises = ExerciseLibrary.getByEquipment(equipment);

        res.json({
            success: true,
            equipment,
            count: exercises.length,
            exercises
        });
    } catch (error) {
        console.error('Get by equipment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get compound exercises
exports.getCompound = async (req, res) => {
    try {
        const exercises = ExerciseLibrary.getCompoundExercises();
        res.json({
            success: true,
            type: 'compound',
            count: exercises.length,
            exercises
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get powerlifting exercises
exports.getPowerlifting = async (req, res) => {
    try {
        const exercises = ExerciseLibrary.getPowerliftingExercises();
        res.json({
            success: true,
            type: 'powerlifting',
            count: exercises.length,
            exercises
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get bodyweight exercises
exports.getBodyweight = async (req, res) => {
    try {
        const exercises = ExerciseLibrary.getBodyweightExercises();
        res.json({
            success: true,
            type: 'bodyweight',
            count: exercises.length,
            exercises
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get home gym exercises
exports.getHomeGym = async (req, res) => {
    try {
        const exercises = ExerciseLibrary.getHomeGymExercises();
        res.json({
            success: true,
            type: 'home_gym',
            count: exercises.length,
            exercises
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get library metadata
exports.getLibraryMeta = async (req, res) => {
    try {
        res.json({
            success: true,
            totalExercises: ExerciseLibrary.getCount(),
            muscleGroups: ExerciseLibrary.getMuscleGroups(),
            equipmentTypes: ExerciseLibrary.getEquipmentTypes(),
            movementPatterns: Object.values(MOVEMENT_PATTERNS),
            difficultyLevels: [1, 2, 3, 4],
            exerciseTypes: ['compound', 'isolation', 'cardio', 'plyometric', 'mobility', 'stability', 'power']
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get exercise substitutes
exports.getSubstitutes = async (req, res) => {
    try {
        const { id } = req.params;
        const substitutes = ExerciseLibrary.getSubstitutes(id);

        res.json({
            success: true,
            originalId: id,
            count: substitutes.length,
            substitutes
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================
// USER CUSTOM EXERCISES (Database)
// ============================================

// Get all exercises with optional filters (from database)
exports.getExercises = async (req, res) => {
    try {
        const { search, category, equipment, difficulty } = req.query;
        let query = {};

        if (search) {
            query.$text = { $search: search };
        }
        if (category && category !== 'all') {
            query.muscleCategory = category;
        }
        if (equipment && equipment !== 'all') {
            query.equipmentNeeded = equipment;
        }
        if (difficulty && difficulty !== 'all') {
            query.difficulty = difficulty;
        }

        const exercises = await Exercise.find(query).sort('name');
        res.json(exercises);
    } catch (error) {
        console.error('Get exercises error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get single exercise by ID
exports.getExerciseById = async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id);

        if (!exercise) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found'
            });
        }

        res.json(exercise);
    } catch (error) {
        console.error('Get exercise by ID error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Create new exercise
exports.createExercise = async (req, res) => {
    try {
        const exercise = await Exercise.create({
            ...req.body,
            createdBy: req.user._id
        });

        res.status(201).json(exercise);
    } catch (error) {
        console.error('Create exercise error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update exercise
exports.updateExercise = async (req, res) => {
    try {
        const exercise = await Exercise.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!exercise) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found'
            });
        }

        res.json(exercise);
    } catch (error) {
        console.error('Update exercise error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete exercise
exports.deleteExercise = async (req, res) => {
    try {
        const exercise = await Exercise.findByIdAndDelete(req.params.id);

        if (!exercise) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found'
            });
        }

        res.json({
            success: true,
            message: 'Exercise deleted successfully'
        });
    } catch (error) {
        console.error('Delete exercise error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get related exercises by muscle group
exports.getRelatedExercises = async (req, res) => {
    try {
        const exercise = await Exercise.findById(req.params.id);

        if (!exercise) {
            return res.status(404).json({
                success: false,
                message: 'Exercise not found'
            });
        }

        const related = await Exercise.find({
            _id: { $ne: exercise._id },
            $or: [
                { muscleCategory: exercise.muscleCategory },
                { secondaryMuscles: { $in: [exercise.muscleCategory] } }
            ]
        }).limit(6);

        res.json(related);
    } catch (error) {
        console.error('Get related exercises error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
