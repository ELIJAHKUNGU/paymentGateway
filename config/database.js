const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// MongoDB connection configuration optimized for high concurrency
const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI;
        
        const conn = await mongoose.connect(mongoURI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        // , {
            // Connection pool settings for high concurrency
        //     maxPoolSize: 50, // Maximum number of connections in the pool
        //     minPoolSize: 5,  // Minimum number of connections in the pool
        //     maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
        //    ∆serverSelectionTimeoutMS: 5000, // How long to try selecting a server
        //     socketTimeoutMS: 45000, // How long a send/receive can take before timeout
        //     bufferMaxEntries: 0, // Disable mongoose buffering
        //     bufferCommands: false, // Disable mongoose buffering commands
            
        //     // Replica set / cluster settings
        //     readPreference: 'primaryPreferred', // Read from primary when available
        //     retryWrites: true, // Retry writes on failure
        //     w: 'majority', // Write concern
            
        //     // Additional performance settings
        //     authSource: 'admin',
        //     compressors: 'zlib', // Enable compression
        //     zlibCompressionLevel: 6
        // }

        // console.log(`🗄️  MongoDB Connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
        // console.log(`📊 Connection pool: ${conn.connection.readyState === 1 ? 'Ready' : 'Not Ready'}`);
        
        // // Connection event handlers
        // mongoose.connection.on('error', (err) => {
        //     console.error('MongoDB connection error:', err);
        // });
        
        // mongoose.connection.on('disconnected', () => {
        //     console.warn('MongoDB disconnected. Attempting to reconnect...');
        // });
        
        // mongoose.connection.on('reconnected', () => {
        //     console.log('MongoDB reconnected successfully');
        // });
        
        // // Graceful shutdown
        // process.on('SIGINT', async () => {
        //     await mongoose.connection.close();
        //     console.log('MongoDB connection closed through app termination');
        //     process.exit(0);
        // });
        
        // return conn;
        
    } catch (error) {
        console.error('Database connection failed:', error.message);
        
        // Retry connection after 5 seconds
        setTimeout(connectDB, 5000);
    }
};

// Health check function
const checkDBHealth = async () => {
    try {
        const state = mongoose.connection.readyState;
        const states = {
            0: 'Disconnected',
            1: 'Connected',
            2: 'Connecting',
            3: 'Disconnecting'
        };
        
        return {
            status: states[state] || 'Unknown',
            readyState: state,
            host:"Payment Gateway",
            // port: mongoose.connection.port,
            name: "Payment Gateway",
            collections: Object.keys(mongoose.connection.collections).length
        };
    } catch (error) {
        return {
            status: 'Error',
            error: error.message
        };
    }
};

module.exports = {
    connectDB,
    checkDBHealth
};