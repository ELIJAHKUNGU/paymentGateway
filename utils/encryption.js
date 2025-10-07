const CryptoJS = require('crypto-js');

// Get encryption key from environment or generate a secure default
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'payment-gateway-encryption-key-2024-secure';

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string
 */
const encrypt = (text) => {
  if (!text) return text;
  
  try {
    const encrypted = CryptoJS.AES.encrypt(text.toString(), ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt sensitive data
 * @param {string} encryptedText - Encrypted text to decrypt
 * @returns {string} - Decrypted string
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return encryptedText;
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Hash data (one-way, for verification)
 * @param {string} text - Text to hash
 * @returns {string} - Hashed string
 */
const hash = (text) => {
  if (!text) return text;
  
  try {
    return CryptoJS.SHA256(text.toString()).toString();
  } catch (error) {
    console.error('Hashing error:', error);
    throw new Error('Failed to hash data');
  }
};

/**
 * Generate a secure random key
 * @param {number} length - Key length (default: 32)
 * @returns {string} - Random key
 */
const generateKey = (length = 32) => {
  try {
    return CryptoJS.lib.WordArray.random(length).toString();
  } catch (error) {
    console.error('Key generation error:', error);
    throw new Error('Failed to generate key');
  }
};

/**
 * Mask sensitive data for display
 * @param {string} data - Data to mask
 * @param {number} visibleChars - Number of chars to show at start (default: 4)
 * @returns {string} - Masked string
 */
const maskSensitiveData = (data, visibleChars = 4) => {
  if (!data || data.length <= visibleChars) {
    return data;
  }
  
  const visible = data.substring(0, visibleChars);
  const masked = '*'.repeat(Math.min(data.length - visibleChars, 8));
  return visible + masked;
};

/**
 * Encrypt M-Pesa credentials object
 * @param {object} credentials - M-Pesa credentials
 * @returns {object} - Encrypted credentials
 */
const encryptMpesaCredentials = (credentials) => {
  const sensitiveFields = ['consumerKey', 'consumerSecret', 'passKey'];
  const encrypted = { ...credentials };
  
  sensitiveFields.forEach(field => {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  });
  
  return encrypted;
};

/**
 * Decrypt M-Pesa credentials object
 * @param {object} encryptedCredentials - Encrypted M-Pesa credentials
 * @returns {object} - Decrypted credentials
 */
const decryptMpesaCredentials = (encryptedCredentials) => {
  const sensitiveFields = ['consumerKey', 'consumerSecret', 'passKey'];
  const decrypted = { ...encryptedCredentials };
  
  sensitiveFields.forEach(field => {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  });
  
  return decrypted;
};

/**
 * Validate encryption/decryption roundtrip
 * @param {string} originalText - Original text
 * @returns {boolean} - True if roundtrip successful
 */
const validateEncryption = (originalText) => {
  try {
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);
    return decrypted === originalText;
  } catch (error) {
    return false;
  }
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  generateKey,
  maskSensitiveData,
  encryptMpesaCredentials,
  decryptMpesaCredentials,
  validateEncryption
};