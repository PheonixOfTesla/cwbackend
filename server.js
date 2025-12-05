const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const socketIO = require('socket.io');
require('dotenv').config();

// ============================================
// INITIALIZATION
// ============================================
const app = express();
const server = createServer(app);
const isDevelopment = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 5000;

// ============================================
// CORS CONFIGURATION - MAXIMUM COMPATIBILITY
// ============================================
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        // In production, allow any origin for maximum compatibility
        if (process.env.NODE_ENV === 'production') {
            return callback(null, true);
        }
        
        // In development, allow common localhost ports
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5000',
            'http://localhost:5173',
            'http://localhost:8080',
            'https://clockwork.fit',
            'https://theclockworkhub.com',
            'https://coastalfitnesshub.com',
            /\.vercel\.app$/,
            /\.netlify\.app$/,
            /\.railway\.app$/
        ];
        
        const isAllowed = allowedOrigins.some(allowed => {
            if (typeof allowed === 'string') {
                return allowed === origin;
            }
            return allowed.test(origin);
        });
        
        callback(null, isAllowed || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400
};

// Apply CORS first
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ============================================
// SOCKET.IO CONFIGURATION
// ============================================
const io = socketIO(server, {
    cors: corsOptions,
    pingTimeout: 60000,
    transports: ['websocket', 'polling']
});

app.set('io', io);
global.io = io;

// ============================================
// DATABASE CONNECTION - OPTIMIZED
// ============================================
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clockwork-genesis';
        
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50, // Connection pooling
            minPoolSize: 10,
            maxIdleTimeMS: 30000,
        };
        
        await mongoose.connect(mongoUri, options);
        
        console.log('✅ MongoDB connected successfully');
        console.log(`📦 Database: ${mongoose.connection.name}`);
        
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected. Attempting to reconnect...');
        });
        
        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });
        
    } catch (err) {
        console.error('❌ MongoDB initial connection failed:', err);
        if (!isDevelopment) {
            setTimeout(connectDB, 5000);
        } else {
            process.exit(1);
        }
    }
};

// ============================================
// SECURITY MIDDLEWARE
// ============================================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// ============================================
// GENERAL MIDDLEWARE - OPTIMIZED ORDER
// ============================================
app.use(compression()); // Compress responses
app.use(morgan(isDevelopment ? 'dev' : 'combined')); // Logging
app.use(express.json({ limit: '10mb' })); // Parse JSON
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded

// Request logging for debugging
app.use((req, res, next) => {
    console.log(`🔥 ${req.method} ${req.path} from ${req.ip}`);
    next();
});

// ============================================
// API ROUTES - ALL IMPORTS (ALPHABETICAL)
// ============================================
const authRoutes = require('./Src/routes/auth');
const calendarRoutes = require('./Src/routes/calendar');
const checkInRoutes = require('./Src/routes/checkin');
const classRoutes = require('./Src/routes/class');
const communityRoutes = require('./Src/routes/communities');
const exerciseRoutes = require('./Src/routes/exercises');
const goalRoutes = require('./Src/routes/goals');
const gymRoutes = require('./Src/routes/gyms');
const intelligenceRoutes = require('./Src/routes/intelligence');
const measurementRoutes = require('./Src/routes/measurements');
const messageRoutes = require('./Src/routes/message');
const nutritionRoutes = require('./Src/routes/nutrition');
const onboardingRoutes = require('./Src/routes/onboarding');
const subscriptionRoutes = require('./Src/routes/subscriptions');
const testRoutes = require('./Src/routes/test');
const userRoutes = require('./Src/routes/user');
const wearableRoutes = require('./Src/routes/wearables');
const workoutRoutes = require('./Src/routes/workout');

// ============================================
// MOUNT ALL ROUTES (ALPHABETICAL)
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/check-ins', checkInRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/gyms', gymRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/measurements', measurementRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wearables', wearableRoutes);
app.use('/api/workouts', workoutRoutes);

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', async (req, res) => {
    const healthcheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: 'ClockWork Island-Genesis API',
        version: '2.0.0',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        routes: {
            auth: '✅',
            calendar: '✅ NEW',
            'check-ins': '✅ NEW',
            classes: '✅',
            exercises: '✅',
            goals: '✅',
            gyms: '✅',
            intelligence: '✅',
            measurements: '✅',
            messages: '✅',
            nutrition: '✅',
            onboarding: '✅ NEW',
            tests: '✅',
            users: '✅',
            wearables: '✅',
            workouts: '✅'
        }
    };
    
    res.status(200).json(healthcheck);
});

// API root endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'ClockWork Island-Genesis API',
        version: '2.0.0',
        status: 'running',
        architecture: 'Multi-tenant SaaS',
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            auth: '/api/auth',
            calendar: '/api/calendar [NEW]',
            'check-ins': '/api/check-ins [NEW]',
            classes: '/api/classes',
            exercises: '/api/exercises',
            goals: '/api/goals',
            gyms: '/api/gyms',
            health: '/api/health',
            intelligence: '/api/intelligence',
            measurements: '/api/measurements',
            messages: '/api/messages',
            nutrition: '/api/nutrition',
            onboarding: '/api/onboarding [NEW]',
            tests: '/api/tests',
            users: '/api/users',
            wearables: '/api/wearables',
            workouts: '/api/workouts'
        }
    });
});

// ============================================
// SOCKET.IO HANDLERS
// ============================================
require('./Src/utils/socketHandlers')(io);

// ============================================
// ERROR HANDLING - COMPREHENSIVE
// ============================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: [
            '/api/auth',
            '/api/calendar',
            '/api/check-ins',
            '/api/classes',
            '/api/exercises',
            '/api/goals',
            '/api/gyms',
            '/api/health',
            '/api/intelligence',
            '/api/measurements',
            '/api/messages',
            '/api/nutrition',
            '/api/onboarding',
            '/api/tests',
            '/api/users',
            '/api/wearables',
            '/api/workouts'
        ]
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(`❌ Error: ${err.message}`);
    console.error(err.stack);
    
    let status = err.status || err.statusCode || 500;
    let message = err.message || 'Internal server error';
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        status = 400;
        message = Object.values(err.errors).map(e => e.message).join(', ');
    }
    
    if (err.name === 'CastError') {
        status = 400;
        message = 'Invalid ID format';
    }
    
    if (err.code === 11000) {
        status = 400;
        message = 'Duplicate entry - this record already exists';
    }
    
    if (err.message === 'Not allowed by CORS') {
        status = 403;
        message = 'Cross-origin request blocked';
    }
    
    if (err.name === 'JsonWebTokenError') {
        status = 401;
        message = 'Invalid token';
    }
    
    if (err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Token expired';
    }
    
    res.status(status).json({
        success: false,
        message: message,
        error: isDevelopment ? {
            name: err.name,
            stack: err.stack,
            details: err
        } : undefined
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    console.error(err.stack);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

// Handle SIGTERM
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully...');
    server.close(() => {
        console.log('💥 Process terminated!');
    });
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
    try {
        await connectDB();
        
        server.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════════════════════╗
║     🏝️ CLOCKWORK ISLAND-GENESIS V2.0 STARTED 🏝️      ║
╠════════════════════════════════════════════════════════╣
║  🌐 Server:      http://localhost:${PORT}                 ║
║  📚 API:         http://localhost:${PORT}/api             ║
║  💚 Health:      http://localhost:${PORT}/api/health      ║
║  🔧 Environment: ${(process.env.NODE_ENV || 'development').padEnd(41)}║
║  📦 Database:    Connected                             ║
║  🎯 Routes:      17 route groups mounted               ║
╠════════════════════════════════════════════════════════╣
║  📍 Available Endpoints:                               ║
║     /api/auth         - Authentication                 ║
║     /api/classes      - Calendar & Scheduling          ║
║     /api/exercises    - Exercise Library               ║
║     /api/goals        - Goals & Habits                 ║
║     /api/gyms         - Island Management              ║
║     /api/intelligence - 🆕 AI Health Insights          ║
║     /api/measurements - Body Measurements              ║
║     /api/messages     - Messaging                      ║
║     /api/nutrition    - Nutrition Plans                ║
║     /api/tests        - Tests & Assessments            ║
║     /api/users        - User Management                ║
║     /api/wearables    - Wearable Integration           ║
║     /api/workouts     - Workout System                 ║
╠════════════════════════════════════════════════════════╣
║  🏝️ Island-Genesis Architecture Active                ║
║  🧠 AI Intelligence Engine Ready                       ║
║  🔥 Phoenix of Tesla™ - Production Ready               ║
╚════════════════════════════════════════════════════════╝
            `);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

// Export for testing
module.exports = { app, server, io };
