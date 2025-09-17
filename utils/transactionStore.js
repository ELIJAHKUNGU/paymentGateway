const fs = require('fs').promises;
const path = require('path');

// In-memory cache for fast access
const transactionCache = new Map();
const callbackCache = new Map();

// File paths for persistence
const TRANSACTIONS_FILE = path.join(__dirname, '..', 'data', 'transactions.json');
const CALLBACKS_FILE = path.join(__dirname, '..', 'data', 'callbacks.json');

// Ensure data directory exists
const ensureDataDir = async () => {
    const dataDir = path.join(__dirname, '..', 'data');
    try {
        await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
        // Directory already exists
    }
};

// Load existing data on startup
const loadExistingData = async () => {
    try {
        await ensureDataDir();
        
        // Load transactions
        try {
            const transactionData = await fs.readFile(TRANSACTIONS_FILE, 'utf8');
            const transactions = JSON.parse(transactionData);
            transactions.forEach(tx => transactionCache.set(tx.orderId, tx));
            console.log(`Loaded ${transactions.length} existing transactions`);
        } catch (error) {
            console.log('No existing transactions file found, starting fresh');
        }

        // Load callbacks
        try {
            const callbackData = await fs.readFile(CALLBACKS_FILE, 'utf8');
            const callbacks = JSON.parse(callbackData);
            callbacks.forEach(cb => callbackCache.set(cb.orderId, cb));
            console.log(`Loaded ${callbacks.length} existing callbacks`);
        } catch (error) {
            console.log('No existing callbacks file found, starting fresh');
        }
    } catch (error) {
        console.error('Error loading existing data:', error.message);
    }
};

// Save transaction
const saveTransaction = async (transactionData) => {
    try {
        const transaction = {
            ...transactionData,
            createdAt: new Date().toISOString(),
            status: 'initiated'
        };
        
        // Store in cache
        transactionCache.set(transaction.orderId, transaction);
        
        // Persist to file (async, don't wait)
        setImmediate(async () => {
            try {
                const allTransactions = Array.from(transactionCache.values());
                await fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(allTransactions, null, 2));
            } catch (error) {
                console.error('Error persisting transaction:', error.message);
            }
        });
        
        return transaction;
    } catch (error) {
        console.error('Error saving transaction:', error.message);
        throw error;
    }
};

// Save callback
const saveCallback = async (callbackData) => {
    try {
        const callback = {
            ...callbackData,
            receivedAt: new Date().toISOString()
        };
        
        // Store in cache
        callbackCache.set(callback.orderId, callback);
        
        // Update transaction status if exists
        const transaction = transactionCache.get(callback.orderId);
        if (transaction) {
            transaction.status = callback.ResultCode === '0' ? 'completed' : 'failed';
            transaction.resultCode = callback.ResultCode;
            transaction.resultDesc = callback.ResultDesc;
            transaction.updatedAt = new Date().toISOString();
            transactionCache.set(callback.orderId, transaction);
        }
        
        // Persist to files (async, don't wait)
        setImmediate(async () => {
            try {
                const allCallbacks = Array.from(callbackCache.values());
                const allTransactions = Array.from(transactionCache.values());
                
                await Promise.all([
                    fs.writeFile(CALLBACKS_FILE, JSON.stringify(allCallbacks, null, 2)),
                    fs.writeFile(TRANSACTIONS_FILE, JSON.stringify(allTransactions, null, 2))
                ]);
            } catch (error) {
                console.error('Error persisting callback:', error.message);
            }
        });
        
        return callback;
    } catch (error) {
        console.error('Error saving callback:', error.message);
        throw error;
    }
};

// Get transaction by orderId
const getTransaction = (orderId) => {
    return transactionCache.get(orderId);
};

// Get callback by orderId
const getCallback = (orderId) => {
    return callbackCache.get(orderId);
};

// Get all transactions (with pagination)
const getAllTransactions = (page = 1, limit = 50) => {
    const transactions = Array.from(transactionCache.values());
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    return {
        data: transactions.slice(startIndex, endIndex),
        total: transactions.length,
        page,
        limit,
        totalPages: Math.ceil(transactions.length / limit)
    };
};

// Get transaction statistics
const getStats = () => {
    const transactions = Array.from(transactionCache.values());
    const completed = transactions.filter(tx => tx.status === 'completed').length;
    const failed = transactions.filter(tx => tx.status === 'failed').length;
    const pending = transactions.filter(tx => tx.status === 'initiated').length;
    
    return {
        total: transactions.length,
        completed,
        failed,
        pending,
        successRate: transactions.length > 0 ? (completed / transactions.length * 100).toFixed(2) : 0
    };
};

// Initialize on module load
loadExistingData();

module.exports = {
    saveTransaction,
    saveCallback,
    getTransaction,
    getCallback,
    getAllTransactions,
    getStats
};