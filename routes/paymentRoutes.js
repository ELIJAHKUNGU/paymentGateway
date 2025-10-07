const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Import controllers
const {
  getPaymentMethods,
  addPaymentMethod,
  setDefaultPaymentMethod,
  removePaymentMethod,
  getTransactions,
  createTransaction,
  getTransaction,
  getStats
} = require('../controllers/paymentController');

// Import middleware
const { authenticate } = require('../middleware/auth');

// Rate limiting for payment operations
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: {
    success: false,
    message: 'Too many payment requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply authentication to all routes
router.use(authenticate);

// Payment Methods Routes
// @route   GET /api/v1/payment-methods
// @desc    Get user's payment methods
// @access  Private
router.get('/payment-methods', getPaymentMethods);

// @route   POST /api/v1/payment-methods
// @desc    Add new payment method
// @access  Private
router.post('/payment-methods', paymentLimiter, addPaymentMethod);

// @route   PUT /api/v1/payment-methods/:id/default
// @desc    Set default payment method
// @access  Private
router.put('/payment-methods/:id/default', setDefaultPaymentMethod);

// @route   DELETE /api/v1/payment-methods/:id
// @desc    Remove payment method
// @access  Private
router.delete('/payment-methods/:id', removePaymentMethod);

// Transaction Routes
// @route   GET /api/v1/transactions
// @desc    Get user's transactions
// @access  Private
router.get('/transactions', getTransactions);

// @route   POST /api/v1/transactions
// @desc    Create new transaction
// @access  Private
router.post('/transactions', paymentLimiter, createTransaction);

// @route   GET /api/v1/transactions/:id
// @desc    Get transaction by ID
// @access  Private
router.get('/transactions/:id', getTransaction);

// Stats Routes
// @route   GET /api/v1/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', getStats);

module.exports = router;