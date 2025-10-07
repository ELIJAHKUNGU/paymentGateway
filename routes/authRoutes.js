const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const router = express.Router();

// Import controllers
const {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  changePassword,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  deleteAccount
} = require('../controllers/authController');

// Import middleware
const { authenticate, authorize, requireVerification } = require('../middleware/auth');
const {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateEmailVerification,
  validatePasswordResetRequest,
  validatePasswordReset
} = require('../middleware/validation');

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs per IP
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset attempts per hour per IP
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const profileUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 profile updates per hour per IP
  message: {
    success: false,
    message: 'Too many profile update attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes (no authentication required)
// @route   POST /api/v1/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter, validateRegistration, register);

// @route   POST /api/v1/auth/login
// @desc    Login user
// @access  Public
router.post('/login', authLimiter, validateLogin, login);

// @route   POST /api/v1/auth/refresh
// @desc    Refresh access token
// @access  Public (requires refresh token)
router.post('/refresh', refreshToken);

// @route   POST /api/v1/auth/verify-email
// @desc    Verify user email
// @access  Public
router.post('/verify-email', validateEmailVerification, verifyEmail);

// @route   POST /api/v1/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', passwordResetLimiter, validatePasswordResetRequest, forgotPassword);

// @route   POST /api/v1/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', passwordResetLimiter, validatePasswordReset, resetPassword);

// Protected routes (authentication required)
// @route   POST /api/v1/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, logout);

// @route   GET /api/v1/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticate, getMe);

// @route   PUT /api/v1/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, profileUpdateLimiter, validateProfileUpdate, updateProfile);

// @route   PUT /api/v1/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', authenticate, authLimiter, validatePasswordChange, changePassword);

// @route   DELETE /api/v1/auth/account
// @desc    Delete user account
// @access  Private
router.delete('/account', authenticate, deleteAccount);

// Admin routes (admin authorization required)
// @route   GET /api/v1/auth/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = '-createdAt', search, status, role } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (role) {
      filter.role = role;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const users = await User.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -security.twoFactorSecret');

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalUsers: total,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving users'
    });
  }
});

// @route   GET /api/v1/auth/users/:id
// @desc    Get user by ID (admin only)
// @access  Private/Admin
router.get('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -security.twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user'
    });
  }
});

// @route   PUT /api/v1/auth/users/:id/status
// @desc    Update user status (admin only)
// @access  Private/Admin
router.put('/users/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: active, inactive, suspended, pending'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    ).select('-password -security.twoFactorSecret');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User status updated successfully',
      data: user
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user status'
    });
  }
});

// @route   DELETE /api/v1/auth/users/:id
// @desc    Delete user (admin only)
// @access  Private/Admin
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deletion of other admin users
    if (user.role === 'admin' && req.user.id !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete another admin user'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

// @route   GET /api/v1/auth/stats
// @desc    Get authentication statistics (admin only)
// @access  Private/Admin
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const pendingUsers = await User.countDocuments({ status: 'pending' });
    const suspendedUsers = await User.countDocuments({ status: 'suspended' });
    const verifiedUsers = await User.countDocuments({ 'verified.email': true });

    // Users registered in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsers = await User.countDocuments({ 
      createdAt: { $gte: thirtyDaysAgo } 
    });

    // Role distribution
    const roleStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        pendingUsers,
        suspendedUsers,
        verifiedUsers,
        newUsers,
        roleDistribution: roleStats.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {})
      }
    });

  } catch (error) {
    console.error('Get auth stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving authentication statistics'
    });
  }
});

module.exports = router;