const { banksPayBills } = require("../utils/data");

class BankService {
    constructor() {
        // Create a Map for faster lookups (O(1) instead of O(n))
        this.bankCache = new Map();
        this.initializeCache();
    }

    // Initialize the cache with bank data
    initializeCache() {
        banksPayBills.forEach(bank => {
            this.bankCache.set(bank.bankName, {
                name: bank.bankName,
                ussd: bank.ussd,
                paybill: bank.paybill
            });
        });
        console.log(`Initialized bank cache with ${this.bankCache.size} banks`);
    }

    // Get paybill number for a specific bank
    getBanksPaybill(bankName) {
        const bankDetails = this.bankCache.get(bankName);
        if (!bankDetails) {
            throw new Error(`Bank provider '${bankName}' doesn't exist`);
        }
        return bankDetails.paybill;
    }

    // Get all bank information
    getAllBanks() {
        try {
            const banks = Array.from(this.bankCache.values()).map(bank => ({
                name: bank.name,
                // ussd: bank.ussd,
                // paybill: bank.paybill
            }));

            return {
                banks,
                count: banks.length
            };
        } catch (error) {
            console.error('Error retrieving banks:', error.message);
            throw new Error(`Failed to retrieve banks: ${error.message}`);
        }
    }

    // Get bank details by name
    getBankByName(bankName) {
        const bankDetails = this.bankCache.get(bankName);
        if (!bankDetails) {
            throw new Error(`Bank '${bankName}' not found`);
        }
        return bankDetails;
    }

    // Search banks by partial name
    searchBanks(searchTerm) {
        try {
            const searchLower = searchTerm.toLowerCase();
            const matchingBanks = Array.from(this.bankCache.values())
                .filter(bank => bank.name.toLowerCase().includes(searchLower));

            return {
                banks: matchingBanks,
                count: matchingBanks.length
            };
        } catch (error) {
            console.error('Error searching banks:', error.message);
            throw new Error(`Failed to search banks: ${error.message}`);
        }
    }

    // Validate if bank exists
    validateBank(bankName) {
        return this.bankCache.has(bankName);
    }

    // Get banks grouped by type (regular vs DTM)
    getBanksByType() {
        try {
            const regularBanks = [];
            const dtmProviders = [];

            Array.from(this.bankCache.values()).forEach(bank => {
                if (bank.name.includes('DTM') || bank.name.includes('Musoni') || 
                    bank.name.includes('Vision Fund') || bank.name.includes('Rafiki')) {
                    dtmProviders.push(bank);
                } else {
                    regularBanks.push(bank);
                }
            });

            return {
                regularBanks: {
                    data: regularBanks,
                    count: regularBanks.length
                },
                dtmProviders: {
                    data: dtmProviders,
                    count: dtmProviders.length
                }
            };
        } catch (error) {
            console.error('Error grouping banks by type:', error.message);
            throw new Error(`Failed to group banks: ${error.message}`);
        }
    }

    // Get bank statistics
    getBankStats() {
        try {
            const banks = Array.from(this.bankCache.values());
            const ussdBanks = banks.filter(bank => bank.ussd && bank.ussd !== 'APP').length;
            const appBanks = banks.filter(bank => bank.ussd === 'APP').length;
            
            return {
                totalBanks: banks.length,
                ussdEnabled: ussdBanks,
                appOnly: appBanks,
                averagePaybill: Math.round(banks.reduce((sum, bank) => sum + bank.paybill, 0) / banks.length)
            };
        } catch (error) {
            console.error('Error getting bank statistics:', error.message);
            throw new Error(`Failed to get bank statistics: ${error.message}`);
        }
    }

    // Health check for bank service
    healthCheck() {
        try {
            const cacheSize = this.bankCache.size;
            const expectedSize = banksPayBills.length;
            
            if (cacheSize !== expectedSize) {
                return {
                    status: 'unhealthy',
                    error: `Cache size mismatch: expected ${expectedSize}, got ${cacheSize}`
                };
            }

            return {
                status: 'healthy',
                message: `Bank service operational with ${cacheSize} banks loaded`
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    // Refresh cache (useful for updating bank data without restart)
    refreshCache() {
        try {
            this.bankCache.clear();
            this.initializeCache();
            console.log('Bank cache refreshed successfully');
            return true;
        } catch (error) {
            console.error('Error refreshing bank cache:', error.message);
            throw new Error(`Failed to refresh bank cache: ${error.message}`);
        }
    }
}

// Export singleton instance
const bankService = new BankService();

// Export methods for backward compatibility
module.exports = {
    getBanksPaybill: (bankName) => bankService.getBanksPaybill(bankName),
    getAllBanks: () => bankService.getAllBanks(),
    getBankByName: (bankName) => bankService.getBankByName(bankName),
    searchBanks: (searchTerm) => bankService.searchBanks(searchTerm),
    validateBank: (bankName) => bankService.validateBank(bankName),
    getBanksByType: () => bankService.getBanksByType(),
    getBankStats: () => bankService.getBankStats(),
    healthCheck: () => bankService.healthCheck(),
    refreshCache: () => bankService.refreshCache(),
    
    // Export the service instance
    bankService
};