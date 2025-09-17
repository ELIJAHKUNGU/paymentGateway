const express = require('express');
const { stkPushCallback, confirmPayment, getBanks, initiateStkPush, getTransactionById, getTransactions, getTransactionStats } = require('../controllers/lipanampesa');
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

module.exports = lipaMpesaRoutes;
