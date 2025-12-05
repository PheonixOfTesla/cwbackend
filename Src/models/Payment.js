const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: false
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    currency: {
        type: String,
        default: 'USD'
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['card', 'cash', 'package', 'membership'],
        default: 'card'
    },
    timing: {
        type: String,
        enum: ['pre-pay', 'on-arrival', 'post-service', 'package'],
        required: true
    },
    // Stripe integration
    stripePaymentIntentId: String,
    stripeChargeId: String,
    
    // Additional details
    description: String,
    metadata: mongoose.Schema.Types.Mixed,
    
    // Timestamps
    paidAt: Date,
    refundedAt: Date,
    failedAt: Date,
    
    // Refund info
    refundAmount: Number,
    refundReason: String
}, {
    timestamps: true
});

// Indexes for reporting
paymentSchema.index({ gymId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);