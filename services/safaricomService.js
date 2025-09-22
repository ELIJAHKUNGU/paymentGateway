const axios = require('axios');
const { getTimestamp } = require("../utils/timestamp");

// Configure axios with connection pooling for Safaricom API
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
    validateStatus: (status) => status < 500 // Don't throw for 4xx errors
});

class SafaricomService {
    
    // Initiate STK Push request
    async initiateStkPushRequest(paymentData) {
        try {
            const {
                orderId,
                phoneNumber,
                amount,
                paybill,
                accountReference,
                accessToken
            } = paymentData;

            const url = process.env.safaricom_baseurl + '/mpesa/stkpush/v1/processrequest';
            const timestamp = getTimestamp();
            const password = Buffer.from(
                process.env.safaricombusinessShortCode + 
                process.env.safaricompassKey + 
                timestamp
            ).toString('base64');
            
            const callback_url = process.env.safaricom_callbackurl;

            const requestData = {
                "BusinessShortCode": process.env.safaricombusinessShortCode,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerPayBillOnline",
                "Amount": amount,
                "PartyA": phoneNumber,
                "PartyB": parseInt(paybill),
                "PhoneNumber": phoneNumber,
                "CallBackURL": `${callback_url}/api/v1/stkPushCallback/${orderId}`,
                "AccountReference": accountReference,
                "TransactionDesc": "Payment for Order"
            };

            console.log(`Initiating STK Push for ${phoneNumber}, Amount: ${amount}, Order: ${orderId}`);

            const response = await safaricomAPI.post(url, requestData, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.status !== 200) {
                throw new Error(`STK Push failed with status ${response.status}: ${response.data?.errorMessage || 'Unknown error'}`);
            }

            console.log(`STK Push initiated successfully for order ${orderId}`);
            return response.data;

        } catch (error) {
            console.error('STK Push initiation failed:', error.message);
            
            if (error.response) {
                const errorData = error.response.data;
                throw new Error(`Safaricom API Error: ${errorData?.errorMessage || errorData?.ResultDesc || error.message}`);
            }
            
            throw new Error(`STK Push failed: ${error.message}`);
        }
    }

    // Confirm payment status
    async confirmPaymentRequest(checkoutRequestId, accessToken) {
        try {
            const url = process.env.safaricom_baseurl + '/mpesa/stkpushquery/v1/query';
            const timestamp = getTimestamp();
            const password = Buffer.from(
                process.env.safaricombusinessShortCode + 
                process.env.safaricompassKey + 
                timestamp
            ).toString('base64');

            const requestData = {
                "BusinessShortCode": process.env.safaricombusinessShortCode,
                "Password": password,
                "Timestamp": timestamp,
                "CheckoutRequestID": checkoutRequestId,
            };

            console.log(`Confirming payment status for CheckoutRequestID: ${checkoutRequestId}`);

            const response = await safaricomAPI.post(url, requestData, {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            });

            if (response.status !== 200) {
                throw new Error(`Payment confirmation failed with status ${response.status}`);
            }

            console.log(`Payment status confirmed for CheckoutRequestID: ${checkoutRequestId}`);
            return response.data;

        } catch (error) {
            console.error('Payment confirmation failed:', error.message);
            
            if (error.response) {
                const errorData = error.response.data;
                throw new Error(`Safaricom API Error: ${errorData?.errorMessage || errorData?.ResultDesc || error.message}`);
            }
            
            throw new Error(`Payment confirmation failed: ${error.message}`);
        }
    }

    // Validate callback data structure
    validateCallbackData(callbackData) {
        try {
            console.log('Validating callback data:', JSON.stringify(callbackData, null, 2));
            
            // Handle nested structure: check for stkCallback at root or in Body
            let stkCallback = callbackData.stkCallback;
            
            if (!stkCallback && callbackData.Body) {
                console.log('Found Body wrapper, extracting stkCallback');
                stkCallback = callbackData.Body.stkCallback;
            }
            
            if (!stkCallback) {
                console.log('Available keys:', Object.keys(callbackData));
                throw new Error('Missing stkCallback in request body');
            }
            
            console.log('stkCallback found:', JSON.stringify(stkCallback, null, 2));

            const {
                MerchantRequestID,
                CheckoutRequestID,
                ResultCode,
                ResultDesc
            } = stkCallback;

            if (!MerchantRequestID || !CheckoutRequestID || ResultCode === undefined || !ResultDesc) {
                throw new Error('Missing required callback fields');
            }

            return {
                isValid: true,
                data: stkCallback
            };

        } catch (error) {
            console.error('Callback validation failed:', error.message);
            return {
                isValid: false,
                error: error.message
            };
        }
    }

    // Process callback metadata
    processCallbackMetadata(callbackData) {
        try {
            const { CallbackMetadata } = callbackData;
            
            if (!CallbackMetadata || !CallbackMetadata.Item) {
                return {
                    hasMetadata: false,
                    data: null
                };
            }

            const metadata = CallbackMetadata.Item;
            const processedData = {};

            metadata.forEach(item => {
                if (item.Name && item.Value !== undefined) {
                    processedData[item.Name] = item.Value;
                }
            });

            return {
                hasMetadata: true,
                data: processedData,
                rawMetadata: metadata
            };

        } catch (error) {
            console.error('Error processing callback metadata:', error.message);
            return {
                hasMetadata: false,
                error: error.message,
                data: null
            };
        }
    }

    // Get transaction status description
    getTransactionStatusDescription(resultCode) {
        const statusCodes = {
            '0': 'Success - Transaction completed successfully',
            '1': 'Insufficient Funds - Customer has insufficient balance',
            '17': 'Invalid MSISDNs - Invalid phone number format',
            '20': 'Invalid Parameters - Request parameters are invalid',
            '26': 'System Internal Error - Internal system error',
            '1032': 'Request Cancelled - User cancelled the request',
            '1037': 'DS timeout - User delayed to enter PIN',
            '2001': 'Wrong PIN - User entered wrong PIN',
            '1001': 'Unable to lock subscriber amount - Temporary system issue'
        };

        return statusCodes[resultCode] || `Unknown status code: ${resultCode}`;
    }

    // Health check for Safaricom service
    async healthCheck() {
        try {
            // Simple connectivity test (we can't make actual API calls without valid credentials)
            const baseUrl = process.env.safaricom_baseurl;
            
            if (!baseUrl) {
                return {
                    status: 'unhealthy',
                    error: 'Safaricom base URL not configured'
                };
            }

            // Check if all required environment variables are set
            const requiredVars = [
                'safaricom_baseurl',
                'safaricomconsumerKey',
                'safaricomconsumerSecret',
                'safaricombusinessShortCode',
                'safaricompassKey',
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
                message: 'Safaricom service configuration is valid',
                baseUrl: baseUrl
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
        return {
            apiBaseUrl: process.env.safaricom_baseurl,
            businessShortCode: process.env.safaricombusinessShortCode,
            callbackUrl: process.env.safaricom_callbackurl,
            connectionPooling: {
                maxSockets: 50,
                maxFreeSockets: 10,
                timeout: 30000
            }
        };
    }
}

module.exports = new SafaricomService();