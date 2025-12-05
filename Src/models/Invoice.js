const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },
    items: [{
        description: String,
        quantity: Number,
        unitPrice: Number,
        totalPrice: Number,
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class'
        }
    }],
    subtotal: {
        type: Number,
        required: true
    },
    tax: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
        default: 'draft'
    },
    dueDate: Date,
    paidDate: Date,
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    notes: String
}, {
    timestamps: true
});

// Auto-generate invoice number
invoiceSchema.pre('save', async function(next) {
    if (this.isNew && !this.invoiceNumber) {
        const count = await this.constructor.countDocuments({ gymId: this.gymId });
        const year = new Date().getFullYear();
        this.invoiceNumber = `INV-${year}-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);