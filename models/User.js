const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    unique: true,
    validate: {
      validator: function(v) {
        // Accept Kenyan formats: +254XXXXXXXXX, 254XXXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX
        const kenyanPhoneRegex = /^(\+254|254|0)(7|1)\d{8}$/;
        return kenyanPhoneRegex.test(v.replace(/\s+/g, ''));
      },
      message: 'Please enter a valid Kenyan phone number (e.g., +254700000000, 254700000000, or 0700000000)'
    }
  },
  role: {
    type: String,
    enum: ['customer', 'admin', 'merchant'],
    default: 'customer'
  },
  verified: {
    email: {
      type: Boolean,
      default: false
    },
    phone: {
      type: Boolean,
      default: false
    }
  },
  profile: {
    avatar: String,
    dateOfBirth: Date,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  preferences: {
    currency: {
      type: String,
      default: 'KES'
    },
    language: {
      type: String,
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true }
    }
  },
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    twoFactorSecret: String,
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'pending'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'security.emailVerificationToken': 1 });
userSchema.index({ 'security.passwordResetToken': 1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.security.lockUntil && this.security.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Instance method to generate JWT token
userSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    name: this.name,
    role: this.role
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || 'payment-gateway-secret-key',
    { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: 'payment-gateway',
      audience: 'payment-gateway-users'
    }
  );
};

// Instance method to generate refresh token
userSchema.methods.generateRefreshToken = function() {
  const payload = {
    id: this._id,
    type: 'refresh'
  };

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET || 'payment-gateway-refresh-secret',
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
      issuer: 'payment-gateway',
      audience: 'payment-gateway-users'
    }
  );
};

// Instance method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.security.lockUntil && this.security.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'security.lockUntil': 1 },
      $set: { 'security.loginAttempts': 1 }
    });
  }

  const updates = { $inc: { 'security.loginAttempts': 1 } };

  // Lock account after 5 failed attempts for 2 hours
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours

  if (this.security.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { 'security.lockUntil': Date.now() + lockTime };
  }

  return this.updateOne(updates);
};

// Instance method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { 
      'security.loginAttempts': 1,
      'security.lockUntil': 1
    },
    $set: {
      'security.lastLogin': new Date()
    }
  });
};

// Static method to find by credentials
userSchema.statics.findByCredentials = async function(email, password) {
  const user = await this.findOne({ 
    email: email.toLowerCase() 
  }).select('+password');

  if (!user) {
    throw new Error('Invalid login credentials');
  }

  // Check if account is locked
  if (user.isLocked) {
    // Increment login attempts for locked accounts
    await user.incLoginAttempts();
    throw new Error('Account is temporarily locked due to too many failed login attempts');
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    // Increment login attempts on failed password
    await user.incLoginAttempts();
    throw new Error('Invalid login credentials');
  }

  // Reset login attempts on successful login
  await user.resetLoginAttempts();

  return user;
};

// Static method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const token = jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET || 'payment-gateway-secret-key',
    { expiresIn: '24h' }
  );

  this.security.emailVerificationToken = token;
  this.security.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return token;
};

// Static method to generate password reset token
userSchema.methods.generatePasswordResetToken = function() {
  const token = jwt.sign(
    { id: this._id, email: this.email, type: 'password-reset' },
    process.env.JWT_SECRET || 'payment-gateway-secret-key',
    { expiresIn: '1h' }
  );

  this.security.passwordResetToken = token;
  this.security.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  return token;
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  
  delete user.password;
  delete user.security.twoFactorSecret;
  delete user.security.passwordResetToken;
  delete user.security.emailVerificationToken;
  
  return user;
};

module.exports = mongoose.model('User', userSchema);