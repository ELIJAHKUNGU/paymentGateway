const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        index: true
    },
    bankName: {
        type: String,
        required: true,
        index: true
    },
    paybill: {
        type: Number,
        required: true
    },
    accountReference: {
        type: String,
        required: true
    },
    timestamp: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['initiated', 'completed', 'failed', 'pending'],
        default: 'initiated',
        index: true
    },
    resultCode: {
        type: String,
        default: null
    },
    resultDesc: {
        type: String,
        default: null
    },
    merchantRequestId: {
        type: String,
        default: null
    },
    checkoutRequestId: {
        type: String,
        default: null,
        index: true
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'transactions'
});

// Compound indexes for better query performance
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ phoneNumber: 1, createdAt: -1 });
transactionSchema.index({ bankName: 1, status: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);