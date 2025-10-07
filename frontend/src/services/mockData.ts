// Mock data for development
export const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'customer@paygateway.com',
  phone: '+254700000000',
  avatar: null,
  verified: true,
  createdAt: '2024-01-01T00:00:00Z',
};

export const mockTransactions = [
  {
    id: '1',
    amount: 1500,
    currency: 'KES',
    status: 'completed',
    type: 'payment',
    method: 'M-Pesa',
    description: 'Payment to John Doe',
    reference: 'TXN001',
    fees: 25,
    createdAt: '2024-12-07T10:30:00Z',
    updatedAt: '2024-12-07T10:30:00Z',
    recipient: {
      name: 'John Doe',
      account: '+254700000000'
    },
    metadata: {}
  },
  {
    id: '2',
    amount: 2500,
    currency: 'KES',
    status: 'pending',
    type: 'payment',
    method: 'Credit Card',
    description: 'Online payment',
    reference: 'TXN002',
    fees: 50,
    createdAt: '2024-12-07T09:15:00Z',
    updatedAt: '2024-12-07T09:15:00Z',
    metadata: {}
  },
  {
    id: '3',
    amount: 5000,
    currency: 'KES',
    status: 'failed',
    type: 'payment',
    method: 'Bank Transfer',
    description: 'Failed bank transfer',
    reference: 'TXN003',
    fees: 0,
    createdAt: '2024-12-06T14:20:00Z',
    updatedAt: '2024-12-06T14:20:00Z',
    metadata: {}
  },
  {
    id: '4',
    amount: 3200,
    currency: 'KES',
    status: 'completed',
    type: 'refund',
    method: 'M-Pesa',
    description: 'Refund processed',
    reference: 'TXN004',
    fees: 0,
    createdAt: '2024-12-05T16:45:00Z',
    updatedAt: '2024-12-05T16:45:00Z',
    metadata: {}
  }
];

export const mockPaymentMethods = [
  {
    id: '1',
    type: 'mpesa',
    name: 'My M-Pesa',
    details: '+254700000000',
    isDefault: true,
    verified: true,
    lastUsed: '2024-12-07T10:30:00Z',
    metadata: {
      phoneNumber: '+254700000000'
    }
  },
  {
    id: '2',
    type: 'card',
    name: 'Visa **** 1234',
    details: 'Expires 12/26',
    isDefault: false,
    verified: true,
    lastUsed: '2024-12-06T14:20:00Z',
    metadata: {
      last4: '1234',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2026
    }
  }
];

export const mockStats = {
  totalTransactions: 156,
  totalAmount: 75000,
  successRate: 94.5,
  pendingTransactions: 3,
  monthlyVolume: 45000
};