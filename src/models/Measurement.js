const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    weight: {
        type: Number,
        required: true
    },
    bodyFat: Number,
    bmr: Number,
    bloodPressure: String,
    circumference: {
        neck: Number,
        shoulders: Number,
        chest: Number,
        upperArm: Number,
        lowerArm: Number,
        waist: Number,
        hips: Number,
        upperThigh: Number,
        calf: Number
    },
    caliper: {
        chest: Number,
        abdominal: Number,
        thigh: Number,
        bicep: Number,
        tricep: Number,
        subscapular: Number,
        suprailiac: Number,
        lowerBack: Number,
        calf: Number
    },
    notes: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Measurement', measurementSchema);