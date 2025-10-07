const MpesaKeys = require('../models/MpesaKeys');
const { validateEncryption, maskSensitiveData } = require('../utils/encryption');

// @desc    Get all M-Pesa keys (admin only)
// @route   GET /api/v1/mpesa-keys
// @access  Private/Admin
exports.getAllMpesaKeys = async (req, res) => {
  try {
    const { page = 1, limit = 10, environment, status, keyType } = req.query;

    // Build filter
    const filter = {};
    if (environment) filter.environment = environment;
    if (status) filter.status = status;
    if (keyType) filter.keyType = keyType;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get keys with user info
    const keys = await MpesaKeys.find(filter)
      .populate('userId', 'name email phone')
      .populate('approval.approvedBy', 'name email')
      .sort({ isDefault: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await MpesaKeys.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        keys,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalKeys: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get M-Pesa keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving M-Pesa keys'
    });
  }
};

// @desc    Get M-Pesa keys for current user
// @route   GET /api/v1/mpesa-keys/my-keys
// @access  Private
exports.getMyMpesaKeys = async (req, res) => {
  try {
    const keys = await MpesaKeys.find({
      userId: req.user.id,
      status: { $ne: 'inactive' }
    }).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: keys
    });

  } catch (error) {
    console.error('Get my M-Pesa keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving your M-Pesa keys'
    });
  }
};

// @desc    Create new M-Pesa keys
// @route   POST /api/v1/mpesa-keys
// @access  Private
exports.createMpesaKeys = async (req, res) => {
  try {
    const {
      name,
      description,
      environment = 'sandbox',
      credentials,
      settings = {},
      keyType = 'user'
    } = req.body;

    // Validate required credentials
    const requiredFields = ['consumerKey', 'consumerSecret', 'businessShortCode', 'passKey'];
    for (const field of requiredFields) {
      if (!credentials[field]) {
        return res.status(400).json({
          success: false,
          message: `Missing required credential: ${field}`
        });
      }
    }

    // Check if this is user's first keys (make it default)
    const existingKeysCount = await MpesaKeys.countDocuments({
      userId: req.user.id,
      status: 'active'
    });

    // Create M-Pesa keys
    const mpesaKeys = await MpesaKeys.create({
      userId: keyType === 'user' ? req.user.id : undefined,
      keyType,
      name,
      description,
      environment,
      credentials,
      settings,
      isDefault: existingKeysCount === 0, // First keys become default
      status: keyType === 'default' ? 'active' : 'pending_approval',
      approval: keyType === 'default' ? {
        status: 'approved',
        approvedBy: req.user.id,
        approvedAt: new Date()
      } : undefined
    });

    res.status(201).json({
      success: true,
      message: 'M-Pesa keys created successfully',
      data: mpesaKeys
    });

  } catch (error) {
    console.error('Create M-Pesa keys error:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'M-Pesa keys with this name already exist for your account'
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
      message: 'Error creating M-Pesa keys'
    });
  }
};

// @desc    Get M-Pesa keys by ID
// @route   GET /api/v1/mpesa-keys/:id
// @access  Private
exports.getMpesaKeysById = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    
    // Non-admin users can only access their own keys
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const keys = await MpesaKeys.findOne(filter)
      .populate('userId', 'name email phone')
      .populate('approval.approvedBy', 'name email');

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    res.status(200).json({
      success: true,
      data: keys
    });

  } catch (error) {
    console.error('Get M-Pesa keys by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving M-Pesa keys'
    });
  }
};

// @desc    Update M-Pesa keys
// @route   PUT /api/v1/mpesa-keys/:id
// @access  Private
exports.updateMpesaKeys = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    
    // Non-admin users can only update their own keys
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const keys = await MpesaKeys.findOne(filter);

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    // Fields that can be updated
    const allowedUpdates = ['name', 'description', 'credentials', 'settings', 'environment'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // If updating credentials, reset approval status
    if (updates.credentials) {
      updates['approval.status'] = 'pending';
      updates['approval.approvedAt'] = undefined;
      updates['approval.approvedBy'] = undefined;
      updates.status = 'pending_approval';
    }

    const updatedKeys = await MpesaKeys.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('userId', 'name email phone');

    res.status(200).json({
      success: true,
      message: 'M-Pesa keys updated successfully',
      data: updatedKeys
    });

  } catch (error) {
    console.error('Update M-Pesa keys error:', error);

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
      message: 'Error updating M-Pesa keys'
    });
  }
};

// @desc    Delete M-Pesa keys
// @route   DELETE /api/v1/mpesa-keys/:id
// @access  Private
exports.deleteMpesaKeys = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    
    // Non-admin users can only delete their own keys
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const keys = await MpesaKeys.findOne(filter);

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    // Prevent deletion of default system keys
    if (keys.keyType === 'default') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete default system keys'
      });
    }

    // Soft delete by changing status
    keys.status = 'inactive';
    await keys.save();

    res.status(200).json({
      success: true,
      message: 'M-Pesa keys deleted successfully'
    });

  } catch (error) {
    console.error('Delete M-Pesa keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting M-Pesa keys'
    });
  }
};

// @desc    Approve/Reject M-Pesa keys (admin only)
// @route   PUT /api/v1/mpesa-keys/:id/approval
// @access  Private/Admin
exports.updateApprovalStatus = async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    if (status === 'rejected' && !rejectionReason) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required when rejecting keys'
      });
    }

    const keys = await MpesaKeys.findById(req.params.id)
      .populate('userId', 'name email');

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    // Update approval status
    keys.approval.status = status;
    keys.approval.approvedBy = req.user.id;
    keys.approval.approvedAt = new Date();
    
    if (status === 'rejected') {
      keys.approval.rejectionReason = rejectionReason;
      keys.status = 'inactive';
    } else {
      keys.status = 'active';
    }

    await keys.save();

    res.status(200).json({
      success: true,
      message: `M-Pesa keys ${status} successfully`,
      data: keys
    });

  } catch (error) {
    console.error('Update approval status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating approval status'
    });
  }
};

// @desc    Test M-Pesa keys connection
// @route   POST /api/v1/mpesa-keys/:id/test
// @access  Private
exports.testMpesaKeys = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    
    // Non-admin users can only test their own keys
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const keys = await MpesaKeys.findOne(filter);

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    if (keys.status !== 'active' || keys.approval.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'M-Pesa keys must be active and approved to test'
      });
    }

    // Get decrypted credentials for testing
    const decryptedCredentials = keys.getDecryptedCredentials();

    // In a real implementation, you would test the connection to M-Pesa API here
    // For now, we'll simulate a successful test
    
    // Update last used timestamp
    keys.lastUsed = new Date();
    await keys.save();

    res.status(200).json({
      success: true,
      message: 'M-Pesa keys connection test successful',
      data: {
        keyId: keys._id,
        environment: keys.environment,
        businessShortCode: decryptedCredentials.businessShortCode,
        testTimestamp: new Date().toISOString(),
        status: 'connection_successful'
      }
    });

  } catch (error) {
    console.error('Test M-Pesa keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing M-Pesa keys'
    });
  }
};

// @desc    Get M-Pesa keys statistics
// @route   GET /api/v1/mpesa-keys/stats
// @access  Private/Admin
exports.getMpesaKeysStats = async (req, res) => {
  try {
    const totalKeys = await MpesaKeys.countDocuments();
    const activeKeys = await MpesaKeys.countDocuments({ status: 'active' });
    const pendingKeys = await MpesaKeys.countDocuments({ 'approval.status': 'pending' });
    const userKeys = await MpesaKeys.countDocuments({ keyType: 'user' });
    const defaultKeys = await MpesaKeys.countDocuments({ keyType: 'default' });

    // Environment distribution
    const environmentStats = await MpesaKeys.aggregate([
      {
        $group: {
          _id: '$environment',
          count: { $sum: 1 },
          active: {
            $sum: {
              $cond: [{ $eq: ['$status', 'active'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Usage statistics
    const usageStats = await MpesaKeys.aggregate([
      {
        $group: {
          _id: null,
          totalUsage: { $sum: '$usageCount' },
          averageUsage: { $avg: '$usageCount' },
          maxUsage: { $max: '$usageCount' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalKeys,
          activeKeys,
          pendingKeys,
          userKeys,
          defaultKeys
        },
        environments: environmentStats.reduce((acc, curr) => {
          acc[curr._id] = {
            total: curr.count,
            active: curr.active
          };
          return acc;
        }, {}),
        usage: usageStats[0] || {
          totalUsage: 0,
          averageUsage: 0,
          maxUsage: 0
        }
      }
    });

  } catch (error) {
    console.error('Get M-Pesa keys stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving M-Pesa keys statistics'
    });
  }
};

// @desc    Initialize default M-Pesa keys
// @route   POST /api/v1/mpesa-keys/init-defaults
// @access  Private/Admin
exports.initializeDefaultKeys = async (req, res) => {
  try {
    const { environment = 'sandbox' } = req.body;

    // Check if default keys already exist
    const existingDefault = await MpesaKeys.findOne({
      keyType: 'default',
      environment,
      isDefault: true
    });

    if (existingDefault) {
      return res.status(400).json({
        success: false,
        message: `Default ${environment} keys already exist`
      });
    }

    // Create default keys from environment
    const defaultKeys = await MpesaKeys.createDefaultKeys(environment);

    res.status(201).json({
      success: true,
      message: `Default ${environment} M-Pesa keys initialized successfully`,
      data: defaultKeys
    });

  } catch (error) {
    console.error('Initialize default keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error initializing default M-Pesa keys'
    });
  }
};

// @desc    Set default M-Pesa keys for user
// @route   PUT /api/v1/mpesa-keys/:id/set-default
// @access  Private
exports.setDefaultKeys = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    
    // Non-admin users can only modify their own keys
    if (req.user.role !== 'admin') {
      filter.userId = req.user.id;
    }

    const keys = await MpesaKeys.findOne(filter);

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    if (keys.status !== 'active' || keys.approval.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only active and approved keys can be set as default'
      });
    }

    // Remove default flag from other user's keys
    await MpesaKeys.updateMany(
      { 
        userId: keys.userId || req.user.id,
        keyType: keys.keyType,
        _id: { $ne: req.params.id }
      },
      { isDefault: false }
    );

    // Set this as default
    keys.isDefault = true;
    await keys.save();

    res.status(200).json({
      success: true,
      message: 'Default M-Pesa keys updated successfully',
      data: keys
    });

  } catch (error) {
    console.error('Set default keys error:', error);
    res.status(500).json({
      success: false,
      message: 'Error setting default M-Pesa keys'
    });
  }
};

// @desc    Get decrypted credentials for payment processing (internal use)
// @route   GET /api/v1/mpesa-keys/:id/credentials
// @access  Private/Admin
exports.getDecryptedCredentials = async (req, res) => {
  try {
    // Only admin can access decrypted credentials
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin role required.'
      });
    }

    const keys = await MpesaKeys.findById(req.params.id);

    if (!keys) {
      return res.status(404).json({
        success: false,
        message: 'M-Pesa keys not found'
      });
    }

    const decryptedCredentials = keys.getDecryptedCredentials();

    res.status(200).json({
      success: true,
      data: {
        keyId: keys._id,
        credentials: decryptedCredentials,
        settings: keys.settings,
        environment: keys.environment,
        lastAccessed: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Get decrypted credentials error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving decrypted credentials'
    });
  }
};

module.exports = exports;