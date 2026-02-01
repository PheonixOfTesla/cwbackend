const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { createServer } = require('http');
const path = require('path');
require('dotenv').config();

// ============================================
// INITIALIZATION
// ============================================
const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// ============================================
// UNIVERSAL CORS - WORKS EVERYWHERE
// ============================================
app.use(cors({
    origin: (origin, callback) => callback(null, true), // Allow all
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
    exposedHeaders: '*',
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Handle preflight
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(204);
});

// ============================================
// ESSENTIAL MIDDLEWARE
// ============================================
app.use(helmet({ 
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false 
}));
app.use(compression());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Conditional logging
if (isDevelopment) {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        skip: (req) => req.url === '/api/health'
    }));
}

// ============================================
// DATABASE CONNECTION WITH AUTO-RECOVERY
// ============================================
let dbConnectionAttempts = 0;
const MAX_DB_RETRIES = 10;

const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 
                        process.env.DATABASE_URL || 
                        'mongodb://localhost:27017/coastal-fitness';
        
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            heartbeatFrequencyMS: 10000,
            maxPoolSize: 10
        });
        
        console.log('✅ MongoDB connected');
        dbConnectionAttempts = 0; // Reset counter on success
        
        // Handle disconnection
        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected, attempting reconnect...');
            if (dbConnectionAttempts < MAX_DB_RETRIES) {
                setTimeout(connectDB, 5000);
            }
        });
        
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB error:', err.message);
        });
        
    } catch (err) {
        dbConnectionAttempts++;
        console.error(`Database connection attempt ${dbConnectionAttempts} failed:`, err.message);
        
        if (dbConnectionAttempts < MAX_DB_RETRIES) {
            const delay = Math.min(5000 * dbConnectionAttempts, 30000);
            console.log(`Retrying in ${delay/1000} seconds...`);
            setTimeout(connectDB, delay);
        } else {
            console.error('Max database connection attempts reached');
            // Server continues running without database
        }
    }
};

// ============================================
// SOCKET.IO (OPTIONAL - WITH FALLBACK)
// ============================================
let io;
try {
    const socketIO = require('socket.io');
    io = socketIO(server, {
        cors: { origin: '*', credentials: true },
        transports: ['websocket', 'polling']
    });
    app.set('io', io);
    global.io = io;
    
    // Load socket handlers if they exist
    try {
        require('./utils/socketHandlers')(io);
    } catch (err) {
        console.log('Socket handlers not found, skipping');
    }
} catch (err) {
    console.log('Socket.IO not available, continuing without it');
}

// ============================================
// DYNAMIC ROUTE LOADING WITH FALLBACKS
// ============================================
const routes = [
    '/api/auth:./routes/auth',
    '/api/users:./routes/user',
    '/api/workouts:./routes/workout',
    '/api/measurements:./routes/measurements',
    '/api/goals:./routes/goals',
    '/api/nutrition:./routes/nutrition',
    '/api/messages:./routes/message',
    '/api/tests:./routes/test',
    '/api/exercises:./routes/exercises',
    // Coach Marketplace Routes
    '/api/coaches:./routes/coach',
    '/api/subscriptions:./routes/coachSubscription',
    '/api/messaging:./routes/messaging',
    '/api/admin:./routes/admin'
];

let loadedRoutes = 0;
routes.forEach(routeConfig => {
    const [path, file] = routeConfig.split(':');
    try {
        const router = require(file);
        app.use(path, router);
        loadedRoutes++;
        console.log(`✅ ${path}`);
    } catch (err) {
        console.log(`⚠️ ${path} not loaded:`, err.message);
    }
});

console.log(`Loaded ${loadedRoutes}/${routes.length} routes`);

// ============================================
// CORE ENDPOINTS (ALWAYS AVAILABLE)
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/api', (req, res) => {
    res.json({
        name: 'Coastal Fitness API',
        version: '1.0.0',
        status: 'running',
        endpoints: routes.map(r => r.split(':')[0])
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Coastal Fitness Backend', 
        api: '/api',
        health: '/api/health' 
    });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res, next) => {
    res.status(404).json({ 
        error: 'Not Found',
        path: req.originalUrl,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(isDevelopment && { stack: err.stack })
    });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    server.close(() => {
        console.log('HTTP server closed');
    });
    
    try {
        await mongoose.connection.close();
        console.log('Database connection closed');
    } catch (err) {
        console.error('Error closing database:', err);
    }
    
    process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle errors that would crash the server
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    if (isDevelopment) {
        shutdown('uncaughtException');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
    // Try to connect to database (non-blocking)
    connectDB();
    
    // Start server immediately (doesn't wait for DB)
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
========================================
🚀 Coastal Fitness Backend
========================================
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📚 API: http://localhost:${PORT}/api
💚 Health: http://localhost:${PORT}/api/health
========================================
        `);
    });
};

// Start the server
startServer();

// Export for testing
module.exports = { app, server };
