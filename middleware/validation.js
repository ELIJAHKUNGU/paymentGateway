const { body, param, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

// User registration validation
const validateRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .custom((value) => {
      // Accept Kenyan formats: +254XXXXXXXXX, 254XXXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX
      const kenyanPhoneRegex = /^(\+254|254|0)(7|1)\d{8}$/;
      if (!kenyanPhoneRegex.test(value.replace(/\s+/g, ''))) {
        throw new Error('Please provide a valid Kenyan phone number (e.g., +254700000000, 254700000000, or 0700000000)');
      }
      return true;
    }),

  body('role')
    .optional()
    .isIn(['customer', 'merchant', 'admin'])
    .withMessage('Role must be either customer, merchant, or admin'),

  handleValidationErrors
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

// Password change validation
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    }),

  handleValidationErrors
];

// Profile update validation
const validateProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('profile.dateOfBirth')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Please provide a valid date of birth'),

  body('profile.address.street')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Street address cannot exceed 100 characters'),

  body('profile.address.city')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('City cannot exceed 50 characters'),

  body('profile.address.state')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('State cannot exceed 50 characters'),

  body('profile.address.country')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Country cannot exceed 50 characters'),

  body('profile.address.postalCode')
    .optional()
    .trim()
    .matches(/^[a-zA-Z0-9\s-]+$/)
    .withMessage('Please provide a valid postal code'),

  handleValidationErrors
];

// Email verification validation
const validateEmailVerification = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required'),

  handleValidationErrors
];

// Password reset request validation
const validatePasswordResetRequest = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  handleValidationErrors
];

// Password reset validation
const validatePasswordReset = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),

  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),

  handleValidationErrors
];

// User preferences validation
const validatePreferences = [
  body('currency')
    .optional()
    .isIn(['KES', 'USD', 'EUR', 'GBP'])
    .withMessage('Currency must be one of: KES, USD, EUR, GBP'),

  body('language')
    .optional()
    .isIn(['en', 'sw', 'fr'])
    .withMessage('Language must be one of: en, sw, fr'),

  body('notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be a boolean'),

  body('notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notification preference must be a boolean'),

  body('notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notification preference must be a boolean'),

  handleValidationErrors
];

// ID parameter validation
const validateUserId = [
  param('id')
    .isMongoId()
    .withMessage('Please provide a valid user ID'),

  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('sort')
    .optional()
    .isIn(['name', 'email', 'createdAt', '-name', '-email', '-createdAt'])
    .withMessage('Sort must be one of: name, email, createdAt (prefix with - for descending)'),

  handleValidationErrors
];

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateEmailVerification,
  validatePasswordResetRequest,
  validatePasswordReset,
  validatePreferences,
  validateUserId,
  validatePagination,
  handleValidationErrors
};