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
// CORS CONFIGURATION
// ============================================
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (process.env.NODE_ENV === 'production') {
            return callback(null, true);
        }

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
// DATABASE CONNECTION
// ============================================
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/clockwork-genesis';

        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 50,
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
// GENERAL MIDDLEWARE
// ============================================
app.use(compression());
app.use(morgan(isDevelopment ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
    console.log(`🔥 ${req.method} ${req.path} from ${req.ip}`);
    next();
});

// ============================================
// API ROUTES - B2C/B2B HYBRID MODEL
// ============================================

// Core Auth & User
const authRoutes = require('./Src/routes/auth');
const userRoutes = require('./Src/routes/user');

// NEW: Coach & AI Coach (B2C/B2B Core)
const coachRoutes = require('./Src/routes/coach');
const aiCoachRoutes = require('./Src/routes/aiCoach');

// Fitness Features
const workoutRoutes = require('./Src/routes/workout');
const exerciseRoutes = require('./Src/routes/exercises');
const nutritionRoutes = require('./Src/routes/nutrition');
const goalRoutes = require('./Src/routes/goals');
const measurementRoutes = require('./Src/routes/measurements');

// Calendar & Check-ins
const calendarRoutes = require('./Src/routes/calendar');
const checkInRoutes = require('./Src/routes/checkin');
const onboardingRoutes = require('./Src/routes/onboarding');

// Community & Messaging
const communityRoutes = require('./Src/routes/communities');
const messageRoutes = require('./Src/routes/message');

// Intelligence & Wearables
const intelligenceRoutes = require('./Src/routes/intelligence');
const wearableRoutes = require('./Src/routes/wearables');

// Billing
const subscriptionRoutes = require('./Src/routes/subscriptions');

// Testing
const testRoutes = require('./Src/routes/test');

// ============================================
// MOUNT ALL ROUTES
// ============================================

// Core
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// NEW: Coach & AI Coach Routes (THE CORE B2C/B2B FEATURES)
app.use('/api/coach', coachRoutes);
app.use('/api/ai-coach', aiCoachRoutes);

// Fitness
app.use('/api/workouts', workoutRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/measurements', measurementRoutes);

// Calendar & Scheduling
app.use('/api/calendar', calendarRoutes);
app.use('/api/check-ins', checkInRoutes);
app.use('/api/onboarding', onboardingRoutes);

// Community
app.use('/api/communities', communityRoutes);
app.use('/api/messages', messageRoutes);

// Intelligence & Wearables
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/wearables', wearableRoutes);

// Billing
app.use('/api/subscriptions', subscriptionRoutes);

// Testing
app.use('/api/tests', testRoutes);

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', async (req, res) => {
    const healthcheck = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        service: 'ClockWork B2C/B2B Hybrid API',
        version: '3.0.0',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        architecture: 'Coach/Client/Individual (B2C + B2B)',
        routes: {
            auth: '✅',
            users: '✅',
            coach: '✅ NEW - Coach management',
            'ai-coach': '✅ NEW - AI coaching',
            workouts: '✅',
            exercises: '✅',
            nutrition: '✅',
            goals: '✅',
            measurements: '✅',
            calendar: '✅',
            'check-ins': '✅',
            onboarding: '✅',
            communities: '✅',
            messages: '✅',
            intelligence: '✅',
            wearables: '✅',
            subscriptions: '✅',
            tests: '✅'
        }
    };

    res.status(200).json(healthcheck);
});

app.get('/', (req, res) => {
    res.json({
        name: 'ClockWork API',
        version: '3.0.0',
        mission: 'Kill the $150/month personal trainer industry',
        architecture: 'B2C/B2B Hybrid (Coach/Client/Individual)',
        pricing: {
            individual: { free: '$0', pro: '$9.99/mo' },
            coach: { starter: '$29/mo', pro: '$79/mo', scale: '$149/mo', enterprise: '$299/mo' }
        },
        health: '/api/health'
    });
});

app.get('/api', (req, res) => {
    res.json({
        name: 'ClockWork B2C/B2B Hybrid API',
        version: '3.0.0',
        status: 'running',
        architecture: 'Coach/Client/Individual Model',
        environment: process.env.NODE_ENV || 'development',
        userTypes: {
            individual: 'AI-only coaching ($9.99/mo)',
            client: 'Human + AI coaching (coach pays)',
            coach: 'Manage clients ($29-299/mo)'
        },
        endpoints: {
            auth: '/api/auth',
            users: '/api/users',
            coach: '/api/coach [NEW]',
            'ai-coach': '/api/ai-coach [NEW]',
            workouts: '/api/workouts',
            exercises: '/api/exercises',
            nutrition: '/api/nutrition',
            goals: '/api/goals',
            measurements: '/api/measurements',
            calendar: '/api/calendar',
            'check-ins': '/api/check-ins',
            onboarding: '/api/onboarding',
            communities: '/api/communities',
            messages: '/api/messages',
            intelligence: '/api/intelligence',
            wearables: '/api/wearables',
            subscriptions: '/api/subscriptions',
            health: '/api/health'
        }
    });
});

// ============================================
// SOCKET.IO HANDLERS
// ============================================
require('./Src/utils/socketHandlers')(io);

// ============================================
// ERROR HANDLING
// ============================================

app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: [
            '/api/auth',
            '/api/users',
            '/api/coach',
            '/api/ai-coach',
            '/api/workouts',
            '/api/exercises',
            '/api/nutrition',
            '/api/goals',
            '/api/measurements',
            '/api/calendar',
            '/api/check-ins',
            '/api/onboarding',
            '/api/communities',
            '/api/messages',
            '/api/intelligence',
            '/api/wearables',
            '/api/subscriptions',
            '/api/health'
        ]
    });
});

app.use((err, req, res, next) => {
    console.error(`❌ Error: ${err.message}`);
    console.error(err.stack);

    let status = err.status || err.statusCode || 500;
    let message = err.message || 'Internal server error';

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

process.on('uncaughtException', (err) => {
    console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err.name, err.message);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

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
╔════════════════════════════════════════════════════════════════╗
║        ⚡ CLOCKWORK B2C/B2B HYBRID V3.0 STARTED ⚡             ║
╠════════════════════════════════════════════════════════════════╣
║  🌐 Server:      http://localhost:${PORT}                          ║
║  📚 API:         http://localhost:${PORT}/api                      ║
║  💚 Health:      http://localhost:${PORT}/api/health               ║
║  🔧 Environment: ${(process.env.NODE_ENV || 'development').padEnd(44)}║
║  📦 Database:    Connected                                     ║
╠════════════════════════════════════════════════════════════════╣
║  🎯 USER TYPES:                                                 ║
║     Individual ($9.99/mo) → AI IS the coach                    ║
║     Client (coach pays)   → Human + AI coaching                ║
║     Coach ($29-299/mo)    → Manage your clients                ║
╠════════════════════════════════════════════════════════════════╣
║  📍 NEW B2C/B2B ENDPOINTS:                                      ║
║     /api/coach         - Coach client management               ║
║     /api/ai-coach      - AI coaching & program generation      ║
╠════════════════════════════════════════════════════════════════╣
║  🚀 Mission: Kill the $150/mo personal trainer industry        ║
║  💰 Target: $0.15/user AI cost vs $3+ competitors              ║
╚════════════════════════════════════════════════════════════════╝
            `);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = { app, server, io };
