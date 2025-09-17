const express = require('express');
require('dotenv').config();
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const morgan = require('morgan');
const { connectDB, checkDBHealth } = require('./config/database');

const app = express();

// Initialize MongoDB connection
connectDB();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting - 100 requests per minute per IP
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Slow down middleware - progressively slow down repeated requests
const speedLimiter = slowDown({
    windowMs: 60 * 1000, // 1 minute
    delayAfter: 50, // allow 50 requests per minute at full speed
    delayMs: 100 // add 100ms delay for each request after delayAfter
});

// Apply rate limiting to all requests
app.use(limiter);
app.use(speedLimiter);

// Stricter rate limiting for payment endpoints
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // limit each IP to 20 payment requests per minute
    message: {
        error: 'Too many payment requests, please try again later.'
    }
});

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true
}));

// Request logging
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await checkDBHealth();
        res.status(200).json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            database: dbHealth
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Apply stricter rate limiting to payment routes
app.use('/api/v1/init-payment', paymentLimiter);

// Load routes
app.use('/api/v1', require('./routes/lipampesaRoutes'));




// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route not found'
    });
});

// Configure server for high concurrency
const port = process.env.PORT || 4001;
const server = app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`);
    console.log(`🔒 Security enabled with rate limiting`);
    console.log(`📊 Health check available at /health`);
});

// Optimize server settings for high concurrency
server.keepAliveTimeout = 65000; // Slightly higher than load balancer timeout
server.headersTimeout = 66000; // Slightly higher than keepAliveTimeout
server.maxHeadersCount = 1000;
server.timeout = 30000; // 30 second timeout

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});