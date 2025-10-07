import React, { createContext, useContext, useState, useEffect } from 'react';
import { paymentApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  type: 'payment' | 'refund' | 'withdrawal';
  method: string;
  description: string;
  reference: string;
  fees: number;
  createdAt: string;
  updatedAt: string;
  recipient?: {
    name: string;
    account: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  _id?: string; // MongoDB ObjectId
  type: 'mpesa' | 'card' | 'bank' | 'paypal';
  name: string;
  details: string;
  isDefault: boolean;
  verified: boolean;
  lastUsed?: string;
  metadata: Record<string, any>;
}

interface PaymentStats {
  totalTransactions: number;
  totalAmount: number;
  successRate: number;
  pendingTransactions: number;
  monthlyVolume: number;
}

interface PaymentContextType {
  transactions: Transaction[];
  paymentMethods: PaymentMethod[];
  stats: PaymentStats | null;
  isLoading: boolean;
  fetchTransactions: () => Promise<void>;
  fetchPaymentMethods: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createTransaction: (data: CreateTransactionData) => Promise<Transaction>;
  addPaymentMethod: (data: AddPaymentMethodData) => Promise<PaymentMethod>;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultPaymentMethod: (id: string) => Promise<void>;
}

interface CreateTransactionData {
  amount: number;
  currency: string;
  method: string;
  description: string;
  recipient?: {
    name: string;
    account: string;
  };
  metadata?: Record<string, any>;
}

interface AddPaymentMethodData {
  type: PaymentMethod['type'];
  name: string;
  details: string;
  metadata: Record<string, any>;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (context === undefined) {
    throw new Error('usePayment must be used within a PaymentProvider');
  }
  return context;
};

export const PaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactions();
      fetchPaymentMethods();
      fetchStats();
    }
  }, [isAuthenticated]);

  const fetchTransactions = async () => {
    try {
      setIsLoading(true);
      const response = await paymentApi.getTransactions();
      if (response.success) {
        setTransactions(response.data);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const response = await paymentApi.getPaymentMethods();
      if (response.success) {
        setPaymentMethods(response.data);
      }
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await paymentApi.getStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const createTransaction = async (data: CreateTransactionData): Promise<Transaction> => {
    try {
      const response = await paymentApi.createTransaction(data);
      if (response.success) {
        setTransactions(prev => [response.data, ...prev]);
        return response.data;
      }
      throw new Error(response.message || 'Transaction failed');
    } catch (error: any) {
      // Handle different types of errors for better user feedback
      let errorMessage = 'Transaction failed';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const addPaymentMethod = async (data: AddPaymentMethodData): Promise<PaymentMethod> => {
    try {
      const response = await paymentApi.addPaymentMethod(data);
      if (response.success) {
        setPaymentMethods(prev => [...prev, response.data]);
        return response.data;
      }
      throw new Error(response.message || 'Failed to add payment method');
    } catch (error: any) {
      // Handle different types of errors for better user feedback
      let errorMessage = 'Failed to add payment method';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const removePaymentMethod = async (id: string) => {
    try {
      const response = await paymentApi.removePaymentMethod(id);
      if (response.success) {
        // Force refresh from server to ensure UI is updated
        await fetchPaymentMethods();
      } else {
        throw new Error(response.message || 'Failed to remove payment method');
      }
    } catch (error: any) {
      // Handle different types of errors for better user feedback
      let errorMessage = 'Failed to remove payment method';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const setDefaultPaymentMethod = async (id: string) => {
    try {
      const response = await paymentApi.setDefaultPaymentMethod(id);
      if (response.success) {
        setPaymentMethods(prev => 
          prev.map(method => ({
            ...method,
            isDefault: method.id === id
          }))
        );
      } else {
        throw new Error(response.message || 'Failed to set default payment method');
      }
    } catch (error: any) {
      // Handle different types of errors for better user feedback
      let errorMessage = 'Failed to set default payment method';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        errorMessage = error.response.data.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  };

  const value = {
    transactions,
    paymentMethods,
    stats,
    isLoading,
    fetchTransactions,
    fetchPaymentMethods,
    fetchStats,
    createTransaction,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
  };

  return <PaymentContext.Provider value={value}>{children}</PaymentContext.Provider>;
};