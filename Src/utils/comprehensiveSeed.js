// Src/utils/comprehensiveSeed.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Workout = require('../models/Workout');
const Measurement = require('../models/Measurement');
const Nutrition = require('../models/Nutrition');
const Goal = require('../models/Goal');
const Exercise = require('../models/Exercise');

const comprehensiveSeed = async () => {
  try {
    // Connect to MongoDB
    const dbUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/clockwork-fitness';
    console.log('🔗 Connecting to MongoDB...');
    
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Workout.deleteMany({}),
      Measurement.deleteMany({}),
      Nutrition.deleteMany({}),
      Goal.deleteMany({}),
      Exercise.deleteMany({})
    ]);
    console.log('✅ Data cleared');
    
    // ============================================
    // 1. CREATE USERS
    // ============================================
    console.log('👥 Creating users...');
    
    // ✅ FIXED: Pass plain passwords - User model will hash them
    const users = await User.create([
      {
        name: 'System Administrator',
        email: 'admin@clockwork.fit',
        password: 'admin123', // Plain password
        roles: ['admin', 'owner'],
        isActive: true
      },
      {
        name: 'Dr. Sarah Mitchell',
        email: 'sarah@clockwork.fit',
        password: 'specialist123', // Plain password
        roles: ['specialist'],
        isActive: true
      },
      {
        name: 'John Anderson',
        email: 'john@client.com',
        password: 'password123', // Plain password
        roles: ['client'],
        isActive: true
      },
      {
        name: 'Jane Smith',
        email: 'jane@client.com',
        password: 'password123', // Plain password
        roles: ['client'],
        isActive: true
      },
      {
        name: 'Mike Johnson',
        email: 'mike@client.com',
        password: 'password123', // Plain password
        roles: ['client'],
        isActive: true
      }
    ]);
    
    console.log(`✅ Created ${users.length} users`);
    
    const admin = users.find(u => u.email === 'admin@clockwork.fit');
    const specialist = users.find(u => u.email === 'sarah@clockwork.fit');
    const john = users.find(u => u.email === 'john@client.com');
    const jane = users.find(u => u.email === 'jane@client.com');
    const mike = users.find(u => u.email === 'mike@client.com');
    
    // ============================================
    // 2. CREATE EXERCISE LIBRARY
    // ============================================
    console.log('💪 Creating exercise library...');
    
    const exercises = await Exercise.create([
      {
        name: 'Bench Press',
        muscleCategory: 'Chest',
        secondaryMuscles: ['Shoulders', 'Triceps'],
        equipmentNeeded: 'barbell',
        difficulty: 'intermediate',
        description: 'Classic compound chest exercise',
        instructions: [
          'Lie flat on bench with feet on floor',
          'Grip bar slightly wider than shoulder width',
          'Lower bar to mid-chest with control',
          'Press bar up until arms fully extended'
        ],
        tips: [
          'Keep shoulder blades retracted',
          'Maintain slight arch in lower back',
          'Control the descent'
        ],
        createdBy: specialist._id,
        isPublic: true
      },
      {
        name: 'Squats',
        muscleCategory: 'Legs',
        secondaryMuscles: ['Core', 'Glutes'],
        equipmentNeeded: 'barbell',
        difficulty: 'intermediate',
        description: 'King of leg exercises',
        instructions: [
          'Stand with bar on upper back',
          'Feet shoulder-width apart',
          'Lower until thighs parallel to ground',
          'Drive through heels to stand'
        ],
        tips: [
          'Keep chest up throughout movement',
          'Knees track over toes',
          'Maintain neutral spine'
        ],
        createdBy: specialist._id,
        isPublic: true
      },
      {
        name: 'Deadlift',
        muscleCategory: 'Back',
        secondaryMuscles: ['Legs', 'Core'],
        equipmentNeeded: 'barbell',
        difficulty: 'advanced',
        description: 'Total body strength builder',
        instructions: [
          'Stand with feet hip-width apart',
          'Grip bar outside legs',
          'Keep back flat, lift with legs',
          'Stand fully upright at top'
        ],
        tips: [
          'Engage lats before lifting',
          'Keep bar close to body',
          'Lead with chest, not hips'
        ],
        createdBy: specialist._id,
        isPublic: true
      },
      {
        name: 'Pull-ups',
        muscleCategory: 'Back',
        secondaryMuscles: ['Biceps'],
        equipmentNeeded: 'bodyweight',
        difficulty: 'intermediate',
        description: 'Classic back and bicep builder',
        instructions: [
          'Hang from bar with overhand grip',
          'Pull body up until chin over bar',
          'Lower with control to start'
        ],
        tips: [
          'Engage core to prevent swinging',
          'Full range of motion',
          'Control the negative'
        ],
        createdBy: specialist._id,
        isPublic: true
      },
      {
        name: 'Overhead Press',
        muscleCategory: 'Shoulders',
        secondaryMuscles: ['Triceps', 'Core'],
        equipmentNeeded: 'barbell',
        difficulty: 'intermediate',
        description: 'Build strong shoulders',
        instructions: [
          'Stand with bar at shoulder height',
          'Press bar overhead',
          'Lock out arms at top',
          'Lower with control'
        ],
        tips: [
          'Keep core tight',
          'Bar path should be straight',
          'Full lockout at top'
        ],
        createdBy: specialist._id,
        isPublic: true
      }
    ]);
    
    console.log(`✅ Created ${exercises.length} exercises`);
    
    // ============================================
    // 3. CREATE SAMPLE WORKOUTS
    // ============================================
    console.log('🏋️ Creating sample workouts...');
    
    const workouts = await Workout.create([
      {
        name: 'Upper Body Strength',
        clientId: john._id,
        createdBy: specialist._id,
        assignedBy: specialist._id,
        scheduledDate: new Date(),
        exercises: [
          {
            name: 'Bench Press',
            sets: 4,
            reps: '8-10',
            weight: 135,
            notes: 'Focus on form',
            grouping: 'none'
          },
          {
            name: 'Overhead Press',
            sets: 3,
            reps: '10-12',
            weight: 95,
            notes: 'Keep core tight',
            grouping: 'none'
          },
          {
            name: 'Pull-ups',
            sets: 3,
            reps: '8-10',
            weight: 0,
            notes: 'Use assistance if needed',
            grouping: 'none'
          }
        ],
        completed: false
      },
      {
        name: 'Lower Body Power',
        clientId: john._id,
        createdBy: specialist._id,
        assignedBy: specialist._id,
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        exercises: [
          {
            name: 'Squats',
            sets: 4,
            reps: '6-8',
            weight: 185,
            notes: 'Go deep',
            grouping: 'none'
          },
          {
            name: 'Deadlift',
            sets: 3,
            reps: '5',
            weight: 225,
            notes: 'Perfect form',
            grouping: 'none'
          }
        ],
        completed: false
      },
      {
        name: 'Full Body Workout',
        clientId: jane._id,
        createdBy: specialist._id,
        assignedBy: specialist._id,
        scheduledDate: new Date(),
        exercises: [
          {
            name: 'Squats',
            sets: 3,
            reps: '10-12',
            weight: 95,
            grouping: 'none'
          },
          {
            name: 'Bench Press',
            sets: 3,
            reps: '10-12',
            weight: 65,
            grouping: 'none'
          },
          {
            name: 'Pull-ups',
            sets: 3,
            reps: '5-8',
            weight: 0,
            notes: 'Assisted',
            grouping: 'none'
          }
        ],
        completed: false
      }
    ]);
    
    console.log(`✅ Created ${workouts.length} workouts`);
    
    // ============================================
    // 4. CREATE SAMPLE MEASUREMENTS
    // ============================================
    console.log('📏 Creating sample measurements...');
    
    const measurements = await Measurement.create([
      {
        clientId: john._id,
        createdBy: specialist._id,
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        weight: 180,
        bodyFat: 18,
        bloodPressure: '120/80'
      },
      {
        clientId: john._id,
        createdBy: specialist._id,
        date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        weight: 178,
        bodyFat: 17.5,
        bloodPressure: '118/78'
      },
      {
        clientId: john._id,
        createdBy: specialist._id,
        date: new Date(),
        weight: 176,
        bodyFat: 17,
        bloodPressure: '116/76'
      },
      {
        clientId: jane._id,
        createdBy: specialist._id,
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        weight: 140,
        bodyFat: 22,
        bloodPressure: '110/70'
      },
      {
        clientId: jane._id,
        createdBy: specialist._id,
        date: new Date(),
        weight: 138,
        bodyFat: 21,
        bloodPressure: '108/68'
      }
    ]);
    
    console.log(`✅ Created ${measurements.length} measurements`);
    
    // ============================================
    // 5. CREATE SAMPLE NUTRITION PLANS
    // ============================================
    console.log('🥗 Creating sample nutrition plans...');
    
    const nutritionPlans = await Nutrition.create([
      {
        clientId: john._id,
        assignedBy: specialist._id,
        protein: { target: 180, current: 165 },
        carbs: { target: 250, current: 230 },
        fat: { target: 70, current: 65 },
        calories: { target: 2400, current: 2250 },
        mealPlan: {
          breakfast: 'Oatmeal with protein powder, berries, and almonds',
          lunch: 'Grilled chicken breast, brown rice, and vegetables',
          dinner: 'Salmon, sweet potato, and broccoli',
          snacks: 'Greek yogurt, protein shake, mixed nuts'
        }
      },
      {
        clientId: jane._id,
        assignedBy: specialist._id,
        protein: { target: 120, current: 110 },
        carbs: { target: 180, current: 170 },
        fat: { target: 50, current: 48 },
        calories: { target: 1800, current: 1750 },
        mealPlan: {
          breakfast: 'Scrambled eggs with avocado and whole wheat toast',
          lunch: 'Turkey wrap with vegetables',
          dinner: 'Lean beef stir-fry with quinoa',
          snacks: 'Apple with almond butter, protein bar'
        }
      }
    ]);
    
    console.log(`✅ Created ${nutritionPlans.length} nutrition plans`);
    
    // ============================================
    // 6. CREATE SAMPLE GOALS
    // ============================================
    console.log('🎯 Creating sample goals...');
    
    const goals = await Goal.create([
      {
        name: 'Lose 10 pounds',
        clientId: john._id,
        assignedBy: specialist._id,
        createdBy: specialist._id,
        target: 170,
        current: 176,
        startingValue: 180,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        isHabit: false
      },
      {
        name: 'Bench Press 200 lbs',
        clientId: john._id,
        assignedBy: specialist._id,
        createdBy: specialist._id,
        target: 200,
        current: 135,
        startingValue: 135,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        isHabit: false
      },
      {
        name: 'Drink 8 glasses of water daily',
        clientId: jane._id,
        assignedBy: specialist._id,
        createdBy: specialist._id,
        target: 1,
        current: 0,
        startingValue: 0,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isHabit: true,
        scheduledDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      },
      {
        name: 'Workout 4x per week',
        clientId: jane._id,
        assignedBy: specialist._id,
        createdBy: specialist._id,
        target: 1,
        current: 0,
        startingValue: 0,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isHabit: true,
        scheduledDays: ['Mon', 'Tue', 'Thu', 'Sat']
      }
    ]);
    
    console.log(`✅ Created ${goals.length} goals`);
    
    // ============================================
    // DISPLAY SUMMARY
    // ============================================
    console.log('\n═══════════════════════════════════════');
    console.log('📋 SEED COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════\n');
    
    console.log('👥 USERS CREATED:');
    console.log('─────────────────────────────────────');
    users.forEach(user => {
      const roles = user.roles.join(', ');
      const password = user.email.includes('admin') ? 'admin123' :
                       user.email.includes('sarah') ? 'specialist123' :
                       'password123';
      console.log(`📧 ${user.email.padEnd(30)} | 🔐 ${password.padEnd(15)} | 👤 ${roles}`);
    });
    
    console.log('\n📊 DATA SUMMARY:');
    console.log('─────────────────────────────────────');
    console.log(`Users: ${users.length}`);
    console.log(`Exercises: ${exercises.length}`);
    console.log(`Workouts: ${workouts.length}`);
    console.log(`Measurements: ${measurements.length}`);
    console.log(`Nutrition Plans: ${nutritionPlans.length}`);
    console.log(`Goals: ${goals.length}`);
    
    console.log('\n✅ You can now login with:');
    console.log('─────────────────────────────────────');
    console.log('Email: admin@clockwork.fit');
    console.log('Password: admin123');
    console.log('─────────────────────────────────────\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

// Run seeding
comprehensiveSeed();