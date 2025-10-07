const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Check if token starts with 'Bearer '
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token format.'
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'payment-gateway-secret-key'
    );

    // Find user by ID from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not found.'
      });
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Account is not active.'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Account is temporarily locked.'
      });
    }

    // Add user to request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Access denied. Token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.'
    });
  }
};

// Middleware to check user role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not authenticated.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Middleware to check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. User not authenticated.'
    });
  }

  if (!req.user.verified.email) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Email verification required.'
    });
  }

  next();
};

// Optional authentication - doesn't fail if no token provided
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next(); // Continue without authentication
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'payment-gateway-secret-key'
    );

    const user = await User.findById(decoded.id);
    
    if (user && user.status === 'active' && !user.isLocked) {
      req.user = user;
    }

    next();

  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

// Rate limiting for authentication endpoints
const authRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful requests
  skipSuccessfulRequests: true
};

// Generate API key for merchants/integrations
const generateApiKey = () => {
  const prefix = 'pk_';
  const randomPart = require('crypto').randomBytes(32).toString('hex');
  return prefix + randomPart;
};

// Verify API key for merchant integrations
const verifyApiKey = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required.'
      });
    }

    // In a real implementation, you'd store API keys in database
    // For now, we'll accept any key that starts with 'pk_'
    if (!apiKey.startsWith('pk_')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key format.'
      });
    }

    // Add API key info to request
    req.apiKey = apiKey;
    next();

  } catch (error) {
    console.error('API key verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during API key verification.'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  requireVerification,
  optionalAuth,
  authRateLimit,
  generateApiKey,
  verifyApiKey
};