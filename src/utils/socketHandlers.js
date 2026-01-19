const jwt = require('jsonwebtoken');
const WearableData = require('../models/WearableData');
const User = require('../models/User');

// Track connected users for wearable updates
const connectedUsers = new Map();

module.exports = (io) => {
    // ============================================
    // AUTHENTICATION MIDDLEWARE
    // ============================================
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Authentication required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            socket.user = decoded;
            next();
        } catch (error) {
            console.error('Socket auth error:', error.message);
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`[Socket] User connected: ${userId}`);

        // Track user connection
        connectedUsers.set(userId, socket.id);
        socket.join(`user:${userId}`);

        // ============================================
        // WEARABLE DATA EVENTS
        // ============================================

        // Subscribe to real-time wearable updates
        socket.on('wearable:subscribe', async (data) => {
            const { provider } = data;
            const room = `wearable:${userId}:${provider || 'all'}`;
            socket.join(room);
            console.log(`[Socket] User ${userId} subscribed to ${room}`);

            // Send current data immediately
            try {
                const latestData = await getLatestWearableData(userId, provider);
                if (latestData) {
                    socket.emit('wearable:data', {
                        type: 'initial',
                        data: latestData,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                console.error('[Socket] Error fetching initial data:', error);
            }
        });

        // Unsubscribe from wearable updates
        socket.on('wearable:unsubscribe', (data) => {
            const { provider } = data;
            const room = `wearable:${userId}:${provider || 'all'}`;
            socket.leave(room);
            console.log(`[Socket] User ${userId} unsubscribed from ${room}`);
        });

        // Request data sync
        socket.on('wearable:sync', async (data) => {
            const { provider } = data;
            console.log(`[Socket] Sync requested for ${provider} by ${userId}`);

            socket.emit('wearable:sync-started', { provider });

            // The actual sync is handled by the API endpoint
            // This just notifies the client that sync was requested
        });

        // Request intraday data
        socket.on('wearable:intraday', async (data) => {
            const { provider, metric, date } = data;
            console.log(`[Socket] Intraday ${metric} requested for ${date}`);

            try {
                const intradayData = await getIntradayData(userId, provider, metric, date);
                socket.emit('wearable:intraday-data', {
                    metric,
                    date,
                    data: intradayData
                });
            } catch (error) {
                socket.emit('wearable:error', {
                    type: 'intraday',
                    message: error.message
                });
            }
        });

        // Request historical data
        socket.on('wearable:history', async (data) => {
            const { provider, days = 7, metrics } = data;
            console.log(`[Socket] History requested: ${days} days`);

            try {
                const history = await getHistoricalData(userId, provider, days, metrics);
                socket.emit('wearable:history-data', {
                    days,
                    data: history
                });
            } catch (error) {
                socket.emit('wearable:error', {
                    type: 'history',
                    message: error.message
                });
            }
        });

        // Request weekly insights
        socket.on('wearable:insights', async (data) => {
            const { provider } = data;
            console.log(`[Socket] Insights requested for ${userId}`);

            try {
                const insights = await generateInsights(userId, provider);
                socket.emit('wearable:insights-data', insights);
            } catch (error) {
                socket.emit('wearable:error', {
                    type: 'insights',
                    message: error.message
                });
            }
        });

        // ============================================
        // MESSAGING EVENTS
        // ============================================

        socket.on('send-message', (data) => {
            io.to(`user:${data.recipientId}`).emit('new-message', data);
        });

        socket.on('typing', (data) => {
            socket.to(`user:${data.recipientId}`).emit('user-typing', data);
        });

        // ============================================
        // WORKOUT EVENTS
        // ============================================

        socket.on('workout:start', (data) => {
            console.log(`[Socket] Workout started by ${userId}`);
            // Could integrate with wearable for real-time HR during workout
        });

        socket.on('workout:complete', (data) => {
            console.log(`[Socket] Workout completed by ${userId}`);
            // Trigger wearable sync after workout
            socket.emit('wearable:sync-recommended', {
                reason: 'workout_complete',
                message: 'Sync your wearable to capture workout data'
            });
        });

        // ============================================
        // COACH-CLIENT EVENTS
        // ============================================

        // Coach subscribes to client updates
        socket.on('coach:subscribe', () => {
            console.log(`[Socket] Coach ${userId} subscribed to client updates`);
            socket.join(`coach:${userId}`);
        });

        // Client subscribes to coach updates (approvals, workouts, etc)
        socket.on('client:subscribe', () => {
            console.log(`[Socket] Client ${userId} subscribed to coach updates`);
            socket.join(`client:${userId}`);
        });

        // ============================================
        // DISCONNECT
        // ============================================

        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${userId}`);
            connectedUsers.delete(userId);
        });
    });

    // ============================================
    // BROADCAST FUNCTIONS (for use by controllers)
    // ============================================

    // Broadcast new wearable data to user
    io.broadcastWearableUpdate = (userId, provider, data) => {
        const rooms = [
            `wearable:${userId}:${provider}`,
            `wearable:${userId}:all`
        ];

        rooms.forEach(room => {
            io.to(room).emit('wearable:data', {
                type: 'update',
                provider,
                data,
                timestamp: new Date().toISOString()
            });
        });

        console.log(`[Socket] Broadcasted wearable update to ${userId}`);
    };

    // Broadcast sync status
    io.broadcastSyncStatus = (userId, provider, status, message) => {
        io.to(`user:${userId}`).emit('wearable:sync-status', {
            provider,
            status, // 'started', 'progress', 'completed', 'failed'
            message,
            timestamp: new Date().toISOString()
        });
    };

    // Broadcast recovery alert
    io.broadcastRecoveryAlert = (userId, data) => {
        io.to(`user:${userId}`).emit('wearable:recovery-alert', {
            recoveryScore: data.recoveryScore,
            recommendation: data.recommendation,
            factors: data.factors,
            timestamp: new Date().toISOString()
        });
    };

    // Check if user is connected
    io.isUserConnected = (userId) => {
        return connectedUsers.has(userId);
    };

    // ============================================
    // COACH-CLIENT BROADCAST FUNCTIONS
    // ============================================

    // Notify coach of new pending client request
    io.notifyCoachNewClient = (coachId, clientData) => {
        io.to(`coach:${coachId}`).emit('coach:new-client-request', {
            type: 'new_request',
            client: clientData,
            timestamp: new Date().toISOString()
        });
        console.log(`[Socket] Notified coach ${coachId} of new client request`);
    };

    // Notify client when coach approves them
    io.notifyClientApproved = (clientId, coachData) => {
        io.to(`client:${clientId}`).emit('client:approved', {
            type: 'approved',
            coach: coachData,
            timestamp: new Date().toISOString()
        });
        console.log(`[Socket] Notified client ${clientId} of approval`);
    };

    // Notify client when coach rejects them
    io.notifyClientRejected = (clientId, coachData) => {
        io.to(`client:${clientId}`).emit('client:rejected', {
            type: 'rejected',
            coach: coachData,
            timestamp: new Date().toISOString()
        });
        console.log(`[Socket] Notified client ${clientId} of rejection`);
    };

    // Notify client of new workout assigned
    io.notifyClientNewWorkout = (clientId, workoutData) => {
        io.to(`client:${clientId}`).emit('client:new-workout', {
            type: 'new_workout',
            workout: workoutData,
            timestamp: new Date().toISOString()
        });
        console.log(`[Socket] Notified client ${clientId} of new workout`);
    };

    // Notify coach when client completes workout
    io.notifyCoachWorkoutComplete = (coachId, workoutData) => {
        io.to(`coach:${coachId}`).emit('coach:client-workout-complete', {
            type: 'workout_complete',
            workout: workoutData,
            timestamp: new Date().toISOString()
        });
        console.log(`[Socket] Notified coach ${coachId} of completed workout`);
    };
};

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getLatestWearableData(userId, provider) {
    const query = { userId };
    if (provider) query.provider = provider;

    const data = await WearableData.findOne(query)
        .sort({ date: -1 })
        .select('-rawData -heartRateIntraday -hrvIntraday -spo2Intraday -sleepLogs');

    return data;
}

async function getIntradayData(userId, provider, metric, date) {
    const targetDate = new Date(date);

    const data = await WearableData.findOne({
        userId,
        provider: provider || 'fitbit',
        date: {
            $gte: new Date(targetDate.setHours(0, 0, 0, 0)),
            $lt: new Date(targetDate.setHours(23, 59, 59, 999))
        }
    });

    if (!data) return null;

    switch (metric) {
        case 'heartRate':
            return data.heartRateIntraday || [];
        case 'hrv':
            return data.hrvIntraday || [];
        case 'spo2':
            return data.spo2Intraday || [];
        default:
            return null;
    }
}

async function getHistoricalData(userId, provider, days, metrics) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = { userId, date: { $gte: startDate } };
    if (provider) query.provider = provider;

    let projection = { rawData: 0, heartRateIntraday: 0, hrvIntraday: 0, spo2Intraday: 0, sleepLogs: 0 };

    // If specific metrics requested, only return those
    if (metrics && metrics.length > 0) {
        projection = { date: 1, provider: 1 };
        metrics.forEach(m => { projection[m] = 1; });
    }

    return WearableData.find(query)
        .select(projection)
        .sort({ date: 1 });
}

async function generateInsights(userId, provider) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const data = await WearableData.find({
        userId,
        provider: provider || 'fitbit',
        date: { $gte: weekAgo }
    }).sort({ date: 1 });

    if (data.length === 0) {
        return { hasData: false, message: 'No data available for insights' };
    }

    // Calculate averages
    const avgSteps = Math.round(data.reduce((sum, d) => sum + (d.steps || 0), 0) / data.length);
    const avgSleep = Math.round(data.reduce((sum, d) => sum + (d.sleepDuration || 0), 0) / data.length);
    const avgHRV = Math.round(data.filter(d => d.hrv).reduce((sum, d) => sum + d.hrv, 0) / data.filter(d => d.hrv).length) || null;
    const avgRHR = Math.round(data.filter(d => d.restingHeartRate).reduce((sum, d) => sum + d.restingHeartRate, 0) / data.filter(d => d.restingHeartRate).length) || null;
    const avgRecovery = Math.round(data.filter(d => d.recoveryScore).reduce((sum, d) => sum + d.recoveryScore, 0) / data.filter(d => d.recoveryScore).length) || null;

    // Calculate trends (comparing first half vs second half of week)
    const midpoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midpoint);
    const secondHalf = data.slice(midpoint);

    const calculateTrend = (arr, field) => {
        const first = arr.slice(0, Math.floor(arr.length / 2)).filter(d => d[field]);
        const second = arr.slice(Math.floor(arr.length / 2)).filter(d => d[field]);
        if (first.length === 0 || second.length === 0) return 'stable';
        const firstAvg = first.reduce((sum, d) => sum + d[field], 0) / first.length;
        const secondAvg = second.reduce((sum, d) => sum + d[field], 0) / second.length;
        const diff = ((secondAvg - firstAvg) / firstAvg) * 100;
        if (diff > 5) return 'improving';
        if (diff < -5) return 'declining';
        return 'stable';
    };

    // Generate recommendations
    const recommendations = [];

    if (avgSleep < 420) { // Less than 7 hours
        recommendations.push({
            type: 'sleep',
            priority: 'high',
            message: 'Your average sleep is below 7 hours. Aim for 7-9 hours for optimal recovery.',
            icon: 'fa-moon'
        });
    }

    if (avgSteps < 8000) {
        recommendations.push({
            type: 'activity',
            priority: 'medium',
            message: `You're averaging ${avgSteps} steps. Try to hit 10,000 for better health outcomes.`,
            icon: 'fa-walking'
        });
    }

    if (avgHRV && avgHRV < 40) {
        recommendations.push({
            type: 'recovery',
            priority: 'high',
            message: 'Your HRV is on the lower side. Consider lighter training and focus on stress management.',
            icon: 'fa-heart-pulse'
        });
    }

    if (avgRecovery && avgRecovery < 50) {
        recommendations.push({
            type: 'training',
            priority: 'high',
            message: 'Recovery is below optimal. Consider a deload week or additional rest days.',
            icon: 'fa-battery-half'
        });
    }

    return {
        hasData: true,
        period: {
            start: data[0].date,
            end: data[data.length - 1].date,
            days: data.length
        },
        averages: {
            steps: avgSteps,
            sleepMinutes: avgSleep,
            sleepHours: (avgSleep / 60).toFixed(1),
            hrv: avgHRV,
            restingHeartRate: avgRHR,
            recoveryScore: avgRecovery
        },
        trends: {
            steps: calculateTrend(data, 'steps'),
            sleep: calculateTrend(data, 'sleepDuration'),
            hrv: calculateTrend(data, 'hrv'),
            recovery: calculateTrend(data, 'recoveryScore')
        },
        recommendations,
        dailyData: data.map(d => ({
            date: d.date,
            steps: d.steps,
            sleepHours: d.sleepDuration ? (d.sleepDuration / 60).toFixed(1) : null,
            hrv: d.hrv,
            rhr: d.restingHeartRate,
            recovery: d.recoveryScore
        }))
    };
}
