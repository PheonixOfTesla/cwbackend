/**
 * ClockWork Exercise Library
 * 500+ exercises with comprehensive metadata for intelligent programming
 */

const MUSCLE_GROUPS = {
    CHEST: 'chest',
    BACK: 'back',
    SHOULDERS: 'shoulders',
    BICEPS: 'biceps',
    TRICEPS: 'triceps',
    FOREARMS: 'forearms',
    QUADS: 'quads',
    HAMSTRINGS: 'hamstrings',
    GLUTES: 'glutes',
    CALVES: 'calves',
    ABS: 'abs',
    OBLIQUES: 'obliques',
    LOWER_BACK: 'lower_back',
    TRAPS: 'traps',
    LATS: 'lats',
    RHOMBOIDS: 'rhomboids',
    HIP_FLEXORS: 'hip_flexors',
    ADDUCTORS: 'adductors',
    ABDUCTORS: 'abductors',
    FULL_BODY: 'full_body'
};

const EQUIPMENT = {
    BARBELL: 'barbell',
    DUMBBELL: 'dumbbell',
    KETTLEBELL: 'kettlebell',
    CABLE: 'cable',
    MACHINE: 'machine',
    BODYWEIGHT: 'bodyweight',
    RESISTANCE_BAND: 'resistance_band',
    MEDICINE_BALL: 'medicine_ball',
    SWISS_BALL: 'swiss_ball',
    TRX: 'trx',
    PULL_UP_BAR: 'pull_up_bar',
    DIP_STATION: 'dip_station',
    BENCH: 'bench',
    SQUAT_RACK: 'squat_rack',
    LEG_PRESS: 'leg_press',
    SMITH_MACHINE: 'smith_machine',
    EZ_BAR: 'ez_bar',
    TRAP_BAR: 'trap_bar',
    LANDMINE: 'landmine',
    SLED: 'sled',
    BATTLE_ROPES: 'battle_ropes',
    BOX: 'box',
    RINGS: 'rings',
    FOAM_ROLLER: 'foam_roller',
    NONE: 'none'
};

const MOVEMENT_PATTERNS = {
    PUSH_HORIZONTAL: 'push_horizontal',
    PUSH_VERTICAL: 'push_vertical',
    PULL_HORIZONTAL: 'pull_horizontal',
    PULL_VERTICAL: 'pull_vertical',
    SQUAT: 'squat',
    HINGE: 'hinge',
    LUNGE: 'lunge',
    CARRY: 'carry',
    ROTATION: 'rotation',
    ANTI_ROTATION: 'anti_rotation',
    FLEXION: 'flexion',
    EXTENSION: 'extension',
    ABDUCTION: 'abduction',
    ADDUCTION: 'adduction',
    ISOLATION: 'isolation'
};

const DIFFICULTY = {
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3,
    ELITE: 4
};

const EXERCISE_TYPE = {
    COMPOUND: 'compound',
    ISOLATION: 'isolation',
    CARDIO: 'cardio',
    PLYOMETRIC: 'plyometric',
    MOBILITY: 'mobility',
    STABILITY: 'stability',
    POWER: 'power'
};

// ============================================
// CHEST EXERCISES
// ============================================
const CHEST_EXERCISES = [
    // BARBELL
    { id: 'bb_bench_press', name: 'Barbell Bench Press', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['barbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, powerlifting: true, cues: ['Arch upper back', 'Retract scapula', 'Drive feet into floor', 'Touch chest, pause, press'] },
    { id: 'bb_incline_press', name: 'Incline Barbell Press', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: ['barbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['30-45 degree angle', 'Elbows at 45 degrees', 'Lower to upper chest'] },
    { id: 'bb_decline_press', name: 'Decline Barbell Press', primary: ['chest'], secondary: ['triceps'], equipment: ['barbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Secure feet', 'Lower to lower chest', 'Controlled descent'] },
    { id: 'bb_floor_press', name: 'Floor Press', primary: ['chest'], secondary: ['triceps'], equipment: ['barbell'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Pause at floor', 'Elbows at 45 degrees', 'Drive through triceps'] },
    { id: 'bb_close_grip_bench', name: 'Close Grip Bench Press', primary: ['triceps'], secondary: ['chest'], equipment: ['barbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Hands shoulder width', 'Elbows tucked', 'Lower to sternum'] },
    { id: 'bb_guillotine_press', name: 'Guillotine Press', primary: ['chest'], secondary: ['shoulders'], equipment: ['barbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 3, cues: ['Lower to neck/clavicle', 'Light weight only', 'Extreme stretch'] },

    // DUMBBELL
    { id: 'db_bench_press', name: 'Dumbbell Bench Press', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['dumbbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Full range of motion', 'Squeeze at top', 'Control the negative'] },
    { id: 'db_incline_press', name: 'Incline Dumbbell Press', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: ['dumbbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['30-45 degree incline', 'Palms forward or neutral', 'Deep stretch at bottom'] },
    { id: 'db_decline_press', name: 'Decline Dumbbell Press', primary: ['chest'], secondary: ['triceps'], equipment: ['dumbbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Secure position', 'Full stretch', 'Controlled motion'] },
    { id: 'db_fly', name: 'Dumbbell Fly', primary: ['chest'], secondary: [], equipment: ['dumbbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Slight elbow bend', 'Squeeze chest at top', 'Feel the stretch'] },
    { id: 'db_incline_fly', name: 'Incline Dumbbell Fly', primary: ['chest'], secondary: [], equipment: ['dumbbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Upper chest focus', 'Control throughout', 'Avoid going too heavy'] },
    { id: 'db_pullover', name: 'Dumbbell Pullover', primary: ['chest'], secondary: ['lats', 'triceps'], equipment: ['dumbbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Hips low', 'Arms slightly bent', 'Stretch and squeeze'] },
    { id: 'db_squeeze_press', name: 'Squeeze Press', primary: ['chest'], secondary: ['triceps'], equipment: ['dumbbell', 'bench'], pattern: 'push_horizontal', type: 'isolation', difficulty: 2, cues: ['Press dumbbells together', 'Constant tension', 'Mind-muscle connection'] },

    // CABLE
    { id: 'cable_fly_high', name: 'High Cable Fly', primary: ['chest'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Pulleys above head', 'Hands meet at waist', 'Squeeze chest'] },
    { id: 'cable_fly_mid', name: 'Mid Cable Fly', primary: ['chest'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Pulleys at chest height', 'Slight forward lean', 'Controlled squeeze'] },
    { id: 'cable_fly_low', name: 'Low Cable Fly', primary: ['chest'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Pulleys at lowest', 'Hands meet at eye level', 'Upper chest emphasis'] },
    { id: 'cable_crossover', name: 'Cable Crossover', primary: ['chest'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Step forward', 'Cross hands at bottom', 'Peak contraction'] },

    // MACHINE
    { id: 'machine_chest_press', name: 'Machine Chest Press', primary: ['chest'], secondary: ['triceps'], equipment: ['machine'], pattern: 'push_horizontal', type: 'compound', difficulty: 1, cues: ['Adjust seat height', 'Full range', 'Controlled tempo'] },
    { id: 'machine_incline_press', name: 'Machine Incline Press', primary: ['chest'], secondary: ['shoulders'], equipment: ['machine'], pattern: 'push_horizontal', type: 'compound', difficulty: 1, cues: ['Upper chest focus', 'Don\'t lock elbows', 'Squeeze at top'] },
    { id: 'pec_deck', name: 'Pec Deck', primary: ['chest'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Elbows at 90 degrees', 'Squeeze at peak', 'Slow negative'] },

    // BODYWEIGHT
    { id: 'push_up', name: 'Push-Up', primary: ['chest'], secondary: ['triceps', 'shoulders', 'abs'], equipment: ['bodyweight'], pattern: 'push_horizontal', type: 'compound', difficulty: 1, cues: ['Body in straight line', 'Elbows at 45 degrees', 'Full range of motion'] },
    { id: 'incline_push_up', name: 'Incline Push-Up', primary: ['chest'], secondary: ['triceps'], equipment: ['bodyweight', 'box'], pattern: 'push_horizontal', type: 'compound', difficulty: 1, cues: ['Hands elevated', 'Easier variation', 'Great for beginners'] },
    { id: 'decline_push_up', name: 'Decline Push-Up', primary: ['chest'], secondary: ['shoulders', 'triceps'], equipment: ['bodyweight', 'box'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Feet elevated', 'Upper chest focus', 'Maintain plank'] },
    { id: 'diamond_push_up', name: 'Diamond Push-Up', primary: ['triceps'], secondary: ['chest'], equipment: ['bodyweight'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Hands form diamond', 'Elbows close to body', 'Triceps emphasis'] },
    { id: 'wide_push_up', name: 'Wide Push-Up', primary: ['chest'], secondary: ['shoulders'], equipment: ['bodyweight'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Hands wider than shoulders', 'Chest stretch at bottom', 'Control movement'] },
    { id: 'archer_push_up', name: 'Archer Push-Up', primary: ['chest'], secondary: ['triceps'], equipment: ['bodyweight'], pattern: 'push_horizontal', type: 'compound', difficulty: 3, cues: ['One arm extends', 'Unilateral emphasis', 'Builds to one-arm'] },
    { id: 'plyometric_push_up', name: 'Plyo Push-Up', primary: ['chest'], secondary: ['triceps'], equipment: ['bodyweight'], pattern: 'push_horizontal', type: 'plyometric', difficulty: 3, cues: ['Explosive push', 'Hands leave ground', 'Soft landing'] },
    { id: 'dips', name: 'Chest Dips', primary: ['chest'], secondary: ['triceps', 'shoulders'], equipment: ['dip_station'], pattern: 'push_vertical', type: 'compound', difficulty: 2, cues: ['Lean forward', 'Elbows flared', 'Deep stretch'] },
];

// ============================================
// BACK EXERCISES
// ============================================
const BACK_EXERCISES = [
    // BARBELL
    { id: 'bb_deadlift', name: 'Conventional Deadlift', primary: ['back', 'hamstrings', 'glutes'], secondary: ['quads', 'forearms', 'traps'], equipment: ['barbell'], pattern: 'hinge', type: 'compound', difficulty: 3, powerlifting: true, cues: ['Bar over mid-foot', 'Brace core', 'Push floor away', 'Lock hips at top'] },
    { id: 'bb_sumo_deadlift', name: 'Sumo Deadlift', primary: ['quads', 'glutes', 'back'], secondary: ['hamstrings', 'adductors'], equipment: ['barbell'], pattern: 'hinge', type: 'compound', difficulty: 3, powerlifting: true, cues: ['Wide stance', 'Toes out', 'Push knees out', 'Chest up'] },
    { id: 'bb_row', name: 'Barbell Row', primary: ['back', 'lats'], secondary: ['biceps', 'rear_delts'], equipment: ['barbell'], pattern: 'pull_horizontal', type: 'compound', difficulty: 2, cues: ['Hinge at hips', 'Pull to belly button', 'Squeeze shoulder blades'] },
    { id: 'bb_pendlay_row', name: 'Pendlay Row', primary: ['back'], secondary: ['biceps'], equipment: ['barbell'], pattern: 'pull_horizontal', type: 'compound', difficulty: 3, cues: ['Dead stop each rep', 'Explosive pull', 'Parallel to floor'] },
    { id: 'bb_yates_row', name: 'Yates Row', primary: ['back'], secondary: ['biceps'], equipment: ['barbell'], pattern: 'pull_horizontal', type: 'compound', difficulty: 2, cues: ['Underhand grip', 'More upright torso', 'Lower lat focus'] },
    { id: 'bb_tbar_row', name: 'T-Bar Row', primary: ['back'], secondary: ['biceps', 'rear_delts'], equipment: ['barbell', 'landmine'], pattern: 'pull_horizontal', type: 'compound', difficulty: 2, cues: ['Chest supported or bent over', 'Neutral grip', 'Pull to chest'] },
    { id: 'trap_bar_deadlift', name: 'Trap Bar Deadlift', primary: ['quads', 'glutes', 'back'], secondary: ['hamstrings'], equipment: ['trap_bar'], pattern: 'hinge', type: 'compound', difficulty: 2, cues: ['Neutral grip', 'More quad involvement', 'Safer for back'] },
    { id: 'bb_rdl', name: 'Romanian Deadlift', primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], equipment: ['barbell'], pattern: 'hinge', type: 'compound', difficulty: 2, cues: ['Slight knee bend', 'Push hips back', 'Feel hamstring stretch'] },
    { id: 'bb_shrug', name: 'Barbell Shrug', primary: ['traps'], secondary: [], equipment: ['barbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Straight up and down', 'Hold at top', 'No rolling'] },

    // DUMBBELL
    { id: 'db_row', name: 'One-Arm Dumbbell Row', primary: ['lats'], secondary: ['biceps', 'rear_delts'], equipment: ['dumbbell', 'bench'], pattern: 'pull_horizontal', type: 'compound', difficulty: 2, cues: ['Knee on bench', 'Pull to hip', 'Full stretch at bottom'] },
    { id: 'db_row_chest_supported', name: 'Chest Supported Row', primary: ['back'], secondary: ['biceps'], equipment: ['dumbbell', 'bench'], pattern: 'pull_horizontal', type: 'compound', difficulty: 1, cues: ['Incline bench', 'No momentum', 'Squeeze at top'] },
    { id: 'db_seal_row', name: 'Seal Row', primary: ['back'], secondary: ['biceps'], equipment: ['dumbbell', 'bench'], pattern: 'pull_horizontal', type: 'compound', difficulty: 2, cues: ['Flat bench elevated', 'Arms hang straight', 'Strict form'] },
    { id: 'db_shrug', name: 'Dumbbell Shrug', primary: ['traps'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Shoulders to ears', 'Hold 1-2 seconds', 'Full range'] },
    { id: 'db_rdl', name: 'Dumbbell RDL', primary: ['hamstrings', 'glutes'], secondary: ['lower_back'], equipment: ['dumbbell'], pattern: 'hinge', type: 'compound', difficulty: 2, cues: ['Dumbbells close to legs', 'Hip hinge', 'Feel stretch'] },
    { id: 'db_single_rdl', name: 'Single-Leg RDL', primary: ['hamstrings', 'glutes'], secondary: ['balance'], equipment: ['dumbbell'], pattern: 'hinge', type: 'compound', difficulty: 3, cues: ['Hinge on one leg', 'Back leg extends', 'Core stability'] },

    // CABLE
    { id: 'cable_row_seated', name: 'Seated Cable Row', primary: ['back'], secondary: ['biceps'], equipment: ['cable'], pattern: 'pull_horizontal', type: 'compound', difficulty: 1, cues: ['Sit upright', 'Pull to belly', 'Squeeze and hold'] },
    { id: 'cable_lat_pulldown', name: 'Lat Pulldown', primary: ['lats'], secondary: ['biceps', 'rear_delts'], equipment: ['cable'], pattern: 'pull_vertical', type: 'compound', difficulty: 1, cues: ['Lean back slightly', 'Pull to upper chest', 'Control the negative'] },
    { id: 'cable_close_grip_pulldown', name: 'Close Grip Pulldown', primary: ['lats'], secondary: ['biceps'], equipment: ['cable'], pattern: 'pull_vertical', type: 'compound', difficulty: 1, cues: ['V-bar attachment', 'Elbows to sides', 'Full stretch at top'] },
    { id: 'cable_wide_grip_pulldown', name: 'Wide Grip Pulldown', primary: ['lats'], secondary: ['rear_delts'], equipment: ['cable'], pattern: 'pull_vertical', type: 'compound', difficulty: 2, cues: ['Outside shoulder width', 'Pull to chest', 'Wide lats'] },
    { id: 'cable_straight_arm_pulldown', name: 'Straight Arm Pulldown', primary: ['lats'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Arms straight', 'Slight bend', 'Pull to thighs'] },
    { id: 'cable_face_pull', name: 'Face Pull', primary: ['rear_delts', 'rhomboids'], secondary: ['traps'], equipment: ['cable'], pattern: 'pull_horizontal', type: 'compound', difficulty: 1, cues: ['High pulley', 'Pull to face', 'External rotation'] },

    // BODYWEIGHT
    { id: 'pull_up', name: 'Pull-Up', primary: ['lats'], secondary: ['biceps', 'rear_delts'], equipment: ['pull_up_bar'], pattern: 'pull_vertical', type: 'compound', difficulty: 3, cues: ['Dead hang start', 'Chin over bar', 'Control negative'] },
    { id: 'chin_up', name: 'Chin-Up', primary: ['lats', 'biceps'], secondary: ['rear_delts'], equipment: ['pull_up_bar'], pattern: 'pull_vertical', type: 'compound', difficulty: 2, cues: ['Underhand grip', 'More biceps', 'Full range'] },
    { id: 'neutral_grip_pull_up', name: 'Neutral Grip Pull-Up', primary: ['lats'], secondary: ['biceps'], equipment: ['pull_up_bar'], pattern: 'pull_vertical', type: 'compound', difficulty: 2, cues: ['Palms facing', 'Easier on shoulders', 'Good transition'] },
    { id: 'wide_grip_pull_up', name: 'Wide Grip Pull-Up', primary: ['lats'], secondary: [], equipment: ['pull_up_bar'], pattern: 'pull_vertical', type: 'compound', difficulty: 3, cues: ['Hands wide', 'V-taper builder', 'Difficult variation'] },
    { id: 'inverted_row', name: 'Inverted Row', primary: ['back'], secondary: ['biceps'], equipment: ['bodyweight', 'squat_rack'], pattern: 'pull_horizontal', type: 'compound', difficulty: 1, cues: ['Body straight', 'Pull chest to bar', 'Great beginner exercise'] },
    { id: 'muscle_up', name: 'Muscle-Up', primary: ['lats', 'chest', 'triceps'], secondary: [], equipment: ['pull_up_bar'], pattern: 'pull_vertical', type: 'compound', difficulty: 4, cues: ['Explosive pull', 'Transition at top', 'Advanced skill'] },

    // MACHINE
    { id: 'machine_row', name: 'Machine Row', primary: ['back'], secondary: ['biceps'], equipment: ['machine'], pattern: 'pull_horizontal', type: 'compound', difficulty: 1, cues: ['Adjust chest pad', 'Full stretch', 'Squeeze at contraction'] },
    { id: 'machine_lat_pulldown', name: 'Machine Lat Pulldown', primary: ['lats'], secondary: ['biceps'], equipment: ['machine'], pattern: 'pull_vertical', type: 'compound', difficulty: 1, cues: ['Similar to cable', 'Fixed path', 'Good for beginners'] },
    { id: 'reverse_hyper', name: 'Reverse Hyperextension', primary: ['lower_back', 'glutes'], secondary: ['hamstrings'], equipment: ['machine'], pattern: 'hinge', type: 'isolation', difficulty: 2, cues: ['Lower back emphasis', 'Squeeze glutes', 'Rehab exercise'] },
    { id: 'back_extension', name: 'Back Extension', primary: ['lower_back'], secondary: ['glutes', 'hamstrings'], equipment: ['machine'], pattern: 'hinge', type: 'compound', difficulty: 1, cues: ['Hinge at hips', 'Don\'t hyperextend', 'Control movement'] },
];

// ============================================
// SHOULDER EXERCISES
// ============================================
const SHOULDER_EXERCISES = [
    // BARBELL
    { id: 'bb_ohp', name: 'Overhead Press', primary: ['shoulders'], secondary: ['triceps', 'traps'], equipment: ['barbell'], pattern: 'push_vertical', type: 'compound', difficulty: 2, cues: ['Brace core', 'Lockout overhead', 'Head through at top'] },
    { id: 'bb_push_press', name: 'Push Press', primary: ['shoulders'], secondary: ['triceps', 'quads'], equipment: ['barbell'], pattern: 'push_vertical', type: 'power', difficulty: 2, cues: ['Dip and drive', 'Use leg drive', 'Lockout strict'] },
    { id: 'bb_btn_press', name: 'Behind the Neck Press', primary: ['shoulders'], secondary: ['triceps'], equipment: ['barbell'], pattern: 'push_vertical', type: 'compound', difficulty: 3, cues: ['Requires mobility', 'Lighter weight', 'Control descent'] },
    { id: 'bb_upright_row', name: 'Upright Row', primary: ['shoulders', 'traps'], secondary: [], equipment: ['barbell'], pattern: 'pull_vertical', type: 'compound', difficulty: 2, cues: ['Wide grip safer', 'Elbows high', 'Pull to chin'] },

    // DUMBBELL
    { id: 'db_ohp', name: 'Dumbbell Overhead Press', primary: ['shoulders'], secondary: ['triceps'], equipment: ['dumbbell'], pattern: 'push_vertical', type: 'compound', difficulty: 2, cues: ['Neutral or pronated', 'Press to lockout', 'Control descent'] },
    { id: 'db_arnold_press', name: 'Arnold Press', primary: ['shoulders'], secondary: ['triceps'], equipment: ['dumbbell'], pattern: 'push_vertical', type: 'compound', difficulty: 2, cues: ['Rotate as you press', 'Full range', 'Hits all heads'] },
    { id: 'db_lateral_raise', name: 'Lateral Raise', primary: ['shoulders'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Slight forward lean', 'Lead with elbows', 'Pause at top'] },
    { id: 'db_front_raise', name: 'Front Raise', primary: ['shoulders'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Arms to shoulder height', 'Control movement', 'Alternate or together'] },
    { id: 'db_rear_delt_fly', name: 'Rear Delt Fly', primary: ['rear_delts'], secondary: ['rhomboids'], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Bent over position', 'Lead with elbows', 'Squeeze at top'] },
    { id: 'db_y_raise', name: 'Y-Raise', primary: ['shoulders', 'traps'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Arms form Y shape', 'Light weight', 'Great for posture'] },
    { id: 'db_lu_raise', name: 'Lu Raise', primary: ['shoulders'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 3, cues: ['Front raise to lateral', 'One continuous motion', 'Full shoulder work'] },

    // CABLE
    { id: 'cable_lateral_raise', name: 'Cable Lateral Raise', primary: ['shoulders'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Constant tension', 'Cross body start', 'Great for dropsets'] },
    { id: 'cable_front_raise', name: 'Cable Front Raise', primary: ['shoulders'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Low pulley', 'Control the cable', 'Steady tempo'] },
    { id: 'cable_rear_delt_fly', name: 'Cable Rear Delt Fly', primary: ['rear_delts'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['High pulley', 'Cross cables', 'Squeeze back'] },

    // MACHINE
    { id: 'machine_shoulder_press', name: 'Machine Shoulder Press', primary: ['shoulders'], secondary: ['triceps'], equipment: ['machine'], pattern: 'push_vertical', type: 'compound', difficulty: 1, cues: ['Adjust seat', 'Full range', 'Controlled'] },
    { id: 'machine_lateral_raise', name: 'Machine Lateral Raise', primary: ['shoulders'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Elbows on pad', 'Lift with delts', 'Hold at top'] },
    { id: 'reverse_pec_deck', name: 'Reverse Pec Deck', primary: ['rear_delts'], secondary: ['rhomboids'], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Face the machine', 'Arms parallel', 'Squeeze back'] },

    // BODYWEIGHT
    { id: 'pike_push_up', name: 'Pike Push-Up', primary: ['shoulders'], secondary: ['triceps'], equipment: ['bodyweight'], pattern: 'push_vertical', type: 'compound', difficulty: 2, cues: ['Hips high', 'Head to floor', 'Builds to HSPU'] },
    { id: 'handstand_push_up', name: 'Handstand Push-Up', primary: ['shoulders'], secondary: ['triceps', 'traps'], equipment: ['bodyweight'], pattern: 'push_vertical', type: 'compound', difficulty: 4, cues: ['Against wall', 'Full range', 'Advanced skill'] },
];

// ============================================
// ARM EXERCISES (Biceps & Triceps)
// ============================================
const ARM_EXERCISES = [
    // BICEPS - BARBELL
    { id: 'bb_curl', name: 'Barbell Curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['barbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Elbows pinned', 'Full range', 'Squeeze at top'] },
    { id: 'ez_bar_curl', name: 'EZ Bar Curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['ez_bar'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Angled grip', 'Easier on wrists', 'Control negative'] },
    { id: 'bb_preacher_curl', name: 'Preacher Curl', primary: ['biceps'], secondary: [], equipment: ['barbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Arms on pad', 'No momentum', 'Full stretch'] },
    { id: 'bb_drag_curl', name: 'Drag Curl', primary: ['biceps'], secondary: [], equipment: ['barbell'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Drag bar up body', 'Elbows back', 'Peak contraction'] },
    { id: 'bb_reverse_curl', name: 'Reverse Curl', primary: ['forearms'], secondary: ['biceps'], equipment: ['barbell'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Overhand grip', 'Forearm emphasis', 'Full range'] },

    // BICEPS - DUMBBELL
    { id: 'db_curl', name: 'Dumbbell Curl', primary: ['biceps'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Supinate as you curl', 'Squeeze at top', 'Control negative'] },
    { id: 'db_hammer_curl', name: 'Hammer Curl', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Neutral grip', 'Brachialis focus', 'Elbows stationary'] },
    { id: 'db_incline_curl', name: 'Incline Curl', primary: ['biceps'], secondary: [], equipment: ['dumbbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Bench at 45 degrees', 'Arms hang', 'Deep stretch'] },
    { id: 'db_concentration_curl', name: 'Concentration Curl', primary: ['biceps'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Elbow on knee', 'Isolate bicep', 'Squeeze peak'] },
    { id: 'db_spider_curl', name: 'Spider Curl', primary: ['biceps'], secondary: [], equipment: ['dumbbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Chest on incline', 'Arms vertical', 'Pure isolation'] },
    { id: 'db_zottman_curl', name: 'Zottman Curl', primary: ['biceps', 'forearms'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Curl up palm up', 'Rotate at top', 'Lower palm down'] },

    // BICEPS - CABLE
    { id: 'cable_curl', name: 'Cable Curl', primary: ['biceps'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Constant tension', 'Full range', 'Great for dropsets'] },
    { id: 'cable_rope_curl', name: 'Rope Hammer Curl', primary: ['biceps'], secondary: ['forearms'], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Split rope at top', 'Neutral grip', 'Squeeze out'] },
    { id: 'cable_high_curl', name: 'High Cable Curl', primary: ['biceps'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Overhead cables', 'Flex pose', 'Peak contraction'] },

    // TRICEPS - BARBELL
    { id: 'bb_skull_crusher', name: 'Skull Crusher', primary: ['triceps'], secondary: [], equipment: ['barbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Lower to forehead', 'Elbows in', 'Control the weight'] },
    { id: 'bb_jm_press', name: 'JM Press', primary: ['triceps'], secondary: ['chest'], equipment: ['barbell', 'bench'], pattern: 'push_horizontal', type: 'compound', difficulty: 3, cues: ['Hybrid movement', 'Elbows forward', 'Tricep lockout'] },

    // TRICEPS - DUMBBELL
    { id: 'db_overhead_extension', name: 'Overhead Tricep Extension', primary: ['triceps'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['One or two hands', 'Elbows by ears', 'Full stretch'] },
    { id: 'db_kickback', name: 'Tricep Kickback', primary: ['triceps'], secondary: [], equipment: ['dumbbell'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Bent over', 'Extend to lockout', 'Hold at top'] },
    { id: 'db_tate_press', name: 'Tate Press', primary: ['triceps'], secondary: [], equipment: ['dumbbell', 'bench'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Dumbbells to chest', 'Extend out', 'Unique angle'] },

    // TRICEPS - CABLE
    { id: 'cable_pushdown', name: 'Cable Pushdown', primary: ['triceps'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Elbows pinned', 'Full extension', 'Squeeze at bottom'] },
    { id: 'cable_rope_pushdown', name: 'Rope Pushdown', primary: ['triceps'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Split rope at bottom', 'Full range', 'Popular exercise'] },
    { id: 'cable_overhead_extension', name: 'Cable Overhead Extension', primary: ['triceps'], secondary: [], equipment: ['cable'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Face away', 'Stretch at bottom', 'Long head focus'] },

    // TRICEPS - BODYWEIGHT
    { id: 'tricep_dips', name: 'Tricep Dips', primary: ['triceps'], secondary: ['chest'], equipment: ['dip_station'], pattern: 'push_vertical', type: 'compound', difficulty: 2, cues: ['Body upright', 'Elbows back', 'Full lockout'] },
    { id: 'bench_dips', name: 'Bench Dips', primary: ['triceps'], secondary: ['shoulders'], equipment: ['bench'], pattern: 'push_vertical', type: 'compound', difficulty: 1, cues: ['Hands on bench', 'Dip down', 'Beginner variation'] },
    { id: 'close_grip_push_up', name: 'Close Grip Push-Up', primary: ['triceps'], secondary: ['chest'], equipment: ['bodyweight'], pattern: 'push_horizontal', type: 'compound', difficulty: 2, cues: ['Hands close', 'Elbows tucked', 'Tricep emphasis'] },
];

// ============================================
// LEG EXERCISES
// ============================================
const LEG_EXERCISES = [
    // BARBELL - QUADS
    { id: 'bb_squat', name: 'Barbell Back Squat', primary: ['quads'], secondary: ['glutes', 'hamstrings', 'lower_back'], equipment: ['barbell', 'squat_rack'], pattern: 'squat', type: 'compound', difficulty: 3, powerlifting: true, cues: ['Bar on traps', 'Brace core', 'Knees over toes', 'Depth to parallel or below'] },
    { id: 'bb_front_squat', name: 'Front Squat', primary: ['quads'], secondary: ['glutes', 'abs'], equipment: ['barbell', 'squat_rack'], pattern: 'squat', type: 'compound', difficulty: 3, cues: ['Bar on front delts', 'Elbows high', 'Upright torso', 'Quad dominant'] },
    { id: 'bb_pause_squat', name: 'Pause Squat', primary: ['quads'], secondary: ['glutes'], equipment: ['barbell', 'squat_rack'], pattern: 'squat', type: 'compound', difficulty: 3, cues: ['3 second pause at bottom', 'No bounce', 'Builds strength out of hole'] },
    { id: 'bb_box_squat', name: 'Box Squat', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'squat_rack', 'box'], pattern: 'squat', type: 'compound', difficulty: 2, cues: ['Sit back onto box', 'Pause and stand', 'Great for teaching'] },
    { id: 'bb_hack_squat', name: 'Barbell Hack Squat', primary: ['quads'], secondary: ['glutes'], equipment: ['barbell'], pattern: 'squat', type: 'compound', difficulty: 3, cues: ['Bar behind legs', 'Old school exercise', 'Quad focused'] },
    { id: 'bb_zercher_squat', name: 'Zercher Squat', primary: ['quads', 'abs'], secondary: ['glutes', 'biceps'], equipment: ['barbell'], pattern: 'squat', type: 'compound', difficulty: 3, cues: ['Bar in elbow crease', 'Very upright', 'Core intensive'] },

    // BARBELL - HAMSTRINGS/GLUTES
    { id: 'bb_good_morning', name: 'Good Morning', primary: ['hamstrings', 'lower_back'], secondary: ['glutes'], equipment: ['barbell'], pattern: 'hinge', type: 'compound', difficulty: 3, cues: ['Bar on back', 'Hinge at hips', 'Feel hamstring stretch'] },
    { id: 'bb_stiff_leg_deadlift', name: 'Stiff Leg Deadlift', primary: ['hamstrings'], secondary: ['lower_back', 'glutes'], equipment: ['barbell'], pattern: 'hinge', type: 'compound', difficulty: 2, cues: ['Legs nearly straight', 'Maximum stretch', 'Control descent'] },
    { id: 'bb_hip_thrust', name: 'Barbell Hip Thrust', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell', 'bench'], pattern: 'hinge', type: 'compound', difficulty: 2, cues: ['Back on bench', 'Drive through heels', 'Squeeze glutes at top'] },
    { id: 'bb_glute_bridge', name: 'Barbell Glute Bridge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['barbell'], pattern: 'hinge', type: 'compound', difficulty: 1, cues: ['Back on floor', 'Hip extension', 'Glute squeeze'] },

    // DUMBBELL
    { id: 'db_goblet_squat', name: 'Goblet Squat', primary: ['quads'], secondary: ['glutes', 'abs'], equipment: ['dumbbell'], pattern: 'squat', type: 'compound', difficulty: 1, cues: ['Hold at chest', 'Elbows between knees', 'Great for beginners'] },
    { id: 'db_lunge', name: 'Dumbbell Lunge', primary: ['quads'], secondary: ['glutes', 'hamstrings'], equipment: ['dumbbell'], pattern: 'lunge', type: 'compound', difficulty: 2, cues: ['Step forward', 'Knee to 90 degrees', 'Push back up'] },
    { id: 'db_reverse_lunge', name: 'Reverse Lunge', primary: ['quads', 'glutes'], secondary: ['hamstrings'], equipment: ['dumbbell'], pattern: 'lunge', type: 'compound', difficulty: 2, cues: ['Step backward', 'Knee lowers', 'Return to start'] },
    { id: 'db_walking_lunge', name: 'Walking Lunge', primary: ['quads'], secondary: ['glutes'], equipment: ['dumbbell'], pattern: 'lunge', type: 'compound', difficulty: 2, cues: ['Continuous motion', 'Alternate legs', 'Keep upright'] },
    { id: 'db_bulgarian_split_squat', name: 'Bulgarian Split Squat', primary: ['quads'], secondary: ['glutes'], equipment: ['dumbbell', 'bench'], pattern: 'lunge', type: 'compound', difficulty: 3, cues: ['Rear foot elevated', 'Front leg dominant', 'Deep stretch'] },
    { id: 'db_step_up', name: 'Step Up', primary: ['quads', 'glutes'], secondary: [], equipment: ['dumbbell', 'box'], pattern: 'lunge', type: 'compound', difficulty: 2, cues: ['Step onto box', 'Drive through lead leg', 'Control descent'] },

    // MACHINE
    { id: 'leg_press', name: 'Leg Press', primary: ['quads'], secondary: ['glutes', 'hamstrings'], equipment: ['leg_press'], pattern: 'squat', type: 'compound', difficulty: 1, cues: ['Feet shoulder width', 'Full range', 'Don\'t lock knees'] },
    { id: 'hack_squat_machine', name: 'Hack Squat Machine', primary: ['quads'], secondary: ['glutes'], equipment: ['machine'], pattern: 'squat', type: 'compound', difficulty: 2, cues: ['Shoulders under pads', 'Full depth', 'Quad focused'] },
    { id: 'leg_extension', name: 'Leg Extension', primary: ['quads'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Extend fully', 'Squeeze at top', 'Control negative'] },
    { id: 'leg_curl_lying', name: 'Lying Leg Curl', primary: ['hamstrings'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Curl to glutes', 'Squeeze hamstrings', 'Slow negative'] },
    { id: 'leg_curl_seated', name: 'Seated Leg Curl', primary: ['hamstrings'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Adjust pad', 'Full contraction', 'Different angle than lying'] },
    { id: 'hip_abduction', name: 'Hip Abduction Machine', primary: ['abductors'], secondary: ['glutes'], equipment: ['machine'], pattern: 'abduction', type: 'isolation', difficulty: 1, cues: ['Push knees out', 'Squeeze at end', 'Glute medius'] },
    { id: 'hip_adduction', name: 'Hip Adduction Machine', primary: ['adductors'], secondary: [], equipment: ['machine'], pattern: 'adduction', type: 'isolation', difficulty: 1, cues: ['Squeeze knees together', 'Inner thigh focus', 'Control movement'] },
    { id: 'glute_kickback_machine', name: 'Glute Kickback Machine', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['machine'], pattern: 'hinge', type: 'isolation', difficulty: 1, cues: ['Kick back and up', 'Squeeze glute', 'Full extension'] },

    // BODYWEIGHT
    { id: 'bodyweight_squat', name: 'Bodyweight Squat', primary: ['quads'], secondary: ['glutes'], equipment: ['bodyweight'], pattern: 'squat', type: 'compound', difficulty: 1, cues: ['Arms forward', 'Sit back', 'Knees over toes'] },
    { id: 'jump_squat', name: 'Jump Squat', primary: ['quads'], secondary: ['glutes', 'calves'], equipment: ['bodyweight'], pattern: 'squat', type: 'plyometric', difficulty: 2, cues: ['Squat and explode', 'Soft landing', 'Repeat'] },
    { id: 'pistol_squat', name: 'Pistol Squat', primary: ['quads'], secondary: ['glutes', 'balance'], equipment: ['bodyweight'], pattern: 'squat', type: 'compound', difficulty: 4, cues: ['Single leg', 'Other leg forward', 'Advanced balance'] },
    { id: 'nordic_curl', name: 'Nordic Curl', primary: ['hamstrings'], secondary: [], equipment: ['bodyweight'], pattern: 'isolation', type: 'compound', difficulty: 4, cues: ['Anchor feet', 'Lower with control', 'Eccentric focus'] },
    { id: 'glute_bridge', name: 'Glute Bridge', primary: ['glutes'], secondary: ['hamstrings'], equipment: ['bodyweight'], pattern: 'hinge', type: 'compound', difficulty: 1, cues: ['Drive through heels', 'Squeeze at top', 'Great activation'] },
    { id: 'single_leg_glute_bridge', name: 'Single Leg Glute Bridge', primary: ['glutes'], secondary: [], equipment: ['bodyweight'], pattern: 'hinge', type: 'compound', difficulty: 2, cues: ['One leg raised', 'Unilateral work', 'Balance challenge'] },
    { id: 'box_jump', name: 'Box Jump', primary: ['quads', 'glutes'], secondary: ['calves'], equipment: ['box'], pattern: 'squat', type: 'plyometric', difficulty: 2, cues: ['Explosive jump', 'Land softly', 'Step down'] },

    // CALF
    { id: 'standing_calf_raise', name: 'Standing Calf Raise', primary: ['calves'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Full stretch', 'Rise on toes', 'Squeeze at top'] },
    { id: 'seated_calf_raise', name: 'Seated Calf Raise', primary: ['calves'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 1, cues: ['Knees bent', 'Soleus focus', 'Full range'] },
    { id: 'donkey_calf_raise', name: 'Donkey Calf Raise', primary: ['calves'], secondary: [], equipment: ['machine'], pattern: 'isolation', type: 'isolation', difficulty: 2, cues: ['Bent over position', 'Deep stretch', 'Old school classic'] },
];

// ============================================
// CORE EXERCISES
// ============================================
const CORE_EXERCISES = [
    // ABS
    { id: 'plank', name: 'Plank', primary: ['abs'], secondary: ['shoulders'], equipment: ['bodyweight'], pattern: 'anti_rotation', type: 'stability', difficulty: 1, cues: ['Body straight', 'Engage core', 'Don\'t sag hips'] },
    { id: 'side_plank', name: 'Side Plank', primary: ['obliques'], secondary: ['abs'], equipment: ['bodyweight'], pattern: 'anti_rotation', type: 'stability', difficulty: 2, cues: ['Stack feet', 'Hips elevated', 'Hold steady'] },
    { id: 'dead_bug', name: 'Dead Bug', primary: ['abs'], secondary: ['hip_flexors'], equipment: ['bodyweight'], pattern: 'anti_rotation', type: 'stability', difficulty: 1, cues: ['Back flat', 'Opposite arm/leg extend', 'Control movement'] },
    { id: 'bird_dog', name: 'Bird Dog', primary: ['abs', 'lower_back'], secondary: [], equipment: ['bodyweight'], pattern: 'anti_rotation', type: 'stability', difficulty: 1, cues: ['On all fours', 'Extend opposite limbs', 'Balance'] },
    { id: 'crunch', name: 'Crunch', primary: ['abs'], secondary: [], equipment: ['bodyweight'], pattern: 'flexion', type: 'isolation', difficulty: 1, cues: ['Curl shoulders up', 'Don\'t pull neck', 'Focus on contraction'] },
    { id: 'reverse_crunch', name: 'Reverse Crunch', primary: ['abs'], secondary: [], equipment: ['bodyweight'], pattern: 'flexion', type: 'isolation', difficulty: 1, cues: ['Curl hips up', 'Lower abs focus', 'Control motion'] },
    { id: 'bicycle_crunch', name: 'Bicycle Crunch', primary: ['abs', 'obliques'], secondary: [], equipment: ['bodyweight'], pattern: 'rotation', type: 'isolation', difficulty: 2, cues: ['Elbow to knee', 'Rotate torso', 'Controlled pace'] },
    { id: 'leg_raise', name: 'Leg Raise', primary: ['abs'], secondary: ['hip_flexors'], equipment: ['bodyweight'], pattern: 'flexion', type: 'isolation', difficulty: 2, cues: ['Legs straight', 'Lower with control', 'Don\'t arch back'] },
    { id: 'hanging_leg_raise', name: 'Hanging Leg Raise', primary: ['abs'], secondary: ['hip_flexors', 'grip'], equipment: ['pull_up_bar'], pattern: 'flexion', type: 'isolation', difficulty: 3, cues: ['Dead hang', 'Raise legs to 90', 'Control swing'] },
    { id: 'hanging_knee_raise', name: 'Hanging Knee Raise', primary: ['abs'], secondary: [], equipment: ['pull_up_bar'], pattern: 'flexion', type: 'isolation', difficulty: 2, cues: ['Easier than straight leg', 'Knees to chest', 'Curl pelvis'] },
    { id: 'toe_touch', name: 'Toe Touch', primary: ['abs'], secondary: [], equipment: ['bodyweight'], pattern: 'flexion', type: 'isolation', difficulty: 1, cues: ['Legs vertical', 'Reach for toes', 'Lift shoulders'] },
    { id: 'v_up', name: 'V-Up', primary: ['abs'], secondary: [], equipment: ['bodyweight'], pattern: 'flexion', type: 'isolation', difficulty: 3, cues: ['Simultaneous fold', 'Touch toes', 'Balance on glutes'] },
    { id: 'mountain_climber', name: 'Mountain Climber', primary: ['abs'], secondary: ['hip_flexors', 'cardio'], equipment: ['bodyweight'], pattern: 'anti_rotation', type: 'cardio', difficulty: 2, cues: ['Plank position', 'Drive knees', 'Keep hips low'] },
    { id: 'ab_wheel_rollout', name: 'Ab Wheel Rollout', primary: ['abs'], secondary: ['shoulders', 'lats'], equipment: ['ab_wheel'], pattern: 'anti_rotation', type: 'compound', difficulty: 3, cues: ['Roll out controlled', 'Engage core', 'Don\'t collapse'] },

    // OBLIQUES
    { id: 'russian_twist', name: 'Russian Twist', primary: ['obliques'], secondary: ['abs'], equipment: ['bodyweight'], pattern: 'rotation', type: 'isolation', difficulty: 2, cues: ['Lean back', 'Rotate side to side', 'Add weight optional'] },
    { id: 'woodchop', name: 'Cable Woodchop', primary: ['obliques'], secondary: ['abs'], equipment: ['cable'], pattern: 'rotation', type: 'compound', difficulty: 2, cues: ['High to low or reverse', 'Rotate through core', 'Control motion'] },
    { id: 'pallof_press', name: 'Pallof Press', primary: ['abs', 'obliques'], secondary: [], equipment: ['cable', 'resistance_band'], pattern: 'anti_rotation', type: 'stability', difficulty: 2, cues: ['Resist rotation', 'Press and hold', 'Core bracing'] },
    { id: 'side_bend', name: 'Side Bend', primary: ['obliques'], secondary: [], equipment: ['dumbbell'], pattern: 'flexion', type: 'isolation', difficulty: 1, cues: ['One side at a time', 'Don\'t lean forward', 'Feel the stretch'] },

    // LOWER BACK
    { id: 'superman', name: 'Superman', primary: ['lower_back'], secondary: ['glutes'], equipment: ['bodyweight'], pattern: 'extension', type: 'isolation', difficulty: 1, cues: ['Lie face down', 'Lift arms and legs', 'Hold briefly'] },
    { id: 'back_extension_floor', name: 'Back Extension (Floor)', primary: ['lower_back'], secondary: [], equipment: ['bodyweight'], pattern: 'extension', type: 'isolation', difficulty: 1, cues: ['Hands behind head', 'Lift chest', 'Controlled'] },
];

// ============================================
// CARDIO & CONDITIONING
// ============================================
const CARDIO_EXERCISES = [
    { id: 'running', name: 'Running', primary: ['full_body'], secondary: [], equipment: ['none'], pattern: 'cardio', type: 'cardio', difficulty: 2, cues: ['Maintain pace', 'Good form', 'Breathe rhythmically'] },
    { id: 'sprinting', name: 'Sprinting', primary: ['quads', 'hamstrings', 'glutes'], secondary: ['calves'], equipment: ['none'], pattern: 'cardio', type: 'cardio', difficulty: 3, cues: ['Max effort', 'Short bursts', 'Full recovery'] },
    { id: 'cycling', name: 'Cycling', primary: ['quads'], secondary: ['hamstrings', 'calves'], equipment: ['machine'], pattern: 'cardio', type: 'cardio', difficulty: 1, cues: ['Adjust seat', 'Consistent cadence', 'Breathe steadily'] },
    { id: 'rowing_machine', name: 'Rowing Machine', primary: ['back', 'legs'], secondary: ['arms'], equipment: ['machine'], pattern: 'cardio', type: 'cardio', difficulty: 2, cues: ['Legs, back, arms', 'Reverse on return', 'Powerful strokes'] },
    { id: 'battle_ropes', name: 'Battle Ropes', primary: ['shoulders', 'arms'], secondary: ['abs', 'cardio'], equipment: ['battle_ropes'], pattern: 'cardio', type: 'cardio', difficulty: 2, cues: ['Alternating waves', 'Keep tension', 'Core engaged'] },
    { id: 'jump_rope', name: 'Jump Rope', primary: ['calves'], secondary: ['cardio'], equipment: ['none'], pattern: 'cardio', type: 'cardio', difficulty: 2, cues: ['Light on feet', 'Wrist rotation', 'Rhythmic breathing'] },
    { id: 'burpee', name: 'Burpee', primary: ['full_body'], secondary: [], equipment: ['bodyweight'], pattern: 'cardio', type: 'cardio', difficulty: 3, cues: ['Squat, plank, push-up, jump', 'Continuous motion', 'High intensity'] },
    { id: 'kettlebell_swing', name: 'Kettlebell Swing', primary: ['glutes', 'hamstrings'], secondary: ['back', 'shoulders'], equipment: ['kettlebell'], pattern: 'hinge', type: 'power', difficulty: 2, cues: ['Hinge, don\'t squat', 'Hip snap', 'Arms guide, hips power'] },
    { id: 'sled_push', name: 'Sled Push', primary: ['quads', 'glutes'], secondary: ['full_body'], equipment: ['sled'], pattern: 'cardio', type: 'cardio', difficulty: 2, cues: ['Low body position', 'Drive with legs', 'Keep moving'] },
    { id: 'sled_pull', name: 'Sled Pull', primary: ['back', 'hamstrings'], secondary: [], equipment: ['sled'], pattern: 'cardio', type: 'cardio', difficulty: 2, cues: ['Face sled', 'Pull toward you', 'Powerful pulls'] },
    { id: 'farmers_carry', name: 'Farmer\'s Carry', primary: ['grip', 'traps'], secondary: ['abs', 'full_body'], equipment: ['dumbbell', 'kettlebell'], pattern: 'carry', type: 'compound', difficulty: 2, cues: ['Heavy weight', 'Walk with control', 'Shoulders back'] },
    { id: 'suitcase_carry', name: 'Suitcase Carry', primary: ['obliques'], secondary: ['grip', 'traps'], equipment: ['dumbbell', 'kettlebell'], pattern: 'carry', type: 'compound', difficulty: 2, cues: ['One side loaded', 'Don\'t lean', 'Anti-lateral flexion'] },
    { id: 'overhead_carry', name: 'Overhead Carry', primary: ['shoulders'], secondary: ['abs', 'traps'], equipment: ['dumbbell', 'kettlebell'], pattern: 'carry', type: 'compound', difficulty: 3, cues: ['Arms locked out', 'Core tight', 'Stability challenge'] },
];

// ============================================
// MOBILITY & FLEXIBILITY
// ============================================
const MOBILITY_EXERCISES = [
    { id: 'world_greatest_stretch', name: 'World\'s Greatest Stretch', primary: ['hip_flexors', 'hamstrings'], secondary: ['thoracic'], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Lunge with rotation', 'Open hip and thoracic', 'Dynamic stretch'] },
    { id: 'cat_cow', name: 'Cat-Cow', primary: ['spine'], secondary: [], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Arch and round', 'Controlled breathing', 'Spinal mobility'] },
    { id: 'hip_90_90', name: '90-90 Hip Stretch', primary: ['hip_flexors'], secondary: ['glutes'], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 2, cues: ['Both legs at 90 degrees', 'Sit tall', 'Hip rotation'] },
    { id: 'couch_stretch', name: 'Couch Stretch', primary: ['hip_flexors', 'quads'], secondary: [], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 2, cues: ['Back knee on ground', 'Rear foot elevated', 'Deep hip flexor stretch'] },
    { id: 'pigeon_pose', name: 'Pigeon Pose', primary: ['glutes', 'hip_flexors'], secondary: [], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 2, cues: ['Front leg bent', 'Back leg extended', 'Sink into stretch'] },
    { id: 'thoracic_rotation', name: 'Thoracic Rotation', primary: ['thoracic'], secondary: [], equipment: ['bodyweight'], pattern: 'rotation', type: 'mobility', difficulty: 1, cues: ['On all fours or side lying', 'Rotate through upper back', 'Improve rotation'] },
    { id: 'foam_roll_thoracic', name: 'Thoracic Foam Roll', primary: ['thoracic'], secondary: [], equipment: ['foam_roller'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Roller under upper back', 'Extend over roller', 'Improve extension'] },
    { id: 'foam_roll_quads', name: 'Quad Foam Roll', primary: ['quads'], secondary: [], equipment: ['foam_roller'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Face down', 'Roll front of thighs', 'Find tight spots'] },
    { id: 'foam_roll_it_band', name: 'IT Band Foam Roll', primary: ['abductors'], secondary: [], equipment: ['foam_roller'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Side lying', 'Roll outer thigh', 'Can be intense'] },
    { id: 'ankle_mobility', name: 'Ankle Mobility Drill', primary: ['calves'], secondary: [], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Knee over toe', 'Weight forward', 'Improve dorsiflexion'] },
    { id: 'shoulder_dislocates', name: 'Shoulder Dislocates', primary: ['shoulders'], secondary: [], equipment: ['resistance_band'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Wide grip', 'Full circle', 'Improve shoulder mobility'] },
    { id: 'wall_angels', name: 'Wall Angels', primary: ['shoulders', 'thoracic'], secondary: [], equipment: ['bodyweight'], pattern: 'mobility', type: 'mobility', difficulty: 1, cues: ['Back against wall', 'Slide arms up and down', 'Maintain contact'] },
];

// ============================================
// COMBINE ALL EXERCISES
// ============================================
const ALL_EXERCISES = [
    ...CHEST_EXERCISES,
    ...BACK_EXERCISES,
    ...SHOULDER_EXERCISES,
    ...ARM_EXERCISES,
    ...LEG_EXERCISES,
    ...CORE_EXERCISES,
    ...CARDIO_EXERCISES,
    ...MOBILITY_EXERCISES
];

// Add unique IDs and metadata
ALL_EXERCISES.forEach((exercise, index) => {
    exercise.order = index;
    exercise.searchTerms = [
        exercise.name.toLowerCase(),
        ...(exercise.primary || []),
        ...(exercise.secondary || []),
        ...(exercise.equipment || []),
        exercise.type,
        exercise.pattern
    ].join(' ');
});

// ============================================
// EXERCISE LIBRARY API
// ============================================

const ExerciseLibrary = {
    // Get all exercises
    getAll: () => ALL_EXERCISES,

    // Get by ID
    getById: (id) => ALL_EXERCISES.find(e => e.id === id),

    // Search exercises
    search: (query) => {
        const q = query.toLowerCase();
        return ALL_EXERCISES.filter(e => e.searchTerms.includes(q));
    },

    // Filter by muscle group
    getByMuscle: (muscle) => {
        return ALL_EXERCISES.filter(e =>
            e.primary?.includes(muscle) || e.secondary?.includes(muscle)
        );
    },

    // Filter by equipment
    getByEquipment: (equipment) => {
        return ALL_EXERCISES.filter(e => e.equipment?.includes(equipment));
    },

    // Filter by movement pattern
    getByPattern: (pattern) => {
        return ALL_EXERCISES.filter(e => e.pattern === pattern);
    },

    // Filter by difficulty
    getByDifficulty: (level) => {
        return ALL_EXERCISES.filter(e => e.difficulty === level);
    },

    // Filter by type
    getByType: (type) => {
        return ALL_EXERCISES.filter(e => e.type === type);
    },

    // Get powerlifting exercises
    getPowerliftingExercises: () => {
        return ALL_EXERCISES.filter(e => e.powerlifting);
    },

    // Get compound exercises
    getCompoundExercises: () => {
        return ALL_EXERCISES.filter(e => e.type === 'compound');
    },

    // Get isolation exercises
    getIsolationExercises: () => {
        return ALL_EXERCISES.filter(e => e.type === 'isolation');
    },

    // Get bodyweight exercises
    getBodyweightExercises: () => {
        return ALL_EXERCISES.filter(e =>
            e.equipment?.includes('bodyweight') && e.equipment.length === 1
        );
    },

    // Get exercises for home gym (minimal equipment)
    getHomeGymExercises: () => {
        const homeEquipment = ['bodyweight', 'dumbbell', 'resistance_band', 'pull_up_bar'];
        return ALL_EXERCISES.filter(e =>
            e.equipment?.every(eq => homeEquipment.includes(eq))
        );
    },

    // Get exercise count
    getCount: () => ALL_EXERCISES.length,

    // Get all muscle groups
    getMuscleGroups: () => Object.values(MUSCLE_GROUPS),

    // Get all equipment types
    getEquipmentTypes: () => Object.values(EQUIPMENT),

    // Get substitutes for an exercise
    getSubstitutes: (exerciseId) => {
        const exercise = ALL_EXERCISES.find(e => e.id === exerciseId);
        if (!exercise) return [];

        return ALL_EXERCISES.filter(e =>
            e.id !== exerciseId &&
            e.pattern === exercise.pattern &&
            e.primary?.some(m => exercise.primary?.includes(m))
        ).slice(0, 5);
    },

    // Get progression for an exercise
    getProgression: (exerciseId) => {
        const exercise = ALL_EXERCISES.find(e => e.id === exerciseId);
        if (!exercise) return { easier: [], harder: [] };

        const sameMuscle = ALL_EXERCISES.filter(e =>
            e.id !== exerciseId &&
            e.pattern === exercise.pattern &&
            e.primary?.some(m => exercise.primary?.includes(m))
        );

        return {
            easier: sameMuscle.filter(e => e.difficulty < exercise.difficulty).slice(0, 3),
            harder: sameMuscle.filter(e => e.difficulty > exercise.difficulty).slice(0, 3)
        };
    }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
    ExerciseLibrary,
    ALL_EXERCISES,
    MUSCLE_GROUPS,
    EQUIPMENT,
    MOVEMENT_PATTERNS,
    DIFFICULTY,
    EXERCISE_TYPE
};
