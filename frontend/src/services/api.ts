import axios from 'axios';
import { mockUser, mockTransactions, mockPaymentMethods, mockStats } from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api/v1';
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA !== 'false'; // Default to true in development

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    
    // Enhance error with better message for frontend
    if (error.response?.data) {
      const errorData = error.response.data;
      
      // If there are validation errors, use the first one
      if (errorData.errors && errorData.errors.length > 0) {
        error.message = errorData.errors[0].message;
      } else if (errorData.message) {
        error.message = errorData.message;
      }
    }
    
    return Promise.reject(error);
  }
);

// API Response interface
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// Mock delay helper
const mockDelay = (ms: number = 1000) => new Promise(resolve => setTimeout(resolve, ms));

// Auth API
export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1000);
      // Simple mock login - accept any credentials that match demo accounts
      const demoAccounts = [
        'customer@paygateway.com',
        'business@paygateway.com', 
        'admin@paygateway.com'
      ];
      
      if (demoAccounts.includes(credentials.email)) {
        return {
          success: true,
          data: {
            token: 'mock-jwt-token',
            user: mockUser
          }
        };
      } else {
        throw new Error('Invalid credentials');
      }
    }
    
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1500);
      return {
        success: true,
        data: {
          token: 'mock-jwt-token',
          user: { ...mockUser, ...userData, id: Date.now().toString() }
        }
      };
    }
    
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  me: async (): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(500);
      return {
        success: true,
        data: mockUser
      };
    }
    
    const response = await api.get('/auth/me');
    return response.data;
  },

  updateProfile: async (data: any): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(800);
      return {
        success: true,
        data: { ...mockUser, ...data }
      };
    }
    
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1000);
      return {
        success: true,
        data: { message: 'Password updated successfully' }
      };
    }
    
    const response = await api.put('/auth/change-password', data);
    return response.data;
  },
};

// Payment API
export const paymentApi = {
  getTransactions: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(800);
      return {
        success: true,
        data: mockTransactions
      };
    }
    
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  createTransaction: async (data: {
    amount: number;
    currency: string;
    method: string;
    description: string;
    recipient?: any;
    metadata?: any;
  }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1200);
      const newTransaction = {
        id: Date.now().toString(),
        ...data,
        status: 'pending',
        fees: data.amount * 0.02, // 2% fee
        reference: `TXN${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        success: true,
        data: newTransaction
      };
    }
    
    const response = await api.post('/transactions', data);
    return response.data;
  },

  getTransaction: async (id: string): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(500);
      const transaction = mockTransactions.find(t => t.id === id);
      return {
        success: !!transaction,
        data: transaction
      };
    }
    
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  getPaymentMethods: async (): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(600);
      return {
        success: true,
        data: mockPaymentMethods
      };
    }
    
    const response = await api.get('/payment-methods');
    return response.data;
  },

  addPaymentMethod: async (data: {
    type: string;
    name: string;
    details: string;
    metadata: any;
  }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1000);
      const newMethod = {
        id: Date.now().toString(),
        ...data,
        isDefault: false,
        verified: true,
        lastUsed: null
      };
      return {
        success: true,
        data: newMethod
      };
    }
    
    const response = await api.post('/payment-methods', data);
    return response.data;
  },

  removePaymentMethod: async (id: string): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(800);
      return {
        success: true,
        data: { message: 'Payment method removed successfully' }
      };
    }
    
    const response = await api.delete(`/payment-methods/${id}`);
    return response.data;
  },

  setDefaultPaymentMethod: async (id: string): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(600);
      return {
        success: true,
        data: { message: 'Default payment method updated' }
      };
    }
    
    const response = await api.put(`/payment-methods/${id}/default`);
    return response.data;
  },

  getStats: async (): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(500);
      return {
        success: true,
        data: mockStats
      };
    }
    
    const response = await api.get('/stats');
    return response.data;
  },

  // M-Pesa specific endpoints
  initiateMpesaPayment: async (data: {
    amount: number;
    phoneNumber: string;
    description: string;
  }): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(2000);
      return {
        success: true,
        data: {
          checkoutRequestId: `CR${Date.now()}`,
          message: 'STK Push sent successfully'
        }
      };
    }
    
    const response = await api.post('/mpesa/stkpush', data);
    return response.data;
  },

  checkMpesaStatus: async (checkoutRequestId: string): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1000);
      return {
        success: true,
        data: {
          status: 'completed',
          transactionId: `TXN${Date.now()}`
        }
      };
    }
    
    const response = await api.get(`/mpesa/status/${checkoutRequestId}`);
    return response.data;
  },
};

// M-Pesa Keys API
export const mpesaKeysApi = {
  getMyKeys: async (): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(500);
      return {
        success: true,
        data: [
          {
            id: '1',
            name: 'My Default M-Pesa',
            environment: 'production',
            status: 'active',
            approval: { status: 'approved' },
            maskedCredentials: {
              consumerKey: 'eCuv****',
              businessShortCode: '7573525'
            },
            settings: {
              callbackUrl: 'https://mysite.com/callback'
            },
            isDefault: true,
            createdAt: new Date().toISOString()
          }
        ]
      };
    }
    
    const response = await api.get('/mpesa-keys/my-keys');
    return response.data;
  },

  createKeys: async (data: any): Promise<ApiResponse> => {
    if (USE_MOCK_DATA) {
      await mockDelay(1200);
      return {
        success: true,
        data: {
          id: Date.now().toString(),
          ...data,
          status: 'active',
          isEncrypted: true
        }
      };
    }
    
    const response = await api.post('/mpesa-keys', data);
    return response.data;
  },

  updateKeys: async (id: string, data: any): Promise<ApiResponse> => {
    const response = await api.put(`/mpesa-keys/${id}`, data);
    return response.data;
  },

  deleteKeys: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/mpesa-keys/${id}`);
    return response.data;
  },

  testKeys: async (id: string): Promise<ApiResponse> => {
    const response = await api.post(`/mpesa-keys/${id}/test`);
    return response.data;
  },

  setDefault: async (id: string): Promise<ApiResponse> => {
    const response = await api.put(`/mpesa-keys/${id}/set-default`);
    return response.data;
  },
};

// Webhook API (for testing)
export const webhookApi = {
  testCallback: async (data: any): Promise<ApiResponse> => {
    const response = await api.post('/test-callback-sending/test', data);
    return response.data;
  },
};

export default api;