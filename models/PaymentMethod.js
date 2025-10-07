const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['mpesa', 'card', 'bank', 'paypal'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  details: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  verified: {
    type: Boolean,
    default: false
  },
  lastUsed: {
    type: Date
  },
  metadata: {
    // For M-Pesa
    phoneNumber: String,
    
    // For Cards
    last4: String,
    brand: String,
    expiryMonth: Number,
    expiryYear: Number,
    holderName: String,
    
    // For Bank
    accountNumber: String,
    bankName: String,
    routingNumber: String,
    
    // For PayPal
    email: String,
    
    // Generic
    country: String,
    currency: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'blocked'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
paymentMethodSchema.index({ userId: 1 });
paymentMethodSchema.index({ userId: 1, isDefault: 1 });
paymentMethodSchema.index({ type: 1 });

// Ensure only one default payment method per user
paymentMethodSchema.pre('save', async function(next) {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other payment methods for this user
    await this.constructor.updateMany(
      { 
        userId: this.userId, 
        _id: { $ne: this._id } 
      },
      { isDefault: false }
    );
  }
  next();
});

// Virtual for masked details
paymentMethodSchema.virtual('maskedDetails').get(function() {
  switch (this.type) {
    case 'card':
      return `**** **** **** ${this.metadata.last4}`;
    case 'mpesa':
      const phone = this.metadata.phoneNumber;
      return phone ? `${phone.substring(0, 4)}****${phone.substring(phone.length - 3)}` : this.details;
    case 'bank':
      return `****${this.metadata.accountNumber?.substring(this.metadata.accountNumber.length - 4)}`;
    default:
      return this.details;
  }
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);