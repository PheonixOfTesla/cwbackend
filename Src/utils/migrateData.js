// Script to migrate demo data to MongoDB
const mongoose = require('mongoose');
const User = require('../models/User');
const Measurement = require('../models/Measurement');
const Workout = require('../models/Workout');
const Goal = require('../models/Goal');
const Message = require('../models/Message');

const migrateData = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/coastal-fitness');
        
        console.log('Connected to MongoDB. Starting migration...');
        
        // Clear existing data (be careful in production!)
        await User.deleteMany({});
        await Measurement.deleteMany({});
        await Workout.deleteMany({});
        await Goal.deleteMany({});
        await Message.deleteMany({});
        
        // Create demo users
        const users = [
            {
                email: 'john.client@example.com',
                password: 'password123',
                name: 'John Anderson',
                roles: ['client'],
                specialistIds: []
            },
            {
                email: 'sarah.specialist@coastal.com',
                password: 'specialist123',
                name: 'Dr. Sarah Mitchell',
                roles: ['specialist'],
                clientIds: []
            }
        ];
        
        const createdUsers = await User.create(users);
        console.log('Users created:', createdUsers.length);
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateData();
