const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const UserTransaction = require('../models/UserTransaction');
const MpesaKeys = require('../models/MpesaKeys');

// @desc    Get user's payment methods
// @route   GET /api/v1/payment-methods
// @access  Private
exports.getPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await PaymentMethod.find({ 
      userId: req.user.id,
      status: { $ne: 'inactive' } // Exclude only inactive methods
    }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: paymentMethods
    });

  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving payment methods'
    });
  }
};

// @desc    Add new payment method
// @route   POST /api/v1/payment-methods
// @access  Private
exports.addPaymentMethod = async (req, res) => {
  try {
    const { type, name, details, metadata } = req.body;

    // Check if this is the user's first payment method (make it default)
    const existingMethods = await PaymentMethod.countDocuments({ 
      userId: req.user.id,
      status: 'active'
    });

    // For M-Pesa, automatically add default credentials from environment
    let enhancedMetadata = { ...metadata };
    let enhancedDetails = details;
    let enhancedName = name;

    if (type === 'mpesa') {
      const fullPhoneNumber = (metadata.countryCode || '+254') + (metadata.phoneNumber || '').replace(/^0/, '');
      
      if (metadata.useCustomCredentials) {
        // Create encrypted M-Pesa keys for the user
        const mpesaKeys = await MpesaKeys.create({
          userId: req.user.id,
          keyType: 'user',
          name: `${req.user.name} M-Pesa Keys`,
          description: `Custom M-Pesa configuration for ${req.user.email}`,
          environment: 'production', // Production environment for all users
          credentials: {
            consumerKey: metadata.consumerKey,
            consumerSecret: metadata.consumerSecret,
            businessShortCode: metadata.businessShortCode,
            passKey: metadata.passKey
          },
          settings: {
            callbackUrl: metadata.callbackUrl
          }
        });

        enhancedMetadata = {
          fullPhoneNumber,
          credentialType: 'custom',
          mpesaKeysId: mpesaKeys._id,
          callbackUrl: metadata.callbackUrl
        };
      } else {
        // Create user-specific keys with default credentials
        const userDefaultKeys = await MpesaKeys.create({
          userId: req.user.id,
          keyType: 'user',
          name: `${req.user.name} Default M-Pesa`,
          description: `Default M-Pesa configuration for ${req.user.email}`,
          environment: 'production',
          credentials: {
            consumerKey: process.env.safaricomconsumerKey,
            consumerSecret: process.env.safaricomconsumerSecret,
            businessShortCode: process.env.safaricombusinessShortCode,
            passKey: process.env.safaricompassKey
          },
          settings: {
            callbackUrl: metadata.callbackUrl || process.env.safaricom_callbackurl
          },
          status: 'active',
          approval: {
            status: 'approved',
            approvedBy: req.user.id,
            approvedAt: new Date()
          }
        });

        enhancedMetadata = {
          fullPhoneNumber,
          credentialType: 'default',
          mpesaKeysId: userDefaultKeys._id,
          callbackUrl: metadata.callbackUrl || process.env.safaricom_callbackurl
        };
      }

      // Auto-generate name and details
      enhancedName = `M-Pesa ${fullPhoneNumber}`;
      enhancedDetails = `M-Pesa Account - ${fullPhoneNumber}`;
    }

    const paymentMethod = await PaymentMethod.create({
      userId: req.user.id,
      type,
      name: enhancedName || `My ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      details: enhancedDetails,
      metadata: enhancedMetadata,
      isDefault: existingMethods === 0, // First method becomes default
      verified: true // Auto-verify for now
    });

    // Remove sensitive data from response
    const responseData = paymentMethod.toObject();
    if (responseData.metadata) {
      delete responseData.metadata.consumerKey;
      delete responseData.metadata.consumerSecret;
      delete responseData.metadata.passKey;
    }

    res.status(201).json({
      success: true,
      message: 'M-Pesa payment method added successfully with default configuration',
      data: responseData
    });

  } catch (error) {
    console.error('Add payment method error:', error);

    if (error.code === 11000) {
      // Duplicate key error
      return res.status(400).json({
        success: false,
        message: 'A payment method with this phone number already exists'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error adding payment method'
    });
  }
};

// @desc    Set default payment method
// @route   PUT /api/v1/payment-methods/:id/default
// @access  Private
exports.setDefaultPaymentMethod = async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user.id,
      status: 'active'
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    // Set this as default (pre-save middleware will handle removing default from others)
    paymentMethod.isDefault = true;
    await paymentMethod.save();

    res.status(200).json({
      success: true,
      message: 'Default payment method updated',
      data: paymentMethod
    });

  } catch (error) {
    console.error('Set default payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating default payment method'
    });
  }
};

// @desc    Remove payment method
// @route   DELETE /api/v1/payment-methods/:id
// @access  Private
exports.removePaymentMethod = async (req, res) => {
  try {
    const paymentMethod = await PaymentMethod.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    // If this was the default method, make another one default
    if (paymentMethod.isDefault) {
      const nextMethod = await PaymentMethod.findOne({
        userId: req.user.id,
        _id: { $ne: req.params.id },
        status: 'active'
      }).sort({ createdAt: -1 });

      if (nextMethod) {
        nextMethod.isDefault = true;
        await nextMethod.save();
      }
    }

    // Soft delete by changing status
    paymentMethod.status = 'inactive';
    await paymentMethod.save();

    res.status(200).json({
      success: true,
      message: 'Payment method removed successfully'
    });

  } catch (error) {
    console.error('Remove payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing payment method'
    });
  }
};

// @desc    Get user's transactions
// @route   GET /api/v1/transactions
// @access  Private
exports.getTransactions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, sort = '-createdAt' } = req.query;

    // Build filter
    const filter = { userId: req.user.id };
    
    if (status) {
      filter.status = status;
    }
    
    if (type) {
      filter.type = type;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get transactions
    const transactions = await UserTransaction.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('paymentMethodId', 'type name details');

    const total = await UserTransaction.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalTransactions: total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving transactions'
    });
  }
};

// @desc    Create new transaction
// @route   POST /api/v1/transactions
// @access  Private
exports.createTransaction = async (req, res) => {
  try {
    const { 
      amount, 
      currency = 'KES', 
      method, 
      description, 
      type = 'payment',
      recipient,
      metadata 
    } = req.body;

    // Find payment method
    let paymentMethodId = null;
    if (method) {
      const paymentMethod = await PaymentMethod.findOne({
        userId: req.user.id,
        $or: [
          { name: method },
          { type: method.toLowerCase() }
        ],
        status: 'active'
      });
      paymentMethodId = paymentMethod?._id;
    }

    // Generate reference
    const reference = `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Calculate fees (2% for demo)
    const fees = Math.round(amount * 0.02);

    const transaction = await UserTransaction.create({
      userId: req.user.id,
      paymentMethodId,
      amount,
      currency,
      fees,
      type,
      method: method || 'Unknown',
      description,
      reference,
      status: 'pending',
      recipient,
      metadata
    });

    // Populate the payment method details
    await transaction.populate('paymentMethodId', 'type name details');

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      data: transaction
    });

  } catch (error) {
    console.error('Create transaction error:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error creating transaction'
    });
  }
};

// @desc    Get transaction by ID
// @route   GET /api/v1/transactions/:id
// @access  Private
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await UserTransaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    }).populate('paymentMethodId', 'type name details');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.status(200).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving transaction'
    });
  }
};

// @desc    Get user stats
// @route   GET /api/v1/stats
// @access  Private
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get basic counts
    const totalTransactions = await UserTransaction.countDocuments({ userId });
    const completedTransactions = await UserTransaction.countDocuments({ 
      userId, 
      status: 'completed' 
    });
    const pendingTransactions = await UserTransaction.countDocuments({ 
      userId, 
      status: 'pending' 
    });

    // Calculate total amount and success rate
    const transactions = await UserTransaction.find({ userId });
    const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const successRate = totalTransactions > 0 ? 
      Math.round((completedTransactions / totalTransactions) * 100 * 10) / 10 : 0;

    // Get monthly volume (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthlyTransactions = await UserTransaction.find({
      userId,
      createdAt: { $gte: thirtyDaysAgo },
      status: 'completed'
    });
    const monthlyVolume = monthlyTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        totalTransactions,
        totalAmount,
        successRate,
        pendingTransactions,
        monthlyVolume
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics'
    });
  }
};

module.exports = exports;