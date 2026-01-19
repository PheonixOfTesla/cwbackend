const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const Class = require('../models/Class');
const Gym = require('../models/Gym');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Process payment for class booking
exports.processClassPayment = async (req, res) => {
    try {
        const { classId, paymentMethod, stripeToken } = req.body;
        const userId = req.user.id;
        
        const classData = await Class.findById(classId).populate('gymId');
        
        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }
        
        const amount = classData.pricing.amount;
        const timing = classData.pricing.timing;
        
        // Create payment record
        const payment = new Payment({
            gymId: classData.gymId,
            userId,
            classId,
            amount,
            timing,
            paymentMethod: paymentMethod || 'card',
            description: `Payment for ${classData.name}`,
            status: 'pending'
        });
        
        // Process Stripe payment if pre-pay
        if (timing === 'pre-pay' && paymentMethod === 'card') {
            try {
                // Create Stripe Payment Intent
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: Math.round(amount * 100), // Convert to cents
                    currency: 'usd',
                    payment_method: stripeToken,
                    confirm: true,
                    metadata: {
                        classId: classId.toString(),
                        userId: userId.toString(),
                        gymId: classData.gymId.toString()
                    }
                });
                
                payment.stripePaymentIntentId = paymentIntent.id;
                payment.stripeChargeId = paymentIntent.latest_charge;
                payment.status = 'completed';
                payment.paidAt = new Date();
                
            } catch (stripeError) {
                payment.status = 'failed';
                payment.failedAt = new Date();
                await payment.save();
                
                return res.status(400).json({
                    success: false,
                    message: 'Payment failed: ' + stripeError.message
                });
            }
        } else {
            // For on-arrival, post-service, or package - mark as pending
            payment.status = 'pending';
        }
        
        await payment.save();
        
        // Generate invoice
        const invoice = new Invoice({
            gymId: classData.gymId,
            userId,
            items: [{
                description: classData.name,
                quantity: 1,
                unitPrice: amount,
                totalPrice: amount,
                classId
            }],
            subtotal: amount,
            total: amount,
            status: payment.status === 'completed' ? 'paid' : 'sent',
            paymentId: payment._id,
            paidDate: payment.paidAt
        });
        
        await invoice.save();
        
        res.json({
            success: true,
            message: payment.status === 'completed' ? 'Payment successful' : 'Payment scheduled',
            payment,
            invoice
        });
        
    } catch (error) {
        console.error('Payment processing error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get gym revenue report
exports.getGymRevenue = async (req, res) => {
    try {
        const { gymId } = req.params;
        const { startDate, endDate } = req.query;
        
        const query = {
            gymId,
            status: 'completed'
        };
        
        if (startDate || endDate) {
            query.paidAt = {};
            if (startDate) query.paidAt.$gte = new Date(startDate);
            if (endDate) query.paidAt.$lte = new Date(endDate);
        }
        
        const payments = await Payment.find(query).sort('-paidAt');
        
        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const paymentCount = payments.length;
        const averageTransaction = paymentCount > 0 ? totalRevenue / paymentCount : 0;
        
        // Group by payment method
        const byMethod = payments.reduce((acc, p) => {
            acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount;
            return acc;
        }, {});
        
        res.json({
            success: true,
            data: {
                totalRevenue,
                paymentCount,
                averageTransaction,
                byMethod,
                payments
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get user payment history
exports.getUserPayments = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        
        const payments = await Payment.find({ userId })
            .populate('classId', 'name date')
            .sort('-createdAt');
        
        res.json({
            success: true,
            data: payments
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Refund payment
exports.refundPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { reason } = req.body;
        
        const payment = await Payment.findById(paymentId);
        
        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }
        
        if (payment.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Only completed payments can be refunded'
            });
        }
        
        // Process Stripe refund if applicable
        if (payment.stripeChargeId) {
            await stripe.refunds.create({
                charge: payment.stripeChargeId
            });
        }
        
        payment.status = 'refunded';
        payment.refundedAt = new Date();
        payment.refundAmount = payment.amount;
        payment.refundReason = reason;
        await payment.save();
        
        res.json({
            success: true,
            message: 'Payment refunded successfully',
            payment
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = exports;