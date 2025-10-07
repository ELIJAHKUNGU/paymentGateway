const MpesaKeys = require('../models/MpesaKeys');
const PaymentMethod = require('../models/PaymentMethod');

/**
 * Get M-Pesa credentials for a user's payment method
 * @param {string} paymentMethodId - Payment method ID
 * @param {string} userId - User ID
 * @returns {object} Decrypted M-Pesa credentials
 */
const getMpesaCredentialsForPayment = async (paymentMethodId, userId) => {
  try {
    // Get the payment method
    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      userId,
      type: 'mpesa',
      status: 'active'
    });

    if (!paymentMethod) {
      throw new Error('M-Pesa payment method not found');
    }

    // Get the associated M-Pesa keys
    const mpesaKeys = await MpesaKeys.findOne({
      _id: paymentMethod.metadata.mpesaKeysId,
      status: 'active'
    });

    if (!mpesaKeys) {
      throw new Error('M-Pesa keys not found or inactive');
    }

    if (mpesaKeys.approval.status !== 'approved') {
      throw new Error('M-Pesa keys are not approved for use');
    }

    // Get decrypted credentials
    const decryptedCredentials = mpesaKeys.getDecryptedCredentials();

    // Increment usage tracking
    await mpesaKeys.incrementUsage();

    return {
      credentials: decryptedCredentials,
      settings: mpesaKeys.settings,
      environment: mpesaKeys.environment,
      phoneNumber: paymentMethod.metadata.fullPhoneNumber,
      callbackUrl: paymentMethod.metadata.callbackUrl || mpesaKeys.settings.callbackUrl
    };

  } catch (error) {
    console.error('Get M-Pesa credentials error:', error);
    throw error;
  }
};

/**
 * Get user's default M-Pesa keys
 * @param {string} userId - User ID
 * @param {string} environment - Environment (sandbox/production)
 * @returns {object} User's default M-Pesa keys
 */
const getUserDefaultMpesaKeys = async (userId, environment = 'sandbox') => {
  try {
    const defaultKeys = await MpesaKeys.findOne({
      userId,
      status: 'active',
      environment,
      isDefault: true,
      'approval.status': 'approved'
    });

    return defaultKeys;
  } catch (error) {
    console.error('Get user default M-Pesa keys error:', error);
    throw error;
  }
};

/**
 * Validate M-Pesa phone number format
 * @param {string} phoneNumber - Phone number to validate
 * @returns {object} Validation result
 */
const validateMpesaPhoneNumber = (phoneNumber) => {
  if (!phoneNumber) {
    return { valid: false, message: 'Phone number is required' };
  }

  // Clean the phone number
  const cleanPhone = phoneNumber.replace(/\s+/g, '');
  
  // Kenyan M-Pesa number validation
  const kenyanMpesaRegex = /^(\+254|254)(7[0-9]{8}|1[0-9]{8})$/;
  
  if (!kenyanMpesaRegex.test(cleanPhone)) {
    return { 
      valid: false, 
      message: 'Please provide a valid Kenyan M-Pesa number (e.g., +254700000000)'
    };
  }

  // Format to standard international format
  let formattedPhone = cleanPhone;
  if (formattedPhone.startsWith('254')) {
    formattedPhone = '+' + formattedPhone;
  } else if (formattedPhone.startsWith('0')) {
    formattedPhone = '+254' + formattedPhone.substring(1);
  }

  return {
    valid: true,
    formatted: formattedPhone,
    network: formattedPhone.includes('70') || formattedPhone.includes('71') || 
             formattedPhone.includes('72') ? 'Safaricom' : 'Other'
  };
};

/**
 * Check if user has reached M-Pesa usage limits
 * @param {string} mpesaKeysId - M-Pesa keys ID
 * @param {number} amount - Transaction amount
 * @returns {object} Limit check result
 */
const checkUsageLimits = async (mpesaKeysId, amount = 1) => {
  try {
    const mpesaKeys = await MpesaKeys.findById(mpesaKeysId);

    if (!mpesaKeys) {
      return { allowed: false, message: 'M-Pesa keys not found' };
    }

    // Check daily limit
    if (mpesaKeys.limits.currentDailyUsage + amount > mpesaKeys.limits.dailyLimit) {
      return { 
        allowed: false, 
        message: 'Daily transaction limit exceeded',
        limits: {
          current: mpesaKeys.limits.currentDailyUsage,
          limit: mpesaKeys.limits.dailyLimit
        }
      };
    }

    // Check monthly limit
    if (mpesaKeys.limits.currentMonthlyUsage + amount > mpesaKeys.limits.monthlyLimit) {
      return { 
        allowed: false, 
        message: 'Monthly transaction limit exceeded',
        limits: {
          current: mpesaKeys.limits.currentMonthlyUsage,
          limit: mpesaKeys.limits.monthlyLimit
        }
      };
    }

    return { 
      allowed: true,
      remaining: {
        daily: mpesaKeys.limits.dailyLimit - mpesaKeys.limits.currentDailyUsage,
        monthly: mpesaKeys.limits.monthlyLimit - mpesaKeys.limits.currentMonthlyUsage
      }
    };

  } catch (error) {
    console.error('Check usage limits error:', error);
    return { allowed: false, message: 'Error checking usage limits' };
  }
};

module.exports = {
  getMpesaCredentialsForPayment,
  getUserDefaultMpesaKeys,
  validateMpesaPhoneNumber,
  checkUsageLimits
};