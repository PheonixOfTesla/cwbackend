require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const seedData = async () => {
  try {
    // Connect to MongoDB
   const dbUrl = process.env.MONGODB_URI;
    console.log('🔗 Connecting to MongoDB:', dbUrl.replace(/mongodb\+srv:\/\/.*@/, 'mongodb://***@'));
    
    await mongoose.connect(dbUrl);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing users
    const deletedCount = await User.deleteMany();
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing users`);
    
    // Create users with different passwords
    const users = [
      {
        name: 'System Administrator',
        email: 'admin@coastalfitness.com',
        password: await bcrypt.hash('admin123', 10),
        roles: ['admin', 'owner'],
        isActive: true
      },
      {
        name: 'Admin User',
        email: 'admin@coastal.com',
        password: await bcrypt.hash('admin123', 10),
        roles: ['admin'],
        isActive: true
      },
      {
        name: 'Owner Account',
        email: 'owner@coastal.com',
        password: await bcrypt.hash('owner123', 10),
        roles: ['owner', 'admin'],
        isActive: true
      },
      {
        name: 'Dr. Sarah Mitchell',
        email: 'sarah.specialist@coastal.com',
        password: await bcrypt.hash('specialist123', 10),
        roles: ['specialist'],
        isActive: true
      },
      {
        name: 'John Anderson',
        email: 'john.client@example.com',
        password: await bcrypt.hash('password123', 10),
        roles: ['client'],
        isActive: true
      },
      {
        name: 'Jane Smith',
        email: 'jane.client@example.com',
        password: await bcrypt.hash('password123', 10),
        roles: ['client'],
        isActive: true
      },
      {
        name: 'Mike Johnson',
        email: 'mike.client@example.com',
        password: await bcrypt.hash('password123', 10),
        roles: ['client'],
        isActive: true
      },
      {
        name: 'Emily Davis',
        email: 'emily.specialist@coastal.com',
        password: await bcrypt.hash('specialist123', 10),
        roles: ['specialist'],
        isActive: true
      },
      {
        name: 'Test Engineer',
        email: 'engineer@coastal.com',
        password: await bcrypt.hash('engineer123', 10),
        roles: ['engineer', 'admin'],
        isActive: true
      }
    ];
    
    // Insert users
    const createdUsers = await User.insertMany(users);
    console.log(`✅ Created ${createdUsers.length} users`);
    
    // Display created users
    console.log('\n📋 USERS CREATED:');
    console.log('=====================================');
    for (const user of users) {
      const roles = user.roles.join(', ');
      const password = user.email.includes('admin@coastalfitness') ? 'admin123' :
                       user.email.includes('admin') ? 'admin123' :
                       user.email.includes('owner') ? 'owner123' :
                       user.email.includes('specialist') ? 'specialist123' :
                       user.email.includes('engineer') ? 'engineer123' :
                       'password123';
      console.log(`📧 ${user.email.padEnd(35)} | 🔐 ${password.padEnd(15)} | 👤 ${roles}`);
    }
    console.log('=====================================\n');
    
    // Test login with admin user
    console.log('🧪 Testing admin@coastalfitness.com login...');
    const testUser = await User.findOne({ email: 'admin@coastalfitness.com' }).select('+password');
    if (testUser) {
      const isValid = await bcrypt.compare('admin123', testUser.password);
      console.log(`✅ Password validation: ${isValid ? 'PASSED' : 'FAILED'}`);
    } else {
      console.log('❌ Admin user not found!');
    }
    
    console.log('\n🎉 Seed completed successfully!');
    console.log('You can now login with:');
    console.log('  Email: admin@coastalfitness.com');
    console.log('  Password: admin123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

// Run seeding
seedData();
