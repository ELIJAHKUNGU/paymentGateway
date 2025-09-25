const express = require('express');
const { stkPushCallback, confirmPayment, getBanks, initiateStkPush, getTransactionById, getTransactions, getTransactionStats, retryWebhookNotification, getWebhookStats } = require('../controllers/lipanampesa');
const { registerUrls, handleValidation, handleConfirmation, simulateC2BPayment, getHealthStatus, getServiceStats, getC2BTransactions, getC2BStats } = require('../controllers/c2bController');
const {accessToken } = require('../middleware/lipampesaAuth');

const lipaMpesaRoutes = express.Router();
// Payment endpoints
lipaMpesaRoutes.post('/init-payment', accessToken, initiateStkPush);
lipaMpesaRoutes.post('/stkPushCallback/:orderId', stkPushCallback);
lipaMpesaRoutes.post('/confirmPayment/:CheckoutRequestID', accessToken, confirmPayment);

// Data endpoints
lipaMpesaRoutes.get('/banks', getBanks);
lipaMpesaRoutes.get('/transactions', getTransactions);
lipaMpesaRoutes.get('/transactions/:orderId', getTransactionById);
lipaMpesaRoutes.get('/stats', getTransactionStats);

// Client webhook notification endpoints
lipaMpesaRoutes.post('/webhooks/retry/:orderId', retryWebhookNotification);
lipaMpesaRoutes.get('/webhooks/stats', getWebhookStats);

// C2B (Customer to Business) endpoints
lipaMpesaRoutes.post('/c2b/register-urls', accessToken, registerUrls);
lipaMpesaRoutes.post('/c2b/validation', handleValidation);
lipaMpesaRoutes.post('/c2b/confirmation', handleConfirmation);
lipaMpesaRoutes.post('/c2b/simulate', accessToken, simulateC2BPayment);
lipaMpesaRoutes.get('/c2b/health', getHealthStatus);
lipaMpesaRoutes.get('/c2b/stats', getServiceStats);
lipaMpesaRoutes.get('/c2b/transactions', getC2BTransactions);
lipaMpesaRoutes.get('/c2b/transaction-stats', getC2BStats);

module.exports = lipaMpesaRoutes;
