const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Import controllers
const {
  getAllMpesaKeys,
  getMyMpesaKeys,
  createMpesaKeys,
  getMpesaKeysById,
  updateMpesaKeys,
  deleteMpesaKeys,
  updateApprovalStatus,
  testMpesaKeys,
  getMpesaKeysStats,
  initializeDefaultKeys,
  setDefaultKeys,
  getDecryptedCredentials
} = require('../controllers/mpesaKeysController');

// Import middleware
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Rate limiting for key operations
const keysLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 key operations per 15 minutes
  message: {
    success: false,
    message: 'Too many key management requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation schemas
const validateCreateKeys = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Name must be between 3 and 100 characters'),

  body('environment')
    .isIn(['sandbox', 'production'])
    .withMessage('Environment must be either sandbox or production'),

  body('credentials.consumerKey')
    .notEmpty()
    .withMessage('Consumer Key is required')
    .isLength({ min: 10 })
    .withMessage('Consumer Key must be at least 10 characters'),

  body('credentials.consumerSecret')
    .notEmpty()
    .withMessage('Consumer Secret is required')
    .isLength({ min: 10 })
    .withMessage('Consumer Secret must be at least 10 characters'),

  body('credentials.businessShortCode')
    .notEmpty()
    .withMessage('Business Short Code is required')
    .isNumeric()
    .withMessage('Business Short Code must be numeric'),

  body('credentials.passKey')
    .notEmpty()
    .withMessage('Pass Key is required')
    .isLength({ min: 10 })
    .withMessage('Pass Key must be at least 10 characters'),

  body('settings.callbackUrl')
    .optional()
    .isURL()
    .withMessage('Callback URL must be a valid URL'),

  handleValidationErrors
];

const validateUpdateApproval = [
  body('status')
    .isIn(['approved', 'rejected'])
    .withMessage('Status must be either approved or rejected'),

  body('rejectionReason')
    .if(body('status').equals('rejected'))
    .notEmpty()
    .withMessage('Rejection reason is required when rejecting keys'),

  handleValidationErrors
];

const validateIdParam = [
  param('id')
    .isMongoId()
    .withMessage('Invalid key ID'),

  handleValidationErrors
];

// Apply authentication to all routes
router.use(authenticate);

// Public user routes (users can manage their own keys)
// @route   GET /api/v1/mpesa-keys/my-keys
// @desc    Get current user's M-Pesa keys
// @access  Private
router.get('/my-keys', getMyMpesaKeys);

// @route   POST /api/v1/mpesa-keys
// @desc    Create new M-Pesa keys
// @access  Private
router.post('/', keysLimiter, validateCreateKeys, createMpesaKeys);

// @route   GET /api/v1/mpesa-keys/:id
// @desc    Get M-Pesa keys by ID
// @access  Private (own keys) / Admin (any keys)
router.get('/:id', validateIdParam, getMpesaKeysById);

// @route   PUT /api/v1/mpesa-keys/:id
// @desc    Update M-Pesa keys
// @access  Private (own keys) / Admin (any keys)
router.put('/:id', validateIdParam, keysLimiter, updateMpesaKeys);

// @route   DELETE /api/v1/mpesa-keys/:id
// @desc    Delete M-Pesa keys
// @access  Private (own keys) / Admin (any keys)
router.delete('/:id', validateIdParam, deleteMpesaKeys);

// @route   PUT /api/v1/mpesa-keys/:id/set-default
// @desc    Set M-Pesa keys as default
// @access  Private (own keys) / Admin (any keys)
router.put('/:id/set-default', validateIdParam, setDefaultKeys);

// @route   POST /api/v1/mpesa-keys/:id/test
// @desc    Test M-Pesa keys connection
// @access  Private (own keys) / Admin (any keys)
router.post('/:id/test', validateIdParam, testMpesaKeys);

// Admin-only routes
// @route   GET /api/v1/mpesa-keys
// @desc    Get all M-Pesa keys (admin only)
// @access  Private/Admin
router.get('/', authorize('admin'), getAllMpesaKeys);

// @route   GET /api/v1/mpesa-keys/stats
// @desc    Get M-Pesa keys statistics (admin only)
// @access  Private/Admin
router.get('/stats', authorize('admin'), getMpesaKeysStats);

// @route   PUT /api/v1/mpesa-keys/:id/approval
// @desc    Approve or reject M-Pesa keys (admin only)
// @access  Private/Admin
router.put('/:id/approval', authorize('admin'), validateIdParam, validateUpdateApproval, updateApprovalStatus);

// @route   POST /api/v1/mpesa-keys/init-defaults
// @desc    Initialize default M-Pesa keys (admin only)
// @access  Private/Admin
router.post('/init-defaults', authorize('admin'), initializeDefaultKeys);

// @route   GET /api/v1/mpesa-keys/:id/credentials
// @desc    Get decrypted credentials (admin only - for system use)
// @access  Private/Admin
router.get('/:id/credentials', authorize('admin'), validateIdParam, getDecryptedCredentials);

// Bulk operations (admin only)
// @route   PUT /api/v1/mpesa-keys/bulk/approval
// @desc    Bulk approve/reject M-Pesa keys (admin only)
// @access  Private/Admin
router.put('/bulk/approval', authorize('admin'), async (req, res) => {
  try {
    const { keyIds, status, rejectionReason } = req.body;

    if (!Array.isArray(keyIds) || keyIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Key IDs array is required'
      });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either approved or rejected'
      });
    }

    // Update multiple keys
    const updateData = {
      'approval.status': status,
      'approval.approvedBy': req.user.id,
      'approval.approvedAt': new Date(),
      status: status === 'approved' ? 'active' : 'inactive'
    };

    if (status === 'rejected' && rejectionReason) {
      updateData['approval.rejectionReason'] = rejectionReason;
    }

    const result = await MpesaKeys.updateMany(
      { _id: { $in: keyIds } },
      updateData
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} M-Pesa keys ${status} successfully`,
      data: {
        updated: result.modifiedCount,
        total: keyIds.length
      }
    });

  } catch (error) {
    console.error('Bulk approval error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing bulk approval'
    });
  }
});

module.exports = router;