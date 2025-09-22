const axios = require('axios');
const crypto = require('crypto');

/**
 * Third Party API Service
 * Handles direct HTTP posts to client callback URLs
 */
class ThirdPartyApiService {
    constructor() {
        this.timeout = 30000; // 30 seconds
        this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';
    }

    /**
     * Post to third party API (client callback URL)
     * @param {Object} transaction - Transaction object
     * @param {Object} additionalData - Additional data for the notification
     */
    async postThirdPartyApi(transaction, additionalData = {}) {
        if (!transaction.callbackUrl) {
            console.log(`ℹ️ No callback URL configured for transaction ${transaction.orderId}`);
            return;
        }

        try {
            console.log(`📤 Sending notification to third party for transaction ${transaction.orderId}`);
            console.log(`🎯 Target URL: ${transaction.callbackUrl}`);

            // Create payload based on transaction status and additional data
            const payload = this.createPayload(transaction, additionalData);
            
            // Generate signature for security
            const signature = this.generateSignature(payload);

            const response = await axios.post(transaction.callbackUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'PaymentGateway-Webhook/1.0',
                    'X-Webhook-Signature': signature,
                    'X-Webhook-Event': payload.event,
                    'X-Webhook-Delivery': `${transaction.orderId}_${Date.now()}`,
                    'X-Webhook-Timestamp': new Date().toISOString()
                },
                timeout: this.timeout,
                validateStatus: (status) => status >= 200 && status < 300
            });

            console.log(`✅ Third party notification sent successfully for ${transaction.orderId}`);
            console.log(`📊 Response status: ${response.status} ${response.statusText}`);

            // Update transaction with notification success
            await this.updateTransactionNotificationStatus(transaction.orderId, {
                webhookNotified: true,
                webhookSuccessful: true,
                webhookLastAttempt: new Date(),
                webhookResponse: {
                    status: response.status,
                    statusText: response.statusText,
                    deliveredAt: new Date().toISOString()
                }
            });

            return {
                success: true,
                status: response.status,
                statusText: response.statusText,
                data: response.data
            };

        } catch (error) {
            console.error(`❌ Third party notification failed for ${transaction.orderId}:`, error.message);

            // Update transaction with failure info
            await this.updateTransactionNotificationStatus(transaction.orderId, {
                webhookLastAttempt: new Date(),
                webhookSuccessful: false,
                webhookResponse: {
                    error: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    data: error.response?.data
                }
            });

            // Log error in transaction processing errors
            const GatewayTransaction = require('../models/GatewayTransaction');
            await GatewayTransaction.findOneAndUpdate(
                { orderId: transaction.orderId },
                { 
                    $push: { 
                        processingErrors: {
                            error: `Third party notification failed: ${error.message}`,
                            timestamp: new Date()
                        }
                    }
                }
            );

            throw error;
        }
    }

    /**
     * Create notification payload
     * @param {Object} transaction - Transaction object
     * @param {Object} additionalData - Additional data
     */
    createPayload(transaction, additionalData = {}) {
        // Determine event type based on transaction status and additional data
        let eventType = 'payment.status_updated';
        
        if (additionalData.eventType === 'payment_initiated') {
            eventType = 'payment.initiated';
        } else if (additionalData.eventType === 'payment_callback_received') {
            // Use actual transaction status to determine event type
            if (transaction.status === 'completed') {
                eventType = 'payment.completed';
            } else if (transaction.status === 'failed') {
                eventType = 'payment.failed';
            } else if (transaction.status === 'timeout') {
                eventType = 'payment.timeout';
            } else {
                eventType = 'payment.status_updated';
            }
        } else if (transaction.status === 'completed') {
            eventType = 'payment.completed';
        } else if (transaction.status === 'failed') {
            eventType = 'payment.failed';
        } else if (transaction.status === 'pending') {
            eventType = 'payment.pending';
        }

        const basePayload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: {
                orderId: transaction.orderId,
                status: transaction.status,
                amount: transaction.amount,
                phoneNumber: transaction.phoneNumber,
                bankName: transaction.bankName,
                accountReference: transaction.accountReference,
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
                ...additionalData
            }
        };

        // Note: merchantRequestId and checkoutRequestId are excluded from client notifications
        if (transaction.mpesaReceiptNumber) {
            basePayload.data.mpesaReceiptNumber = transaction.mpesaReceiptNumber;
        }
        if (transaction.transactionDate) {
            basePayload.data.transactionDate = transaction.transactionDate;
        }
        if (transaction.callbackResultCode) {
            basePayload.data.resultCode = transaction.callbackResultCode;
        }
        // Use the most recent result description from additional data or transaction
        if (additionalData.safaricomResultDesc) {
            basePayload.data.resultDescription = additionalData.safaricomResultDesc;
        } else if (transaction.callbackResultDesc) {
            basePayload.data.resultDescription = transaction.callbackResultDesc;
        }

        return basePayload;
    }

    /**
     * Generate HMAC signature for webhook security
     * @param {Object} payload - Payload to sign
     */
    generateSignature(payload) {
        const payloadString = JSON.stringify(payload);
        return crypto
            .createHmac('sha256', this.webhookSecret)
            .update(payloadString)
            .digest('hex');
    }

    /**
     * Update transaction notification status
     * @param {string} orderId - Order ID
     * @param {Object} updateData - Data to update
     */
    async updateTransactionNotificationStatus(orderId, updateData) {
        try {
            const GatewayTransaction = require('../models/GatewayTransaction');
            await GatewayTransaction.findOneAndUpdate(
                { orderId },
                { $set: updateData },
                { runValidators: true }
            );
        } catch (error) {
            console.error(`❌ Error updating notification status for ${orderId}:`, error.message);
        }
    }

    /**
     * Post payment initiation notification
     * @param {Object} transaction - Transaction object
     * @param {Object} stkResponse - STK push response from Safaricom
     */
    async postPaymentInitiation(transaction, stkResponse) {
        return await this.postThirdPartyApi(transaction, {
            eventType: 'payment_initiated',
            stkPushSent: true,
            responseCode: stkResponse.ResponseCode,
            responseDescription: stkResponse.ResponseDescription,
            customerMessage: stkResponse.CustomerMessage,
            initiatedAt: new Date().toISOString()
        });
    }

    /**
     * Post payment completion/failure notification
     * @param {Object} transaction - Transaction object
     * @param {Object} callbackData - Safaricom callback data
     */
    async postPaymentCompletion(transaction, callbackData) {
        return await this.postThirdPartyApi(transaction, {
            eventType: 'payment_callback_received',
            callbackReceived: true,
            finalStatus: transaction.status,
            safaricomResultCode: callbackData.ResultCode,
            safaricomResultDesc: callbackData.ResultDesc,
            processedAt: new Date().toISOString()
        });
    }
}

// Export singleton instance
module.exports = new ThirdPartyApiService();