const mongoose = require('mongoose');

const userTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  paymentMethodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    required: false
  },
  amount: {
    type: Number,
    required: true,
    min: [1, 'Amount must be greater than 0']
  },
  currency: {
    type: String,
    enum: ['KES', 'USD', 'EUR', 'GBP'],
    default: 'KES',
    required: true
  },
  fees: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'],
    default: 'pending',
    index: true
  },
  type: {
    type: String,
    enum: ['payment', 'refund', 'withdrawal', 'deposit', 'transfer'],
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true // e.g., 'M-Pesa', 'Visa Card', 'Bank Transfer'
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  reference: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  externalReference: {
    type: String, // Reference from external payment provider
    sparse: true
  },
  recipient: {
    name: String,
    account: String,
    email: String,
    phone: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Payment provider specific data
  providerData: {
    mpesa: {
      merchantRequestId: String,
      checkoutRequestId: String,
      mpesaReceiptNumber: String,
      transactionDate: String,
      phoneNumber: String
    },
    card: {
      cardBrand: String,
      last4: String,
      authCode: String,
      avsResult: String,
      cvvResult: String
    },
    bank: {
      bankCode: String,
      accountNumber: String,
      routingNumber: String,
      clearingCode: String
    }
  },
  // Financial reconciliation
  reconciliation: {
    reconciledAt: Date,
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    batchId: String,
    settlementDate: Date
  },
  // Error tracking
  errorLog: [{
    code: String,
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  // Audit trail
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    reason: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userTransactionSchema.index({ userId: 1, createdAt: -1 });
userTransactionSchema.index({ userId: 1, status: 1 });
userTransactionSchema.index({ status: 1, createdAt: -1 });
userTransactionSchema.index({ type: 1, createdAt: -1 });
userTransactionSchema.index({ currency: 1, createdAt: -1 });
userTransactionSchema.index({ reference: 1 }, { unique: true });

// Virtual for formatted amount
userTransactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: this.currency,
    minimumFractionDigits: 0,
  }).format(this.amount);
});

// Virtual for total amount including fees
userTransactionSchema.virtual('totalAmount').get(function() {
  return this.amount + this.fees;
});

// Pre-save middleware to update status history
userTransactionSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      reason: `Status changed to ${this.status}`
    });
  }
  next();
});

// Static method to get user stats
userTransactionSchema.statics.getUserStats = async function(userId, period = 30) {
  const periodStart = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: periodStart }
      }
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalFees: { $sum: '$fees' }
      }
    }
  ]);

  const totalTransactions = await this.countDocuments({ userId });
  const totalAmount = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);

  return {
    totalTransactions,
    totalAmount: totalAmount[0]?.total || 0,
    periodStats: stats,
    period
  };
};

module.exports = mongoose.model('UserTransaction', userTransactionSchema);