const GatewayTransaction = require('../models/GatewayTransaction');
const { getBanksPaybill } = require('./bankService');
const { initiateStkPushRequest, confirmPaymentRequest } = require('./safaricomService');

class TransactionService {
    
    // Create and save a new transaction
    async createTransaction(transactionData) {
        try {
            const { bankName, ...otherData } = transactionData;
            
            // Check if transaction with orderId already exists
            const existingTransaction = await GatewayTransaction.findOne({ orderId: otherData.orderId });
            if (existingTransaction) {
                throw new Error(`Transaction with orderId '${otherData.orderId}' already exists`);
            }
            
            // Get paybill for the bank
            const paybill = getBanksPaybill(bankName);
            
            const transaction = new GatewayTransaction({
                ...otherData,
                bankName,
                paybill,
                status: 'initiated'
            });
            
            const savedTransaction = await transaction.save();
            console.log(`Transaction ${savedTransaction.orderId} saved to database`);
            
            return savedTransaction;
        } catch (error) {
            console.error('Error creating transaction:', error.message);
            
            // Handle MongoDB duplicate key error
            if (error.code === 11000 || error.message.includes('E11000')) {
                throw new Error(`Transaction with orderId '${transactionData.orderId}' already exists`);
            }
            
            throw new Error(`Failed to create transaction: ${error.message}`);
        }
    }

    // Process STK push payment
    async processPayment(transactionData) {
        try {
            // 1. Create transaction record
            const transaction = await this.createTransaction(transactionData);
            
            // 2. Initiate STK push
            const stkResponse = await initiateStkPushRequest({
                ...transactionData,
                paybill: transaction.paybill
            });
            
            // 3. Update transaction with STK response
            const updatedTransaction = await this.updateTransactionWithStkResponse(
                transaction.orderId, 
                stkResponse
            );
            
            return {
                transaction: updatedTransaction,
                stkResponse: stkResponse
            };
        } catch (error) {
            console.error('Error processing payment:', error.message);
            
            // Update transaction with error if it exists
            if (transactionData.orderId) {
                await this.addTransactionError(transactionData.orderId, error.message);
            }
            
            throw error;
        }
    }

    // Update transaction with STK push response
    async updateTransactionWithStkResponse(orderId, stkResponseData) {
        try {
            const updateData = {
                merchantRequestId: stkResponseData.MerchantRequestID,
                checkoutRequestId: stkResponseData.CheckoutRequestID,
                responseCode: stkResponseData.ResponseCode,
                responseDescription: stkResponseData.ResponseDescription,
                customerMessage: stkResponseData.CustomerMessage,
                rawStkResponse: stkResponseData,
                status: stkResponseData.ResponseCode === '0' ? 'pending' : 'failed'
            };

            const updatedTransaction = await GatewayTransaction.findOneAndUpdate(
                { orderId },
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!updatedTransaction) {
                throw new Error(`Transaction ${orderId} not found for STK response update`);
            }

            console.log(`Transaction ${orderId} updated with STK response`);
            return updatedTransaction;
        } catch (error) {
            console.error('Error updating transaction with STK response:', error.message);
            throw error;
        }
    }

    // Process callback from Safaricom
    async processCallback(callbackData) {
        try {
            const { orderId, ResultCode, ResultDesc } = callbackData;
            
            // Determine final status based on result code
            let finalStatus = 'failed';
            if (ResultCode === '0') {
                finalStatus = 'completed';
            } else if (ResultCode === '1032') {
                finalStatus = 'timeout';
            }

            const updateData = {
                callbackReceived: true,
                callbackReceivedAt: new Date(),
                callbackResultCode: ResultCode,
                callbackResultDesc: ResultDesc,
                status: finalStatus,
                rawCallbackData: callbackData
            };

            // Add successful payment details if available
            if (ResultCode === '0' && callbackData.CallbackMetadata) {
                const metadata = callbackData.CallbackMetadata.Item || [];
                
                const findMetadataValue = (name) => {
                    const item = metadata.find(item => item.Name === name);
                    return item ? item.Value : null;
                };

                updateData.mpesaReceiptNumber = findMetadataValue('MpesaReceiptNumber');
                updateData.transactionDate = findMetadataValue('TransactionDate');
                
                // Verify amount matches
                const callbackAmount = findMetadataValue('Amount');
                if (callbackAmount) {
                    updateData.callbackAmount = parseFloat(callbackAmount);
                }
            }

            const updatedTransaction = await GatewayTransaction.findOneAndUpdate(
                { orderId },
                { $set: updateData },
                { new: true, runValidators: true }
            );

            if (!updatedTransaction) {
                throw new Error(`Transaction ${orderId} not found for callback update`);
            }

            console.log(`Callback processed for transaction ${orderId}. Final status: ${finalStatus}`);
            return updatedTransaction;
        } catch (error) {
            console.error('Error processing callback:', error.message);
            
            // Log the error in the transaction document
            if (callbackData.orderId) {
                await this.addTransactionError(callbackData.orderId, error.message);
            }
            
            throw error;
        }
    }

    // Get transaction by orderId
    async getTransactionById(orderId, includeRawData = false) {
        try {
            let query = GatewayTransaction.findOne({ orderId });
            
            if (!includeRawData) {
                query = query.select('-rawStkResponse -rawCallbackData');
            }
            
            const transaction = await query.lean();
            
            if (!transaction) {
                throw new Error(`Transaction ${orderId} not found`);
            }
            
            return transaction;
        } catch (error) {
            console.error('Error retrieving transaction:', error.message);
            throw error;
        }
    }

    // Get transactions with filtering and pagination
    async getTransactions(options = {}) {
        try {
            const {
                page = 1,
                limit = 50,
                status = null,
                phoneNumber = null,
                bankName = null,
                fromDate = null,
                toDate = null
            } = options;

            // Build query
            const query = {};
            
            if (status) query.status = status;
            if (phoneNumber) query.phoneNumber = phoneNumber;
            if (bankName) query.bankName = bankName;
            
            if (fromDate || toDate) {
                query.createdAt = {};
                if (fromDate) query.createdAt.$gte = new Date(fromDate);
                if (toDate) query.createdAt.$lte = new Date(toDate);
            }

            // Execute query with pagination
            const skip = (page - 1) * limit;
            
            const [transactions, total] = await Promise.all([
                GatewayTransaction.find(query)
                    .select('-rawStkResponse -rawCallbackData -processingErrors')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                GatewayTransaction.countDocuments(query)
            ]);

            return {
                data: transactions,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                    hasNextPage: page < Math.ceil(total / limit),
                    hasPrevPage: page > 1
                }
            };
        } catch (error) {
            console.error('Error retrieving transactions:', error.message);
            throw error;
        }
    }

    // Get transaction statistics
    async getTransactionStats() {
        try {
            const stats = await GatewayTransaction.getStats();
            
            // Additional stats
            const [
                todayStats,
                weekStats,
                recentTransactions
            ] = await Promise.all([
                // Today's transactions
                GatewayTransaction.countDocuments({
                    createdAt: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }),
                
                // This week's transactions
                GatewayTransaction.countDocuments({
                    createdAt: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }),
                
                // Recent activity (last 10 transactions)
                GatewayTransaction.find({})
                    .select('orderId status amount phoneNumber createdAt')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean()
            ]);

            return {
                ...stats,
                todayTransactions: todayStats,
                weekTransactions: weekStats,
                recentActivity: recentTransactions
            };
        } catch (error) {
            console.error('Error retrieving statistics:', error.message);
            throw error;
        }
    }

    // Confirm payment status with Safaricom
    async confirmPaymentStatus(checkoutRequestId) {
        try {
            const confirmationResponse = await confirmPaymentRequest(checkoutRequestId);
            
            // Find transaction by checkoutRequestId and update if needed
            const transaction = await GatewayTransaction.findOne({ checkoutRequestId });
            
            if (transaction) {
                // Update transaction with confirmation response
                transaction.rawStkResponse = {
                    ...transaction.rawStkResponse,
                    confirmationResponse
                };
                await transaction.save();
            }
            
            return confirmationResponse;
        } catch (error) {
            console.error('Error confirming payment:', error.message);
            throw error;
        }
    }

    // Add error to transaction
    async addTransactionError(orderId, errorMessage) {
        try {
            await GatewayTransaction.findOneAndUpdate(
                { orderId },
                { 
                    $push: { 
                        processingErrors: {
                            error: errorMessage,
                            timestamp: new Date()
                        }
                    }
                }
            );
        } catch (error) {
            console.error('Error adding transaction error:', error.message);
        }
    }

    // Mark stale transactions as timeout
    async handleStaleTransactions(minutesOld = 30) {
        try {
            const result = await GatewayTransaction.updateMany(
                {
                    status: 'initiated',
                    createdAt: { $lt: new Date(Date.now() - minutesOld * 60 * 1000) },
                    callbackReceived: false
                },
                {
                    $set: {
                        status: 'timeout',
                        updatedAt: new Date()
                    },
                    $push: {
                        processingErrors: {
                            error: `Transaction timed out after ${minutesOld} minutes`,
                            timestamp: new Date()
                        }
                    }
                }
            );

            console.log(`Marked ${result.modifiedCount} transactions as timeout`);
            return result;
        } catch (error) {
            console.error('Error handling stale transactions:', error.message);
            throw error;
        }
    }

    // Health check for transaction operations
    async healthCheck() {
        try {
            await GatewayTransaction.findOne({}).limit(1);
            return {
                status: 'healthy',
                message: 'Transaction service is operational'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = new TransactionService();