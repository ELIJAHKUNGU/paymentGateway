const mongoose = require('mongoose');

const gatewayTransactionSchema = new mongoose.Schema({
    // Transaction Initiation Data
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
    transactionDesc: {
        type: String,
        default: 'Payment for Order'
    },
    
    // Safaricom Request Data
    businessShortCode: {
        type: String,
        default: null
    },
    timestamp: {
        type: String,
        required: true
    },
    transactionType: {
        type: String,
        default: 'CustomerPayBillOnline'
    },
    
    // Transaction Status
    status: {
        type: String,
        enum: ['initiated', 'completed', 'failed', 'pending', 'timeout'],
        default: 'initiated',
        index: true
    },
    
    // STK Push Response Data
    merchantRequestId: {
        type: String,
        default: null,
        index: true
    },
    checkoutRequestId: {
        type: String,
        default: null,
        index: true
    },
    responseCode: {
        type: String,
        default: null
    },
    responseDescription: {
        type: String,
        default: null
    },
    customerMessage: {
        type: String,
        default: null
    },
    
    // Callback Data
    callbackReceived: {
        type: Boolean,
        default: false,
        index: true
    },
    callbackResultCode: {
        type: String,
        default: null,
        index: true
    },
    callbackResultDesc: {
        type: String,
        default: null
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
    callbackReceivedAt: {
        type: Date,
        default: null
    },
    
    // Additional Metadata
    rawStkResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    rawCallbackData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    
    // Processing Information
    processingErrors: [{
        error: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Client Information
    clientIp: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    collection: 'gateway_transactions'
});

// Compound indexes for better query performance
gatewayTransactionSchema.index({ status: 1, createdAt: -1 });
gatewayTransactionSchema.index({ phoneNumber: 1, createdAt: -1 });
gatewayTransactionSchema.index({ bankName: 1, status: 1 });
gatewayTransactionSchema.index({ callbackReceived: 1, status: 1 });
gatewayTransactionSchema.index({ mpesaReceiptNumber: 1 }, { sparse: true });
gatewayTransactionSchema.index({ merchantRequestId: 1 }, { sparse: true });
gatewayTransactionSchema.index({ checkoutRequestId: 1 }, { sparse: true });

// Virtual for success status
gatewayTransactionSchema.virtual('isSuccessful').get(function() {
    return this.status === 'completed' && this.callbackResultCode === '0';
});

// Virtual for transaction age
gatewayTransactionSchema.virtual('ageInMinutes').get(function() {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60));
});

// Static method to get transaction statistics
gatewayTransactionSchema.statics.getStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalAmount: { $sum: '$amount' }
            }
        }
    ]);
    
    const total = await this.countDocuments();
    const completed = stats.find(s => s._id === 'completed')?.count || 0;
    const failed = stats.find(s => s._id === 'failed')?.count || 0;
    const pending = stats.find(s => s._id === 'initiated')?.count || 0;
    
    return {
        total,
        completed,
        failed,
        pending,
        successRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
        breakdown: stats
    };
};

// Static method to find transactions by phone number
gatewayTransactionSchema.statics.findByPhoneNumber = function(phoneNumber, limit = 50) {
    return this.find({ phoneNumber })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('-rawStkResponse -rawCallbackData');
};

// Static method to find pending transactions older than specified minutes
gatewayTransactionSchema.statics.findStaleTransactions = function(minutesOld = 30) {
    const cutoffTime = new Date(Date.now() - (minutesOld * 60 * 1000));
    return this.find({
        status: 'initiated',
        createdAt: { $lt: cutoffTime },
        callbackReceived: false
    });
};

module.exports = mongoose.model('GatewayTransaction', gatewayTransactionSchema);