const mongoose = require('mongoose');

const callbackSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        index: true
    },
    merchantRequestId: {
        type: String,
        required: true,
        index: true
    },
    checkoutRequestId: {
        type: String,
        required: true,
        index: true
    },
    resultCode: {
        type: String,
        required: true,
        index: true
    },
    resultDesc: {
        type: String,
        required: true
    },
    phoneNumber: {
        type: String,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    mpesaReceiptNumber: {
        type: String,
        default: null,
        index: true
    },
    transactionDate: {
        type: String,
        default: null
    },
    rawCallbackData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'callbacks'
});

// Compound indexes for better query performance
callbackSchema.index({ resultCode: 1, createdAt: -1 });
callbackSchema.index({ phoneNumber: 1, createdAt: -1 });
callbackSchema.index({ orderId: 1, createdAt: -1 });

module.exports = mongoose.model('Callback', callbackSchema);