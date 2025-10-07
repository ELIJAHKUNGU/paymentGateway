const mongoose = require('mongoose');
const { encryptMpesaCredentials, decryptMpesaCredentials, maskSensitiveData } = require('../utils/encryption');

const mpesaKeysSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.keyType === 'user';
    }
  },
  keyType: {
    type: String,
    enum: ['default', 'user', 'admin'],
    required: true,
    default: 'user'
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 255
  },
  environment: {
    type: String,
    enum: ['sandbox', 'production'],
    required: true,
    default: 'sandbox'
  },
  // Encrypted credentials
  credentials: {
    consumerKey: {
      type: String,
      required: true
    },
    consumerSecret: {
      type: String,
      required: true
    },
    businessShortCode: {
      type: String,
      required: true
    },
    passKey: {
      type: String,
      required: true
    }
  },
  // Configuration settings
  settings: {
    callbackUrl: String,
    validationUrl: String,
    baseUrl: {
      type: String,
      default: 'https://api.safaricom.co.ke'
    },
    timeout: {
      type: Number,
      default: 30000
    }
  },
  // Status and usage tracking
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending_approval', 'expired'],
    default: 'pending_approval'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  lastUsed: Date,
  usageCount: {
    type: Number,
    default: 0
  },
  // Approval and verification
  approval: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: Date,
    rejectionReason: String
  },
  // Rate limiting
  limits: {
    dailyLimit: {
      type: Number,
      default: 1000
    },
    monthlyLimit: {
      type: Number,
      default: 30000
    },
    currentDailyUsage: {
      type: Number,
      default: 0
    },
    currentMonthlyUsage: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance and uniqueness
mpesaKeysSchema.index({ userId: 1, name: 1 }, { unique: true });
mpesaKeysSchema.index({ keyType: 1, isDefault: 1 });
mpesaKeysSchema.index({ status: 1 });
mpesaKeysSchema.index({ environment: 1 });
mpesaKeysSchema.index({ 'credentials.businessShortCode': 1 });

// Ensure only one default key per user/type
mpesaKeysSchema.index(
  { userId: 1, keyType: 1, isDefault: 1 },
  { 
    unique: true, 
    partialFilterExpression: { isDefault: true }
  }
);

// Virtual for masked credentials display
mpesaKeysSchema.virtual('maskedCredentials').get(function() {
  return {
    consumerKey: maskSensitiveData(this.credentials.consumerKey),
    consumerSecret: maskSensitiveData(this.credentials.consumerSecret, 0), // Fully masked
    businessShortCode: this.credentials.businessShortCode, // Not sensitive
    passKey: maskSensitiveData(this.credentials.passKey, 0) // Fully masked
  };
});

// Virtual for usage percentage
mpesaKeysSchema.virtual('usagePercentage').get(function() {
  if (this.limits.monthlyLimit === 0) return 0;
  return Math.round((this.limits.currentMonthlyUsage / this.limits.monthlyLimit) * 100);
});

// Pre-save middleware to encrypt credentials
mpesaKeysSchema.pre('save', function(next) {
  // Only encrypt if credentials have been modified
  if (this.isModified('credentials')) {
    try {
      // Check if already encrypted (has the encrypted format)
      const isAlreadyEncrypted = this.credentials.consumerKey && 
                                 this.credentials.consumerKey.includes('U2FsdGVkX1');
      
      if (!isAlreadyEncrypted) {
        this.credentials = encryptMpesaCredentials(this.credentials);
      }
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

// Instance method to get decrypted credentials
mpesaKeysSchema.methods.getDecryptedCredentials = function() {
  try {
    return decryptMpesaCredentials(this.credentials);
  } catch (error) {
    throw new Error('Failed to decrypt credentials');
  }
};

// Instance method to update usage
mpesaKeysSchema.methods.incrementUsage = async function(amount = 1) {
  this.usageCount += amount;
  this.limits.currentDailyUsage += amount;
  this.limits.currentMonthlyUsage += amount;
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to reset daily usage
mpesaKeysSchema.methods.resetDailyUsage = function() {
  this.limits.currentDailyUsage = 0;
  return this.save();
};

// Instance method to reset monthly usage
mpesaKeysSchema.methods.resetMonthlyUsage = function() {
  this.limits.currentMonthlyUsage = 0;
  return this.save();
};

// Static method to find active keys for user
mpesaKeysSchema.statics.findActiveForUser = function(userId, environment = 'sandbox') {
  return this.find({
    userId,
    status: 'active',
    environment,
    'approval.status': 'approved'
  }).sort({ isDefault: -1, createdAt: -1 });
};

// Static method to get default system keys
mpesaKeysSchema.statics.getDefaultKeys = function(environment = 'sandbox') {
  return this.findOne({
    keyType: 'default',
    status: 'active',
    environment,
    isDefault: true
  });
};

// Static method to create default system keys
mpesaKeysSchema.statics.createDefaultKeys = async function(environment = 'sandbox') {
  // Check if default keys already exist
  const existing = await this.findOne({ keyType: 'default', environment });
  if (existing) {
    return existing;
  }

  // Create default keys from environment variables
  const defaultKeys = new this({
    keyType: 'default',
    name: `Default ${environment.charAt(0).toUpperCase() + environment.slice(1)} Keys`,
    description: `System default M-Pesa keys for ${environment} environment`,
    environment,
    credentials: {
      consumerKey: process.env.safaricomconsumerKey,
      consumerSecret: process.env.safaricomconsumerSecret,
      businessShortCode: process.env.safaricombusinessShortCode,
      passKey: process.env.safaricompassKey
    },
    settings: {
      callbackUrl: process.env.safaricom_callbackurl,
      baseUrl: process.env.safaricom_baseurl || 'https://api.safaricom.co.ke'
    },
    status: 'active',
    isDefault: true,
    approval: {
      status: 'approved',
      approvedAt: new Date()
    }
  });

  return defaultKeys.save();
};

// Remove sensitive data from JSON output
mpesaKeysSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Replace encrypted credentials with masked versions
  if (obj.credentials) {
    obj.credentials = this.maskedCredentials;
  }
  
  // Add decryption status for debugging
  obj.isEncrypted = true;
  
  return obj;
};

// Pre-remove middleware to prevent deletion of default keys
mpesaKeysSchema.pre(['deleteOne', 'findOneAndDelete'], function(next) {
  if (this.getQuery().keyType === 'default') {
    return next(new Error('Cannot delete default system keys'));
  }
  next();
});

module.exports = mongoose.model('MpesaKeys', mpesaKeysSchema);