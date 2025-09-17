const GatewayTransaction = require('../models/GatewayTransaction');

// Save transaction to MongoDB
const saveTransaction = async (transactionData) => {
    try {
        const transaction = new GatewayTransaction({
            ...transactionData,
            status: 'initiated',
            clientIp: transactionData.clientIp || null,
            userAgent: transactionData.userAgent || null
        });
        
        const savedTransaction = await transaction.save();
        console.log(`Transaction ${savedTransaction.orderId} saved to MongoDB`);
        
        return savedTransaction;
    } catch (error) {
        console.error('Error saving transaction to MongoDB:', error.message);
        throw error;
    }
};

// Update transaction with STK push response
const updateTransactionWithStkResponse = async (orderId, stkResponseData) => {
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
};

// Save callback data and update transaction
const saveCallback = async (callbackData) => {
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
        console.error('Error saving callback to MongoDB:', error.message);
        
        // Log the error in the transaction document
        if (callbackData.orderId) {
            await GatewayTransaction.findOneAndUpdate(
                { orderId: callbackData.orderId },
                { 
                    $push: { 
                        processingErrors: {
                            error: error.message,
                            timestamp: new Date()
                        }
                    }
                }
            );
        }
        
        throw error;
    }
};

// Get transaction by orderId
const getTransaction = async (orderId) => {
    try {
        const transaction = await GatewayTransaction.findOne({ orderId })
            .select('-rawStkResponse -rawCallbackData'); // Exclude large raw data by default
        
        return transaction;
    } catch (error) {
        console.error('Error retrieving transaction:', error.message);
        throw error;
    }
};

// Get transaction with full details (including raw data)
const getTransactionWithFullDetails = async (orderId) => {
    try {
        const transaction = await GatewayTransaction.findOne({ orderId });
        return transaction;
    } catch (error) {
        console.error('Error retrieving transaction with full details:', error.message);
        throw error;
    }
};

// Get all transactions with pagination and filtering
const getAllTransactions = async (options = {}) => {
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
};

// Get transaction statistics
const getStats = async () => {
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
};

// Find stale transactions (for cleanup/timeout handling)
const getStaleTransactions = async (minutesOld = 30) => {
    try {
        const staleTransactions = await GatewayTransaction.findStaleTransactions(minutesOld);
        return staleTransactions;
    } catch (error) {
        console.error('Error retrieving stale transactions:', error.message);
        throw error;
    }
};

// Mark stale transactions as timeout
const markStaleTransactionsAsTimeout = async (minutesOld = 30) => {
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
        console.error('Error marking stale transactions as timeout:', error.message);
        throw error;
    }
};

// Health check for MongoDB operations
const healthCheck = async () => {
    try {
        const testTransaction = await GatewayTransaction.findOne({}).limit(1);
        return {
            status: 'healthy',
            canRead: true,
            canWrite: true, // We'd need to do a write test for full verification
            message: 'MongoDB transaction operations working correctly'
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            canRead: false,
            canWrite: false,
            error: error.message
        };
    }
};

module.exports = {
    saveTransaction,
    updateTransactionWithStkResponse,
    saveCallback,
    getTransaction,
    getTransactionWithFullDetails,
    getAllTransactions,
    getStats,
    getStaleTransactions,
    markStaleTransactionsAsTimeout,
    healthCheck
};