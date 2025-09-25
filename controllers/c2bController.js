const c2bService = require('../services/c2bService');
const transactionService = require('../services/transactionService');

// Register C2B URLs with Safaricom
exports.registerUrls = async (req, res) => {
    try {
        const { shortCode, responseType } = req.body;
        
        if (!shortCode) {
            return res.status(400).json({
                message: 'Missing required field: shortCode'
            });
        }

        // Validate responseType if provided
        if (responseType && !['Completed', 'Cancelled'].includes(responseType)) {
            return res.status(400).json({
                message: 'Invalid responseType',
                error: 'responseType must be either "Completed" or "Cancelled"'
            });
        }

        // Get access token from request (should be added by auth middleware)
        const accessToken = req.accessToken;
        
        if (!accessToken) {
            return res.status(401).json({
                message: 'Access token required'
            });
        }

        const result = await c2bService.registerUrls(
            accessToken, 
            shortCode, 
            responseType || 'Completed'
        );

        res.status(200).json({
            message: 'C2B URLs registered successfully',
            data: result
        });

    } catch (error) {
        console.error('Error registering C2B URLs:', error.message);
        res.status(500).json({
            message: 'Failed to register C2B URLs',
            error: error.message
        });
    }
};

// Handle C2B validation requests from Safaricom
exports.handleValidation = async (req, res) => {
    try {
        console.log('Received C2B validation request:', JSON.stringify(req.body, null, 2));

        // Process the validation request
        const validationResult = await c2bService.processValidationRequest(req.body);

        console.log('C2B validation result:', validationResult);

        // Respond to Safaricom with validation result
        res.status(200).json(validationResult);

    } catch (error) {
        console.error('Error handling C2B validation:', error.message);
        
        // Return rejection response to Safaricom
        res.status(200).json({
            ResultCode: 'C2B00016',
            ResultDesc: 'Rejected - System Error'
        });
    }
};

// Handle C2B confirmation requests from Safaricom
exports.handleConfirmation = async (req, res) => {
    try {
        console.log('Received C2B confirmation request:', JSON.stringify(req.body, null, 2));

        // Process the confirmation request
        const confirmationResult = await c2bService.processConfirmationRequest(req.body);

        console.log('C2B confirmation result:', confirmationResult);

        // Additional processing: save to database if needed
        if (confirmationResult.ResultCode === '0') {
            try {
                // You can extend this to save C2B transactions to your database
                // For now, we'll just log the successful transaction
                const { TransID, TransAmount, MSISDN, BillRefNumber } = req.body;
                
                console.log('C2B Payment completed successfully:', {
                    mpesaTransactionId: TransID,
                    amount: TransAmount,
                    phoneNumber: MSISDN,
                    billRefNumber: BillRefNumber,
                    timestamp: new Date().toISOString()
                });

                // You can add webhook notifications here if needed
                // await notifyWebhooks(req.body);

            } catch (error) {
                console.error('Error in additional C2B processing:', error.message);
                // Don't fail the main response, just log the error
            }
        }

        // Respond to Safaricom with confirmation result
        res.status(200).json(confirmationResult);

    } catch (error) {
        console.error('Error handling C2B confirmation:', error.message);
        
        // Return failure response to Safaricom
        res.status(200).json({
            ResultCode: '1',
            ResultDesc: 'Failed - System Error'
        });
    }
};

// Simulate C2B payment (for testing purposes)
exports.simulateC2BPayment = async (req, res) => {
    try {
        const { 
            shortCode, 
            amount, 
            msisdn, 
            billRefNumber,
            commandID = 'CustomerPayBillOnline' // or 'CustomerBuyGoodsOnline'
        } = req.body;

        // Input validation
        if (!shortCode || !amount || !msisdn) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['shortCode', 'amount', 'msisdn']
            });
        }

        // Get access token from request
        const accessToken = req.accessToken;
        
        if (!accessToken) {
            return res.status(401).json({
                message: 'Access token required'
            });
        }

        const url = process.env.safaricom_baseurl + '/mpesa/c2b/v1/simulate';
        
        const requestData = {
            ShortCode: shortCode,
            CommandID: commandID,
            Amount: amount,
            Msisdn: msisdn,
            BillRefNumber: billRefNumber || 'TestAccount'
        };

        console.log('Simulating C2B payment:', requestData);

        const axios = require('axios');
        const response = await axios.post(url, requestData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.status !== 200) {
            throw new Error(`C2B simulation failed with status ${response.status}`);
        }

        res.status(200).json({
            message: 'C2B payment simulation initiated',
            data: response.data
        });

    } catch (error) {
        console.error('Error simulating C2B payment:', error.message);
        
        let errorMessage = error.message;
        if (error.response) {
            const errorData = error.response.data;
            errorMessage = errorData?.ResponseDescription || errorData?.errorMessage || error.message;
        }

        res.status(500).json({
            message: 'Failed to simulate C2B payment',
            error: errorMessage
        });
    }
};

// Get C2B service health status
exports.getHealthStatus = async (_req, res) => {
    try {
        const healthStatus = await c2bService.healthCheck();
        
        const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            service: 'C2B Service',
            ...healthStatus,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error checking C2B health:', error.message);
        res.status(503).json({
            service: 'C2B Service',
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Get C2B service statistics
exports.getServiceStats = async (_req, res) => {
    try {
        const stats = c2bService.getServiceStats();
        
        res.status(200).json({
            service: 'C2B Service',
            ...stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting C2B stats:', error.message);
        res.status(500).json({
            message: 'Failed to get C2B service statistics',
            error: error.message
        });
    }
};

// Get C2B transactions
exports.getC2BTransactions = async (req, res) => {
    try {
        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            phoneNumber: req.query.phoneNumber,
            businessShortCode: req.query.businessShortCode,
            transactionType: req.query.transactionType,
            fromDate: req.query.fromDate,
            toDate: req.query.toDate
        };

        const result = await transactionService.getC2BTransactions(options);

        res.status(200).json({
            message: 'C2B transactions retrieved successfully',
            ...result
        });

    } catch (error) {
        console.error('Error retrieving C2B transactions:', error.message);
        res.status(500).json({
            message: 'Failed to retrieve C2B transactions',
            error: error.message
        });
    }
};

// Get C2B transaction statistics
exports.getC2BStats = async (_req, res) => {
    try {
        const stats = await transactionService.getC2BStats();

        res.status(200).json({
            message: 'C2B statistics retrieved successfully',
            data: stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error retrieving C2B statistics:', error.message);
        res.status(500).json({
            message: 'Failed to retrieve C2B statistics',
            error: error.message
        });
    }
};