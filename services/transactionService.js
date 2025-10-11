const GatewayTransaction = require('../models/GatewayTransaction');
const { getBanksPaybill } = require('./bankService');
const { initiateStkPushRequest, confirmPaymentRequest } = require('./safaricomService');
const thirdPartyApiService = require('./thirdPartyApiService');

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
            console.log("Trabns",transaction)
            
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
            
            // 4. Send immediate notification to client about STK push initiation
            if (updatedTransaction.callbackUrl) {
                try {
                    await thirdPartyApiService.postPaymentInitiation(updatedTransaction, stkResponse);
                    console.log(`Payment initiation notification sent to client for transaction ${updatedTransaction.orderId}`);
                } catch (error) {
                    console.error(`Failed to send payment initiation notification for ${updatedTransaction.orderId}:`, error.message);
                    // Don't throw error, continue with the flow
                }
            }
            
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
            if (ResultCode === 0 || ResultCode === '0') {
                finalStatus = 'completed';
            } else if (ResultCode === 1032 || ResultCode === '1032') {
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
                
                console.log("🔍 CALLBACK METADATA ITEMS:", JSON.stringify(metadata, null, 2));
                
                const findMetadataValue = (name) => {
                    const item = metadata.find(item => item.Name === name);
                    return item ? item.Value : null;
                };

                updateData.mpesaReceiptNumber = findMetadataValue('MpesaReceiptNumber');
                updateData.mpesaReference = findMetadataValue('MpesaReceiptNumber'); // Save as mpesaReference too
                updateData.transactionDate = findMetadataValue('TransactionDate');
                
                console.log("💳 MPESA Receipt Number extracted:", updateData.mpesaReceiptNumber);
                console.log("🔑 MPESA Reference extracted:", updateData.mpesaReference);
                
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
            
            // Send final status notification to client if callback URL is provided
            if (updatedTransaction.callbackUrl) {
                try {
                    // Get user-friendly description using the same mapping as console logs
                    const safaricomService = require('./safaricomService');
                    const userFriendlyDesc = safaricomService.getTransactionStatusDescription(ResultCode);
                    
                    // Prepare webhook data with fresh callback information
                    const webhookData = {
                        eventType: 'payment_callback_received',
                        callbackReceived: true,
                        finalStatus: finalStatus,
                        safaricomResultCode: ResultCode,
                        safaricomResultDesc: userFriendlyDesc, // Use user-friendly description
                        processedAt: new Date().toISOString(),
                        transactionReference: updateData.mpesaReference || updateData.mpesaReceiptNumber
                    };
                    
                    console.log("🎯 WEBHOOK DATA BEING SENT:", JSON.stringify(webhookData, null, 2));
                    console.log("🔑 Transaction Reference being sent:", webhookData.transactionReference || 'NOT SET');
                    console.log("📄 Updated Transaction object mpesaReference:", updatedTransaction.mpesaReference || 'NOT SET');
                    console.log("📄 Updated Transaction object mpesaReceiptNumber:", updatedTransaction.mpesaReceiptNumber || 'NOT SET');
                    
                    await thirdPartyApiService.postThirdPartyApi(updatedTransaction, webhookData);
                    console.log(`Final payment status notification sent to client for transaction ${orderId}`);
                } catch (error) {
                    console.error(`Failed to send final payment notification for ${orderId}:`, error.message);
                    // Don't throw error, log it in transaction
                }
            }
            
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

    // Create C2B transaction record
    async createC2BTransaction(c2bData) {
        try {
            const {
                mpesaTransactionId,
                transactionType,
                amount,
                phoneNumber,
                businessShortCode,
                billRefNumber,
                accountBalance,
                thirdPartyTransId,
                customerName,
                transactionTime,
                rawData
            } = c2bData;

            // Check if transaction with mpesaTransactionId already exists
            const existingTransaction = await GatewayTransaction.findOne({ 
                mpesaTransactionId: mpesaTransactionId 
            });
            
            if (existingTransaction) {
                console.log(`C2B Transaction with mpesaTransactionId '${mpesaTransactionId}' already exists`);
                return existingTransaction;
            }

            // Create C2B transaction record
            const transaction = new GatewayTransaction({
                orderId: `C2B_${mpesaTransactionId}_${Date.now()}`, // Generate unique orderId for C2B
                mpesaTransactionId: mpesaTransactionId,
                phoneNumber: phoneNumber,
                amount: amount,
                bankName: 'C2B_DIRECT', // Special bank name for C2B transactions
                paybill: businessShortCode,
                accountReference: billRefNumber || 'C2B_PAYMENT',
                status: 'completed', // C2B confirmations are already completed payments
                paymentMethod: 'c2b',
                transactionType: transactionType, // 'Pay Bill' or 'Buy Goods'
                businessShortCode: businessShortCode,
                billRefNumber: billRefNumber,
                accountBalance: accountBalance,
                thirdPartyTransId: thirdPartyTransId,
                customerName: customerName,
                transactionTime: transactionTime,
                callbackReceived: true,
                callbackReceivedAt: new Date(),
                callbackResultCode: '0',
                callbackResultDesc: 'C2B Payment Completed',
                rawCallbackData: rawData,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const savedTransaction = await transaction.save();
            console.log(`C2B Transaction ${savedTransaction.orderId} saved to database`);
            
            return savedTransaction;

        } catch (error) {
            console.error('Error creating C2B transaction:', error.message);
            
            // Handle MongoDB duplicate key error
            if (error.code === 11000 || error.message.includes('E11000')) {
                throw new Error(`C2B Transaction with mpesaTransactionId '${c2bData.mpesaTransactionId}' already exists`);
            }
            
            throw new Error(`Failed to create C2B transaction: ${error.message}`);
        }
    }

    // Get C2B transactions with filtering
    async getC2BTransactions(options = {}) {
        try {
            const {
                page = 1,
                limit = 50,
                phoneNumber = null,
                businessShortCode = null,
                transactionType = null,
                fromDate = null,
                toDate = null
            } = options;

            // Build query for C2B transactions
            const query = {
                paymentMethod: 'c2b' // Filter for C2B transactions only
            };
            
            if (phoneNumber) query.phoneNumber = phoneNumber;
            if (businessShortCode) query.businessShortCode = businessShortCode;
            if (transactionType) query.transactionType = transactionType;
            
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
            console.error('Error retrieving C2B transactions:', error.message);
            throw error;
        }
    }

    // Get C2B transaction statistics
    async getC2BStats() {
        try {
            const c2bQuery = { paymentMethod: 'c2b' };
            
            const [
                totalC2BTransactions,
                totalC2BAmount,
                todayC2BCount,
                weekC2BCount,
                payBillCount,
                buyGoodsCount,
                recentC2BTransactions
            ] = await Promise.all([
                // Total C2B transactions
                GatewayTransaction.countDocuments(c2bQuery),
                
                // Total C2B amount
                GatewayTransaction.aggregate([
                    { $match: c2bQuery },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]).then(result => result[0]?.total || 0),
                
                // Today's C2B transactions
                GatewayTransaction.countDocuments({
                    ...c2bQuery,
                    createdAt: {
                        $gte: new Date(new Date().setHours(0, 0, 0, 0))
                    }
                }),
                
                // This week's C2B transactions
                GatewayTransaction.countDocuments({
                    ...c2bQuery,
                    createdAt: {
                        $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }),
                
                // Pay Bill transactions
                GatewayTransaction.countDocuments({
                    ...c2bQuery,
                    transactionType: 'Pay Bill'
                }),
                
                // Buy Goods transactions
                GatewayTransaction.countDocuments({
                    ...c2bQuery,
                    transactionType: 'Buy Goods'
                }),
                
                // Recent C2B activity
                GatewayTransaction.find(c2bQuery)
                    .select('orderId mpesaTransactionId amount phoneNumber transactionType businessShortCode createdAt')
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .lean()
            ]);

            return {
                totalTransactions: totalC2BTransactions,
                totalAmount: totalC2BAmount,
                todayTransactions: todayC2BCount,
                weekTransactions: weekC2BCount,
                transactionTypes: {
                    payBill: payBillCount,
                    buyGoods: buyGoodsCount
                },
                recentActivity: recentC2BTransactions
            };

        } catch (error) {
            console.error('Error retrieving C2B statistics:', error.message);
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