const axios = require('axios');
const crypto = require('crypto');

exports.postThirdPartyApi = async (data) => {
    try {
        // Extract URL and transaction data
        const { url, transaction, eventType = 'payment.status_updated', additionalData = {} } = data;
        
        if (!url) {
            throw new Error('Callback URL is required');
        }

        if (!transaction) {
            throw new Error('Transaction data is required');
        }

        console.log(`📤 Posting to third party API: ${url}`);

        // Create the request body/payload
        const requestBody = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: {
                orderId: transaction.orderId,
                status: transaction.status,
                amount: transaction.amount,
                phoneNumber: transaction.phoneNumber,
                bankName: transaction.bankName,
                accountReference: transaction.accountReference,
                
                // Note: merchantRequestId and checkoutRequestId are excluded from client notifications
                mpesaReceiptNumber: transaction.mpesaReceiptNumber || null,
                transactionDate: transaction.transactionDate || null,
                resultCode: transaction.callbackResultCode || null,
                resultDescription: transaction.callbackResultDesc || null,
                
                // Timestamps
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
                
                // Additional data
                ...additionalData
            }
        };

        // Generate security signature
        const webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';
        const signature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(requestBody))
            .digest('hex');

        // Make the POST request
        const response = await axios.post(url, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'PaymentGateway-Notification/1.0',
                'X-Webhook-Signature': signature,
                'X-Webhook-Event': eventType,
                'X-Webhook-Delivery': `${transaction.orderId}_${Date.now()}`,
                'X-Webhook-Timestamp': new Date().toISOString()
            },
            timeout: 30000, // 30 seconds timeout
            validateStatus: (status) => status >= 200 && status < 300
        });

        console.log(`✅ Third party API notification sent successfully`);
        console.log(`📊 Response: ${response.status} ${response.statusText}`);

        return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            data: response.data,
            requestBody
        };

    } catch (error) {
        console.error(`❌ Third party API notification failed:`, error.message);
        
        return {
            success: false,
            error: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            responseData: error.response?.data
        };
    }
};