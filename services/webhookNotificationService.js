const axios = require('axios');
const crypto = require('crypto');
const GatewayTransaction = require('../models/GatewayTransaction');

/**
 * Webhook Notification Service
 * Handles client webhook notifications with queue processing and retry logic
 */
class WebhookNotificationService {
    constructor() {
        // Configuration
        this.maxRetries = 5;
        this.baseDelayMs = 1000; // 1 second
        this.maxDelayMs = 300000; // 5 minutes
        this.timeoutMs = 30000; // 30 seconds
        this.webhookSecret = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';
        
        // In-memory queue for webhook notifications
        this.notificationQueue = [];
        this.isProcessing = false;
        
        // Start background queue processor
        this.startQueueProcessor();
        
        console.log('✅ Webhook Notification Service initialized');
    }

    /**
     * Start background queue processing
     */
    startQueueProcessor() {
        // Process queue every 10 seconds
        setInterval(() => {
            this.processNotificationQueue();
        }, 10000);

        // Clean up old notifications every hour
        setInterval(() => {
            this.cleanupOldNotifications();
        }, 3600000);
    }

    /**
     * Queue a webhook notification for a transaction
     * @param {string} orderId - Transaction order ID
     * @param {Object} paymentData - Payment status data
     */
    async queueNotification(orderId, paymentData) {
        try {
            console.log(`📬 Queuing webhook notification for order: ${orderId}`);
            
            const transaction = await GatewayTransaction.findOne({ orderId });
            
            if (!transaction) {
                console.warn(`⚠️ Transaction not found for order: ${orderId}`);
                return;
            }

            if (!transaction.callbackUrl) {
                console.log(`ℹ️ No callback URL configured for order: ${orderId}`);
                return;
            }

            // Create notification job
            const notificationJob = {
                id: `${orderId}_${Date.now()}`,
                orderId,
                url: transaction.callbackUrl,
                payload: this.createNotificationPayload(transaction, paymentData),
                attempts: 0,
                maxRetries: this.maxRetries,
                createdAt: new Date(),
                nextAttempt: new Date(),
                status: 'pending'
            };

            this.notificationQueue.push(notificationJob);
            console.log(`✅ Notification queued for order: ${orderId}, URL: ${transaction.callbackUrl}`);

            // Process immediately if not already processing
            if (!this.isProcessing) {
                setTimeout(() => this.processNotificationQueue(), 100);
            }

        } catch (error) {
            console.error(`❌ Error queuing notification for order ${orderId}:`, error.message);
        }
    }

    /**
     * Process the notification queue
     */
    async processNotificationQueue() {
        if (this.isProcessing || this.notificationQueue.length === 0) {
            return;
        }

        this.isProcessing = true;
        const now = new Date();

        try {
            console.log(`🔄 Processing notification queue: ${this.notificationQueue.length} jobs`);

            // Get jobs ready to be processed
            const jobsToProcess = this.notificationQueue.filter(job => 
                job.nextAttempt <= now && 
                job.attempts < job.maxRetries &&
                job.status === 'pending'
            );

            for (const job of jobsToProcess) {
                await this.processNotification(job);
                
                // Small delay between notifications to avoid overwhelming
                await this.delay(100);
            }

            // Remove completed or failed jobs
            this.notificationQueue = this.notificationQueue.filter(job => 
                job.status === 'pending' && job.attempts < job.maxRetries
            );

        } catch (error) {
            console.error('❌ Error processing notification queue:', error.message);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process a single notification
     * @param {Object} job - Notification job
     */
    async processNotification(job) {
        job.attempts++;
        const attemptLog = `Attempt ${job.attempts}/${job.maxRetries}`;

        try {
            console.log(`📤 Sending webhook for ${job.orderId} (${attemptLog})`);

            const response = await axios.post(job.url, job.payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'PaymentGateway-Webhook/1.0',
                    'X-Webhook-Signature': this.generateSignature(job.payload),
                    'X-Webhook-Event': 'payment.status_updated',
                    'X-Webhook-Delivery': job.id,
                    'X-Webhook-Attempt': job.attempts.toString(),
                    'X-Webhook-Timestamp': new Date().toISOString()
                },
                timeout: this.timeoutMs,
                validateStatus: (status) => status >= 200 && status < 300
            });

            // Success
            job.status = 'completed';
            console.log(`✅ Webhook delivered successfully for ${job.orderId} (${attemptLog})`);

            // Update transaction record
            await this.updateTransactionWebhookStatus(job.orderId, {
                webhookNotified: true,
                webhookSuccessful: true,
                webhookAttempts: job.attempts,
                webhookLastAttempt: new Date(),
                webhookResponse: {
                    status: response.status,
                    statusText: response.statusText,
                    deliveredAt: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error(`❌ Webhook failed for ${job.orderId} (${attemptLog}):`, error.message);

            // Calculate next retry with exponential backoff
            const delayMs = Math.min(
                this.baseDelayMs * Math.pow(2, job.attempts - 1),
                this.maxDelayMs
            );
            job.nextAttempt = new Date(Date.now() + delayMs);

            // Update transaction with failure info
            await this.updateTransactionWebhookStatus(job.orderId, {
                webhookAttempts: job.attempts,
                webhookLastAttempt: new Date(),
                webhookSuccessful: false,
                webhookResponse: {
                    error: error.message,
                    status: error.response?.status,
                    statusText: error.response?.statusText,
                    nextRetry: job.nextAttempt
                }
            });

            // Mark as failed if max retries reached
            if (job.attempts >= job.maxRetries) {
                job.status = 'failed';
                console.error(`💀 Webhook permanently failed for ${job.orderId} after ${job.attempts} attempts`);
                
                // Log permanent failure in transaction
                await GatewayTransaction.findOneAndUpdate(
                    { orderId: job.orderId },
                    { 
                        $push: { 
                            processingErrors: {
                                error: `Webhook delivery permanently failed after ${job.attempts} attempts: ${error.message}`,
                                timestamp: new Date()
                            }
                        }
                    }
                );
            }
        }
    }

    /**
     * Create standardized notification payload
     * @param {Object} transaction - Transaction document
     * @param {Object} paymentData - Payment update data
     */
    createNotificationPayload(transaction, paymentData) {
        // Determine event type based on payment data or transaction status
        let eventType = 'payment.status_updated';
        if (paymentData.eventType === 'payment_initiated') {
            eventType = 'payment.initiated';
        } else if (paymentData.eventType === 'payment_callback_received') {
            eventType = 'payment.completed';
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
                
                // Timestamps
                createdAt: transaction.createdAt,
                updatedAt: transaction.updatedAt,
                
                // Additional payment data if provided
                ...paymentData
            }
        };

        // Add Safaricom specific data if available (for completed payments)
        if (transaction.merchantRequestId) {
            basePayload.data.merchantRequestId = transaction.merchantRequestId;
        }
        if (transaction.checkoutRequestId) {
            basePayload.data.checkoutRequestId = transaction.checkoutRequestId;
        }
        if (transaction.mpesaReceiptNumber) {
            basePayload.data.mpesaReceiptNumber = transaction.mpesaReceiptNumber;
        }
        if (transaction.transactionDate) {
            basePayload.data.transactionDate = transaction.transactionDate;
        }
        if (transaction.callbackResultCode) {
            basePayload.data.resultCode = transaction.callbackResultCode;
        }
        if (transaction.callbackResultDesc) {
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
     * Update transaction webhook status
     * @param {string} orderId - Order ID
     * @param {Object} updateData - Data to update
     */
    async updateTransactionWebhookStatus(orderId, updateData) {
        try {
            await GatewayTransaction.findOneAndUpdate(
                { orderId },
                { $set: updateData },
                { runValidators: true }
            );
        } catch (error) {
            console.error(`❌ Error updating webhook status for ${orderId}:`, error.message);
        }
    }

    /**
     * Manually retry webhook for a specific transaction
     * @param {string} orderId - Order ID to retry
     */
    async retryWebhookNotification(orderId) {
        try {
            const transaction = await GatewayTransaction.findOne({ orderId });
            
            if (!transaction) {
                throw new Error(`Transaction ${orderId} not found`);
            }

            if (!transaction.callbackUrl) {
                throw new Error(`No callback URL configured for transaction ${orderId}`);
            }

            // Create fresh notification job
            await this.queueNotification(orderId, {
                manualRetry: true,
                retryRequestedAt: new Date().toISOString()
            });

            return { 
                success: true, 
                message: `Webhook retry queued for ${orderId}`,
                callbackUrl: transaction.callbackUrl
            };

        } catch (error) {
            console.error(`❌ Error retrying webhook for ${orderId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        const stats = {
            totalJobs: this.notificationQueue.length,
            pendingJobs: this.notificationQueue.filter(j => j.status === 'pending' && j.attempts === 0).length,
            retryingJobs: this.notificationQueue.filter(j => j.status === 'pending' && j.attempts > 0).length,
            isProcessing: this.isProcessing,
            queueDetails: this.notificationQueue.map(job => ({
                orderId: job.orderId,
                attempts: job.attempts,
                status: job.status,
                nextAttempt: job.nextAttempt,
                url: job.url.replace(/\/\/.*@/, '//*****@') // Hide credentials in URL
            }))
        };

        return stats;
    }

    /**
     * Clean up old completed/failed notifications
     */
    cleanupOldNotifications() {
        const before = this.notificationQueue.length;
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        
        this.notificationQueue = this.notificationQueue.filter(job => 
            job.status === 'pending' || job.createdAt > cutoffTime
        );
        
        const cleaned = before - this.notificationQueue.length;
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} old webhook notifications`);
        }
    }

    /**
     * Utility delay function
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export singleton instance
module.exports = new WebhookNotificationService();