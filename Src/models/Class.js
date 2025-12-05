const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Class name is required'],
        trim: true,
        maxlength: [100, 'Class name cannot exceed 100 characters']
    },
    type: {
        type: String,
        enum: ['group', '1on1', 'appointment'],
        required: true,
        default: 'group'
    },
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: false // Make optional if you don't have Gym model yet
    },
    instructorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: [true, 'Class date is required']
    },
    duration: {
        type: Number,
        default: 60,
        min: [15, 'Duration must be at least 15 minutes'],
        max: [480, 'Duration cannot exceed 8 hours']
    },
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [1, 'Capacity must be at least 1'],
        max: [200, 'Capacity cannot exceed 200']
    },
    booked: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    waitlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    pricing: {
        amount: {
            type: Number,
            default: 0,
            min: [0, 'Price cannot be negative']
        },
        timing: {
            type: String,
            enum: ['pre-pay', 'on-arrival', 'post-service', 'package'],
            default: 'pre-pay'
        }
    },
    recurrence: {
        type: String,
        enum: ['none', 'daily', 'weekly', 'monthly'],
        default: 'none'
    },
    parentClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    description: {
        type: String,
        maxlength: [1000, 'Description cannot exceed 1000 characters']
    },
    status: {
        type: String,
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancelledAt: Date,
    cancellationReason: String
}, {
    timestamps: true
});

// Indexes for performance
classSchema.index({ gymId: 1, date: 1 });
classSchema.index({ instructorId: 1, date: 1 });
classSchema.index({ date: 1, status: 1 });

// Virtual for spots available
classSchema.virtual('spotsAvailable').get(function() {
    return this.capacity - this.booked.length;
});

// Virtual for is full
classSchema.virtual('isFull').get(function() {
    return this.booked.length >= this.capacity;
});

// Check if user is already booked
classSchema.methods.isUserBooked = function(userId) {
    return this.booked.some(id => id.toString() === userId.toString());
};

// Add user to class
classSchema.methods.addBooking = async function(userId) {
    if (this.isUserBooked(userId)) {
        throw new Error('User already booked for this class');
    }
    
    if (this.isFull) {
        throw new Error('Class is full');
    }
    
    this.booked.push(userId);
    return this.save();
};

// Remove user from class
classSchema.methods.removeBooking = async function(userId) {
    this.booked = this.booked.filter(id => id.toString() !== userId.toString());
    return this.save();
};

// Clone class for recurrence
classSchema.methods.cloneForDate = function(newDate) {
    const cloned = this.toObject();
    delete cloned._id;
    delete cloned.createdAt;
    delete cloned.updatedAt;
    cloned.date = newDate;
    cloned.booked = [];
    cloned.waitlist = [];
    cloned.parentClass = this._id;
    return cloned;
};

classSchema.set('toJSON', { virtuals: true });
classSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Class', classSchema);