const axios = require('axios');
const transactionService = require('./transactionService');

// Configure axios for C2B operations
const safaricomAPI = axios.create({
    timeout: 30000,
    httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000
    }),
    httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000
    }),
    maxRedirects: 3,
    validateStatus: (status) => status < 500
});

class C2BService {
    
    // Register validation and confirmation URLs with Safaricom
    async registerUrls(accessToken, shortCode, responseType = 'Completed') {
        try {
            const url = process.env.safaricom_baseurl + '/mpesa/c2b/v1/registerurl';
            const baseUrl = process.env.safaricom_callbackurl;
            
            const requestData = {
                ShortCode: shortCode,
                ResponseType: responseType, // 'Completed' or 'Cancelled'
                ConfirmationURL: `${baseUrl}/api/v1/c2b/confirmation`,
                ValidationURL: `${baseUrl}/api/v1/c2b/validation`
            };

            console.log(`Registering C2B URLs for shortcode: ${shortCode}`);

            const response = await safaricomAPI.post(url, requestData, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status !== 200) {
                throw new Error(`URL registration failed with status ${response.status}: ${response.data?.ResponseDescription || 'Unknown error'}`);
            }

            console.log(`C2B URLs registered successfully for shortcode ${shortCode}`);
            return response.data;

        } catch (error) {
            console.error('C2B URL registration failed:', error.message);
            
            if (error.response) {
                const errorData = error.response.data;
                throw new Error(`Safaricom API Error: ${errorData?.ResponseDescription || errorData?.errorMessage || error.message}`);
            }
            
            throw new Error(`URL registration failed: ${error.message}`);
        }
    }

    // Validate C2B transaction data
    validateC2BTransaction(transactionData) {
        try {
            console.log('Validating C2B transaction:', JSON.stringify(transactionData, null, 2));
            
            const {
                TransactionType,
                TransID,
                TransTime,
                TransAmount,
                BusinessShortCode,
                BillRefNumber,
                MSISDN,
                FirstName,
                LastName
            } = transactionData;

            // Check required fields
            if (!TransactionType || !TransID || !TransTime || !TransAmount || 
                !BusinessShortCode || !MSISDN) {
                throw new Error('Missing required transaction fields');
            }

            // Validate transaction type
            if (!['Pay Bill', 'Buy Goods'].includes(TransactionType)) {
                throw new Error('Invalid transaction type');
            }

            // Validate amount (must be positive number)
            const amount = parseFloat(TransAmount);
            if (isNaN(amount) || amount <= 0) {
                throw new Error('Invalid transaction amount');
            }

            // Validate phone number format (Kenyan format)
            const phoneRegex = /^254[0-9]{9}$/;
            if (!phoneRegex.test(MSISDN)) {
                throw new Error('Invalid phone number format');
            }

            return {
                isValid: true,
                data: transactionData
            };

        } catch (error) {
            console.error('C2B transaction validation failed:', error.message);
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    // Process C2B validation request
    async processValidationRequest(transactionData) {
        try {
            console.log('Processing C2B validation request:', JSON.stringify(transactionData, null, 2));

            // Validate transaction data
            const validation = this.validateC2BTransaction(transactionData);
            
            if (!validation.isValid) {
                return {
                    ResultCode: 'C2B00016',
                    ResultDesc: 'Rejected - ' + validation.error
                };
            }

            // Additional custom validation logic can be added here
            // For example: check if BillRefNumber exists in your system
            const { BillRefNumber, TransAmount, BusinessShortCode } = transactionData;
            
            // Example validation: Check if bill reference exists (you can customize this)
            if (BillRefNumber && BillRefNumber.length > 20) {
                return {
                    ResultCode: 'C2B00012',
                    ResultDesc: 'Rejected - Invalid Account Number'
                };
            }

            // Example validation: Check minimum amount
            const amount = parseFloat(TransAmount);
            if (amount < 1) {
                return {
                    ResultCode: 'C2B00013',
                    ResultDesc: 'Rejected - Invalid Amount'
                };
            }

            // If all validations pass, accept the transaction
            console.log(`C2B validation passed for TransID: ${transactionData.TransID}`);
            
            return {
                ResultCode: '0',
                ResultDesc: 'Accepted'
            };

        } catch (error) {
            console.error('Error processing C2B validation:', error.message);
            return {
                ResultCode: 'C2B00016',
                ResultDesc: 'Rejected - System Error'
            };
        }
    }

    // Process C2B confirmation request
    async processConfirmationRequest(transactionData) {
        try {
            console.log('Processing C2B confirmation request:', JSON.stringify(transactionData, null, 2));

            // Validate transaction data
            const validation = this.validateC2BTransaction(transactionData);
            
            if (!validation.isValid) {
                console.error('Invalid C2B confirmation data:', validation.error);
                return {
                    ResultCode: '1',
                    ResultDesc: 'Failed - Invalid transaction data'
                };
            }

            // Extract transaction details
            const {
                TransactionType,
                TransID,
                TransTime,
                TransAmount,
                BusinessShortCode,
                BillRefNumber,
                MSISDN,
                FirstName,
                MiddleName,
                LastName,
                OrgAccountBalance,
                ThirdPartyTransID
            } = transactionData;

            // Create a standardized transaction record for C2B payments
            const c2bTransaction = {
                mpesaTransactionId: TransID,
                transactionType: TransactionType,
                amount: parseFloat(TransAmount),
                phoneNumber: MSISDN,
                businessShortCode: BusinessShortCode,
                billRefNumber: BillRefNumber || '',
                accountBalance: OrgAccountBalance || '',
                thirdPartyTransId: ThirdPartyTransID || '',
                customerName: {
                    first: FirstName || '',
                    middle: MiddleName || '',
                    last: LastName || ''
                },
                transactionTime: TransTime,
                status: 'completed',
                paymentMethod: 'c2b',
                rawData: transactionData,
                processedAt: new Date()
            };

            // Save the C2B transaction to database
            try {
                const savedTransaction = await transactionService.createC2BTransaction(c2bTransaction);
                console.log('C2B transaction saved to database:', savedTransaction.orderId);
            } catch (dbError) {
                console.error('Failed to save C2B transaction to database:', dbError.message);
                // Don't fail the confirmation, but log the error
            }

            console.log('C2B transaction processed successfully:', {
                transactionId: TransID,
                amount: TransAmount,
                phoneNumber: MSISDN,
                billRef: BillRefNumber
            });

            return {
                ResultCode: '0',
                ResultDesc: 'Success'
            };

        } catch (error) {
            console.error('Error processing C2B confirmation:', error.message);
            return {
                ResultCode: '1',
                ResultDesc: 'Failed - Processing Error'
            };
        }
    }

    // Get C2B transaction status description
    getC2BStatusDescription(resultCode) {
        const statusCodes = {
            'C2B00011': 'Invalid MSISDN',
            'C2B00012': 'Invalid Account Number',
            'C2B00013': 'Invalid Amount',
            'C2B00014': 'Invalid KYC Details',
            'C2B00015': 'Invalid Shortcode',
            'C2B00016': 'Other Error',
            '0': 'Success',
            '1': 'Failed'
        };

        return statusCodes[resultCode] || `Unknown result code: ${resultCode}`;
    }

    // Health check for C2B service
    async healthCheck() {
        try {
            const baseUrl = process.env.safaricom_baseurl;
            const callbackUrl = process.env.safaricom_callbackurl;
            
            if (!baseUrl) {
                return {
                    status: 'unhealthy',
                    error: 'Safaricom base URL not configured'
                };
            }

            if (!callbackUrl) {
                return {
                    status: 'unhealthy',
                    error: 'Callback URL not configured'
                };
            }

            // Check if required environment variables are set
            const requiredVars = [
                'safaricom_baseurl',
                'safaricomconsumerKey',
                'safaricomconsumerSecret',
                'safaricom_callbackurl'
            ];

            const missingVars = requiredVars.filter(varName => !process.env[varName]);
            
            if (missingVars.length > 0) {
                return {
                    status: 'unhealthy',
                    error: `Missing environment variables: ${missingVars.join(', ')}`
                };
            }

            return {
                status: 'healthy',
                message: 'C2B service configuration is valid',
                endpoints: {
                    validation: `${callbackUrl}/api/v1/c2b/validation`,
                    confirmation: `${callbackUrl}/api/v1/c2b/confirmation`
                }
            };

        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    // Get service statistics
    getServiceStats() {
        const callbackUrl = process.env.safaricom_callbackurl;
        
        return {
            apiBaseUrl: process.env.safaricom_baseurl,
            callbackBaseUrl: callbackUrl,
            endpoints: {
                registerUrl: process.env.safaricom_baseurl + '/mpesa/c2b/v1/registerurl',
                validation: `${callbackUrl}/api/v1/c2b/validation`,
                confirmation: `${callbackUrl}/api/v1/c2b/confirmation`
            },
            connectionPooling: {
                maxSockets: 50,
                maxFreeSockets: 10,
                timeout: 30000
            }
        };
    }
}

module.exports = new C2BService();