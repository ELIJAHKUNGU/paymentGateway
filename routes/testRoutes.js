const express = require('express');
const thirdPartyApiService = require('../services/thirdPartyApiService');
const GatewayTransaction = require('../models/GatewayTransaction');

const testRouter = express.Router();

// Test webhook notification sending
testRouter.post('/send-webhook/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { eventType = 'payment_initiated' } = req.body;

        console.log(`🧪 Testing webhook sending for order: ${orderId}`);

        // Find the transaction
        const transaction = await GatewayTransaction.findOne({ orderId });
        
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: `Transaction with orderId '${orderId}' not found`
            });
        }

        if (!transaction.callbackUrl) {
            return res.status(400).json({
                success: false,
                message: `No callback URL configured for transaction '${orderId}'`
            });
        }

        // Create test notification based on event type
        let testPayload = {};
        
        if (eventType === 'payment_initiated') {
            testPayload = {
                eventType: 'payment_initiated',
                stkPushSent: true,
                responseCode: '0',
                responseDescription: 'Test: STK Push sent successfully',
                customerMessage: 'Test: Please enter your PIN to complete payment',
                initiatedAt: new Date().toISOString(),
                testMode: true
            };
        } else if (eventType === 'payment_completed') {
            testPayload = {
                eventType: 'payment_callback_received',
                callbackReceived: true,
                finalStatus: 'completed',
                safaricomResultCode: '0',
                safaricomResultDesc: 'Test: Payment completed successfully',
                mpesaReceiptNumber: `TEST${Date.now()}`,
                transactionDate: new Date().toISOString().replace(/[-:]/g, '').replace('T', '').substring(0, 14),
                processedAt: new Date().toISOString(),
                testMode: true
            };
        } else if (eventType === 'payment_failed') {
            testPayload = {
                eventType: 'payment_callback_received',
                callbackReceived: true,
                finalStatus: 'failed',
                safaricomResultCode: '1032',
                safaricomResultDesc: 'Test: Payment cancelled by user',
                processedAt: new Date().toISOString(),
                testMode: true
            };
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid eventType. Use: payment_initiated, payment_completed, or payment_failed'
            });
        }

        // Send the test notification directly
        await thirdPartyApiService.postThirdPartyApi(transaction, testPayload);

        res.status(200).json({
            success: true,
            message: `Test webhook notification sent for ${orderId}`,
            data: {
                orderId,
                eventType,
                callbackUrl: transaction.callbackUrl,
                sentAt: new Date().toISOString(),
                testPayload
            }
        });

    } catch (error) {
        console.error('❌ Error testing webhook:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error testing webhook notification',
            error: error.message
        });
    }
});

// Create a test transaction with callback URL for testing
testRouter.post('/create-test-transaction', async (req, res) => {
    try {
        const { 
            orderId = `TEST_${Date.now()}`,
            phoneNumber = '254743770216',
            amount = 1,
            callbackUrl,
            bankName = 'Test Bank'
        } = req.body;

        if (!callbackUrl) {
            return res.status(400).json({
                success: false,
                message: 'callbackUrl is required for test transaction'
            });
        }

        // Validate callback URL
        try {
            const url = new URL(callbackUrl);
            if (!['http:', 'https:'].includes(url.protocol)) {
                return res.status(400).json({
                    success: false,
                    message: 'Callback URL must use HTTP or HTTPS protocol'
                });
            }
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Invalid callback URL format'
            });
        }

        // Check if transaction already exists
        const existingTransaction = await GatewayTransaction.findOne({ orderId });
        if (existingTransaction) {
            return res.status(409).json({
                success: false,
                message: `Test transaction with orderId '${orderId}' already exists`
            });
        }

        // Create test transaction
        const testTransaction = new GatewayTransaction({
            orderId,
            phoneNumber,
            amount,
            bankName,
            paybill: 123456,
            accountReference: 'TEST_ACCOUNT',
            callbackUrl,
            timestamp: new Date().toISOString(),
            businessShortCode: 'TEST_SHORTCODE',
            status: 'initiated',
            clientIp: req.ip || '127.0.0.1',
            userAgent: req.get('User-Agent') || 'Test-Agent',
            transactionDesc: 'Test transaction for webhook testing'
        });

        const savedTransaction = await testTransaction.save();

        res.status(201).json({
            success: true,
            message: 'Test transaction created successfully',
            data: {
                orderId: savedTransaction.orderId,
                callbackUrl: savedTransaction.callbackUrl,
                amount: savedTransaction.amount,
                phoneNumber: savedTransaction.phoneNumber,
                status: savedTransaction.status,
                createdAt: savedTransaction.createdAt
            }
        });

    } catch (error) {
        console.error('❌ Error creating test transaction:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error creating test transaction',
            error: error.message
        });
    }
});

// Get webhook queue status
testRouter.get('/webhook-queue-status', (req, res) => {
    try {
        const stats = webhookNotificationService.getQueueStats();
        
        res.status(200).json({
            success: true,
            message: 'Webhook queue status retrieved',
            data: stats
        });
    } catch (error) {
        console.error('❌ Error getting queue status:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error retrieving queue status',
            error: error.message
        });
    }
});

// Test endpoint to receive webhooks (for local testing)
testRouter.post('/receive-webhook', (req, res) => {
    const headers = req.headers;
    const body = req.body;
    
    console.log('🎯 Test webhook received:');
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', JSON.stringify(body, null, 2));
    
    // Verify signature if provided
    if (headers['x-webhook-signature']) {
        const crypto = require('crypto');
        const secret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';
        const payload = JSON.stringify(body);
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
        
        const receivedSignature = headers['x-webhook-signature'];
        const signatureValid = expectedSignature === receivedSignature;
        
        console.log(`Signature validation: ${signatureValid ? '✅ Valid' : '❌ Invalid'}`);
    }
    
    res.status(200).json({
        success: true,
        message: 'Test webhook received successfully',
        timestamp: new Date().toISOString(),
        receivedData: {
            headers: {
                'x-webhook-event': headers['x-webhook-event'],
                'x-webhook-delivery': headers['x-webhook-delivery'],
                'x-webhook-attempt': headers['x-webhook-attempt'],
                'x-webhook-timestamp': headers['x-webhook-timestamp'],
                'x-webhook-signature': headers['x-webhook-signature'] ? 'present' : 'missing'
            },
            body
        }
    });
});

module.exports = testRouter;