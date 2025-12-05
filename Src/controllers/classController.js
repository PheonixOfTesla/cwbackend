const Class = require('../models/Class');
const Gym = require('../models/Gym');
const User = require('../models/User');

// Get all classes for a gym
exports.getClasses = async (req, res) => {
    try {
        const { gymId } = req.params;
        const { startDate, endDate, instructorId, type, status } = req.query;
        
        let query = { gymId };
        
        // Filter by date range if provided
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }
        
        // Additional filters
        if (instructorId) query.instructorId = instructorId;
        if (type) query.type = type;
        if (status) query.status = status;
        
        const classes = await Class.find(query)
            .populate('instructorId', 'name email')
            .populate('booked', 'name email')
            .sort('date');
        
        res.json({
            success: true,
            count: classes.length,
            data: classes
        });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get single class by ID
exports.getClassById = async (req, res) => {
    try {
        const classData = await Class.findById(req.params.id)
            .populate('instructorId', 'name email')
            .populate('booked', 'name email')
            .populate('waitlist', 'name email');
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        res.json({
            success: true,
            data: classData
        });
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create new class
exports.createClass = async (req, res) => {
    try {
        const { gymId } = req.params;
        
        // Validate gym exists (if you have Gym model)
        // const gym = await Gym.findById(gymId);
        // if (!gym) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'Gym not found'
        //     });
        // }
        
        const classData = {
            ...req.body,
            gymId,
            instructorId: req.body.instructorId || req.user.id
        };
        
        const newClass = await Class.create(classData);
        
        // Handle recurrence if needed
        if (req.body.recurrence && req.body.recurrence !== 'none') {
            await createRecurringClasses(newClass, req.body.recurrence);
        }
        
        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: newClass
        });
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Update class
exports.updateClass = async (req, res) => {
    try {
        const classData = await Class.findById(req.params.id);
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        // Don't allow updating if class has started or is in past
        if (new Date(classData.date) < new Date() && classData.status !== 'scheduled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot update past or in-progress class'
            });
        }
        
        // Update fields
        Object.assign(classData, req.body);
        await classData.save();
        
        res.json({
            success: true,
            message: 'Class updated successfully',
            data: classData
        });
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete class
exports.deleteClass = async (req, res) => {
    try {
        const classData = await Class.findById(req.params.id);
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        // Check if class has bookings
        if (classData.booked.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete class with existing bookings. Cancel the class instead.'
            });
        }
        
        await Class.findByIdAndDelete(req.params.id);
        
        res.json({
            success: true,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Book a class
exports.bookClass = async (req, res) => {
    try {
        const { classId } = req.params;
        const { userId } = req.body;
        
        const bookingUserId = userId || req.user.id;
        
        const classData = await Class.findById(classId);
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        // Check if class is in the past
        if (new Date(classData.date) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot book a past class'
            });
        }
        
        // Check if user already booked
        if (classData.isUserBooked(bookingUserId)) {
            return res.status(400).json({
                success: false,
                message: 'You are already booked for this class'
            });
        }
        
        // Check capacity
        if (classData.isFull) {
            // Add to waitlist
            if (!classData.waitlist.includes(bookingUserId)) {
                classData.waitlist.push(bookingUserId);
                await classData.save();
            }
            
            return res.status(400).json({
                success: false,
                message: 'Class is full. You have been added to the waitlist.',
                waitlisted: true
            });
        }
        
        // Add booking
        await classData.addBooking(bookingUserId);
        
        // Populate for response
        await classData.populate('booked', 'name email');
        
        res.json({
            success: true,
            message: 'Class booked successfully',
            data: classData
        });
    } catch (error) {
        console.error('Book class error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Cancel booking
exports.cancelBooking = async (req, res) => {
    try {
        const { classId } = req.params;
        const { userId } = req.body;
        
        const cancelUserId = userId || req.user.id;
        
        const classData = await Class.findById(classId);
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        // Check if user is booked
        if (!classData.isUserBooked(cancelUserId)) {
            return res.status(400).json({
                success: false,
                message: 'You are not booked for this class'
            });
        }
        
        // Remove booking
        await classData.removeBooking(cancelUserId);
        
        // Move someone from waitlist if available
        if (classData.waitlist.length > 0) {
            const nextUserId = classData.waitlist.shift();
            classData.booked.push(nextUserId);
            await classData.save();
            
            // TODO: Send notification to user moved from waitlist
        }
        
        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            data: classData
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Cancel entire class
exports.cancelClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        const classData = await Class.findById(id);
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        classData.status = 'cancelled';
        classData.cancelledBy = req.user.id;
        classData.cancelledAt = new Date();
        classData.cancellationReason = reason;
        
        await classData.save();
        
        // TODO: Send notifications to all booked users
        
        res.json({
            success: true,
            message: 'Class cancelled successfully',
            data: classData
        });
    } catch (error) {
        console.error('Cancel class error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user's booked classes
exports.getUserClasses = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        
        const classes = await Class.find({
            booked: userId,
            status: { $ne: 'cancelled' }
        })
        .populate('instructorId', 'name email')
        .sort('date');
        
        res.json({
            success: true,
            count: classes.length,
            data: classes
        });
    } catch (error) {
        console.error('Get user classes error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper function for recurring classes
async function createRecurringClasses(baseClass, recurrence) {
    const recurringClasses = [];
    const iterations = 4; // Create 4 weeks ahead
    
    for (let i = 1; i <= iterations; i++) {
        const newDate = new Date(baseClass.date);
        
        if (recurrence === 'daily') {
            newDate.setDate(newDate.getDate() + i);
        } else if (recurrence === 'weekly') {
            newDate.setDate(newDate.getDate() + (i * 7));
        } else if (recurrence === 'monthly') {
            newDate.setMonth(newDate.getMonth() + i);
        }
        
        const clonedClass = baseClass.cloneForDate(newDate);
        recurringClasses.push(clonedClass);
    }
    
    if (recurringClasses.length > 0) {
        await Class.insertMany(recurringClasses);
    }
}

// Get class attendance/stats
exports.getClassStats = async (req, res) => {
    try {
        const { id } = req.params;
        
        const classData = await Class.findById(id)
            .populate('booked', 'name email')
            .populate('waitlist', 'name email');
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        const stats = {
            className: classData.name,
            date: classData.date,
            capacity: classData.capacity,
            booked: classData.booked.length,
            spotsAvailable: classData.spotsAvailable,
            waitlist: classData.waitlist.length,
            revenue: classData.booked.length * classData.pricing.amount,
            attendanceRate: classData.capacity > 0 
                ? Math.round((classData.booked.length / classData.capacity) * 100) 
                : 0
        };
        
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get class stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};