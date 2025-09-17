const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Token cache to avoid repeated API calls
let tokenCache = {
    token: null,
    expires: null
};

// Configure axios with connection pooling for auth requests
const authAPI = axios.create({
    timeout: 15000,
    httpAgent: new (require('http').Agent)({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 60000
    }),
    httpsAgent: new (require('https').Agent)({
        keepAlive: true,
        maxSockets: 10,
        maxFreeSockets: 5,
        timeout: 60000
    })
});

// Get fresh access token from Safaricom
const getNewAccessToken = async () => {
    const url = process.env.safaricom_baseurl + '/oauth/v1/generate?grant_type=client_credentials';
    const consumerKey = process.env.safaricomconsumerKey;
    const consumerSecret = process.env.safaricomconsumerSecret;
    const auth = Buffer.from(consumerKey + ":" + consumerSecret).toString('base64');

    try {
        const response = await authAPI.get(url, {
            headers: {
                "Authorization": "Basic " + auth,
                "Content-Type": "application/json"
            }
        });

        const { access_token, expires_in } = response.data;
        
        // Cache token with 5-minute buffer before expiry
        const expiryTime = Date.now() + ((expires_in - 300) * 1000);
        
        tokenCache = {
            token: access_token,
            expires: expiryTime
        };

        console.log('New access token obtained, expires in:', expires_in, 'seconds');
        return access_token;

    } catch (error) {
        console.error("Failed to get access token:", error.message);
        throw new Error(`Authentication failed: ${error.response?.data?.error_description || error.message}`);
    }
};

// Check if cached token is still valid
const isTokenValid = () => {
    return tokenCache.token && tokenCache.expires && Date.now() < tokenCache.expires;
};

// Main middleware function
exports.accessToken = async (req, res, next) => {
    try {
        let accessToken;

        // Use cached token if valid
        if (isTokenValid()) {
            accessToken = tokenCache.token;
            console.log('Using cached access token');
        } else {
            // Get new token
            console.log('Fetching new access token...');
            accessToken = await getNewAccessToken();
        }

        // Attach token to request
        req.safaricom_access_token = accessToken;
        next();

    } catch (error) {
        console.error("Access token middleware error:", error.message);
        
        // Clear invalid cached token
        tokenCache = { token: null, expires: null };
        
        res.status(401).json({
            message: 'Authentication failed',
            error: 'Unable to obtain access token for payment processing'
        });
    }
};