const transactionService = require('../services/transactionService');
const bankService = require('../services/bankService');
const safaricomService = require('../services/safaricomService');
const webhookNotificationService = require('../services/webhookNotificationService');

exports.initiateStkPush = async (req, res) => {
    try {
        // Input validation
        const { phoneNumber, amount, orderId, bankName, accountReference, callbackUrl } = req.body;
        
        if (!phoneNumber || !amount || !orderId || !bankName || !accountReference) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['phoneNumber', 'amount', 'orderId', 'bankName', 'accountReference']
            });
        }

        // Validate callbackUrl if provided (optional field for client notifications)
        if (callbackUrl) {
            try {
                const url = new URL(callbackUrl);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    return res.status(400).json({
                        message: 'Invalid callback URL',
                        error: 'Callback URL must use HTTP or HTTPS protocol'
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    message: 'Invalid callback URL', 
                    error: 'Callback URL must be a valid URL'
                });
            }
        }

        // Validate bank exists
        if (!bankService.validateBank(bankName)) {
            return res.status(400).json({
                message: 'Invalid bank name',
                error: `Bank '${bankName}' is not supported`
            });
        }

        // Prepare transaction data
        const transactionData = {
            orderId,
            phoneNumber,
            amount,
            bankName,
            accountReference,
            callbackUrl, // Client's callback URL for notifications
            timestamp: require("../utils/timestamp").getTimestamp(),
            businessShortCode: process.env.safaricombusinessShortCode,
            clientIp: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            accessToken: req.safaricom_access_token
        };
        
        // Process payment through service
        const result = await transactionService.processPayment(transactionData);

        res.status(200).json({
            message: 'Payment initiated successfully',
            data: {
                orderId: result.transaction.orderId,
                merchantRequestId: result.transaction.merchantRequestId,
                checkoutRequestId: result.transaction.checkoutRequestId,
                responseCode: result.transaction.responseCode,
                responseDescription: result.transaction.responseDescription,
                customerMessage: result.transaction.customerMessage
            }
        });

    } catch (error) {
        console.error('STK Push Controller Error:', error.message);
        
        // Handle different error types
        if (error.message.includes('Bank provider') || error.message.includes('not supported')) {
            return res.status(400).json({
                message: 'Invalid request',
                error: error.message
            });
        }
        
        if (error.message.includes('already exists')) {
            return res.status(409).json({
                message: 'Duplicate transaction',
                error: error.message
            });
        }
        
        if (error.message.includes('Safaricom API')) {
            return res.status(502).json({
                message: 'Payment service error',
                error: error.message
            });
        }
        
        res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}

// @desc callback route Safaricom will post transaction status
// @method POST
// @route /stkPushCallback/:orderId
// @access public
exports.stkPushCallback = async(req, res) => {
    try {
        const { orderId } = req.params;

        // Log callback received
        console.log(`Callback received for orderId: ${orderId}`);
        console.log("Callback Body:", JSON.stringify(req.body, null, 2));

        // Validate callback data structure
        console.log('About to validate callback data...');
        const validation = safaricomService.validateCallbackData(req.body);
        console.log('Validation result:', validation);
        if (!validation.isValid) {
            return res.status(400).json({
                message: 'Invalid callback data',
                error: validation.error
            });
        }

        // Prepare callback data for processing
        const callbackData = {
            orderId,
            ...validation.data
        };

        // Process callback through service
        const updatedTransaction = await transactionService.processCallback(callbackData);

        // Get status description
        const statusDesc = safaricomService.getTransactionStatusDescription(validation.data.ResultCode);

        // Log callback processing
        console.log("-".repeat(20), " PAYMENT CALLBACK ", "-".repeat(20));
        console.log(`
            Order ID: ${orderId}
            Status: ${validation.data.ResultCode === '0' ? 'SUCCESS' : 'FAILED'}
            Result Code: ${validation.data.ResultCode}
            Description: ${statusDesc}
            Final Transaction Status: ${updatedTransaction.status}
        `);

        res.json({ 
            success: true, 
            message: 'Callback processed successfully',
            orderId: orderId,
            status: updatedTransaction.status
        });

    } catch (error) {
        console.error("Callback processing error:", error.message);
        res.status(503).json({
            message: "Failed to process callback",
            error: error.message,
            orderId: req.params.orderId
        });
    }
}
// @desc Check from safaricom servers the status of a transaction
// @method GET
// @route /confirmPayment/:CheckoutRequestID
// @access public
exports.confirmPayment = async(req, res) => {
    try {
        const { CheckoutRequestID } = req.params;

        if (!CheckoutRequestID) {
            return res.status(400).json({
                message: 'CheckoutRequestID is required'
            });
        }

        // Confirm payment through service
        const confirmationResult = await transactionService.confirmPaymentStatus(CheckoutRequestID);

        res.status(200).json({
            message: 'Payment status confirmed successfully',
            data: confirmationResult
        });

    } catch (error) {
        console.error("Payment confirmation error:", error.message);
        
        if (error.message.includes('Safaricom API')) {
            return res.status(502).json({
                message: 'Payment service error',
                error: error.message
            });
        }
        
        res.status(503).json({
            message: 'Failed to confirm payment status',
            error: error.message
        });
    }
}
exports.getBanks = async (req, res) => {
    try {
        const result = bankService.getAllBanks();

        res.status(200).json({
            message: 'Banks retrieved successfully',
            count: result.count,
            data: result.banks
        });
    } catch (error) {
        console.error("Error retrieving banks:", error.message);
        res.status(500).json({
            message: 'Error retrieving banks',
            error: error.message
        });
    }
};

// Get transaction by ID
exports.getTransactionById = async (req, res) => {
    try {
        const { orderId } = req.params;
        const includeRawData = req.query.includeRaw === 'true';
        
        const transaction = await transactionService.getTransactionById(orderId, includeRawData);

        res.status(200).json({
            message: 'Transaction retrieved successfully',
            data: transaction
        });
    } catch (error) {
        console.error("Error retrieving transaction:", error.message);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                message: 'Transaction not found',
                orderId: req.params.orderId
            });
        }
        
        res.status(500).json({
            message: 'Error retrieving transaction',
            error: error.message
        });
    }
};

// Get all transactions with pagination
exports.getTransactions = async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            status: req.query.status || null,
            phoneNumber: req.query.phoneNumber || null,
            bankName: req.query.bankName || null,
            fromDate: req.query.fromDate || null,
            toDate: req.query.toDate || null
        };
        
        const result = await getAllTransactions(options);
        
        res.status(200).json({
            message: 'Transactions retrieved successfully',
            ...result
        });
    } catch (error) {
        console.error("Error retrieving transactions:", error);
        res.status(500).json({
            message: 'Error retrieving transactions',
            error: error.message
        });
    }
};

// Get transaction statistics
exports.getTransactionStats = async (req, res) => {
    try {
        const stats = await getStats();
        
        res.status(200).json({
            message: 'Statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error("Error retrieving statistics:", error);
        res.status(500).json({
            message: 'Error retrieving statistics',
            error: error.message
        });
    }
};

// Manually retry webhook notification for a transaction
exports.retryWebhookNotification = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const result = await webhookNotificationService.retryWebhookNotification(orderId);
        
        res.status(200).json({
            message: 'Webhook notification retry initiated',
            data: result
        });
    } catch (error) {
        console.error("Error retrying webhook notification:", error.message);
        
        if (error.message.includes('not found')) {
            return res.status(404).json({
                message: 'Transaction not found',
                orderId: req.params.orderId
            });
        }
        
        res.status(500).json({
            message: 'Error retrying webhook notification',
            error: error.message
        });
    }
};

// Get webhook notification queue statistics
exports.getWebhookStats = async (req, res) => {
    try {
        const stats = webhookNotificationService.getQueueStats();
        
        res.status(200).json({
            message: 'Webhook queue statistics retrieved',
            data: stats
        });
    } catch (error) {
        console.error("Error retrieving webhook stats:", error);
        res.status(500).json({
            message: 'Error retrieving webhook statistics',
            error: error.message
        });
    }
};
