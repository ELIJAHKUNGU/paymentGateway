const axios = require('axios');

const BASE_URL = 'http://localhost:4001/api/v1';

const setupDemoData = async () => {
  try {
    console.log('🔧 Setting up demo data for frontend testing\n');

    // Create demo users
    const demoUsers = [
      {
        name: 'John Customer',
        email: 'customer@paygateway.com',
        password: 'Customer123!',
        phone: '+254700000001',
        role: 'customer'
      },
      {
        name: 'Jane Business',
        email: 'business@paygateway.com', 
        password: 'Business123!',
        phone: '+254700000002',
        role: 'customer'
      },
      {
        name: 'Admin User',
        email: 'admin@paygateway.com',
        password: 'Admin123!',
        phone: '+254700000003',
        role: 'admin'
      }
    ];

    const tokens = [];

    // Register users
    console.log('1. Creating demo users...');
    for (const user of demoUsers) {
      try {
        const response = await axios.post(`${BASE_URL}/auth/register`, user);
        tokens.push({
          user: user.email,
          token: response.data.data.token
        });
        console.log(`✅ Created ${user.role}: ${user.email}`);
      } catch (error) {
        if (error.response?.data?.message?.includes('already exists')) {
          // User exists, login instead
          try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
              email: user.email,
              password: user.password
            });
            tokens.push({
              user: user.email,
              token: loginResponse.data.data.token
            });
            console.log(`ℹ️  ${user.role} already exists: ${user.email}`);
          } catch (loginError) {
            console.log(`❌ Failed to login ${user.email}:`, loginError.response?.data?.message);
          }
        } else {
          console.log(`❌ Failed to create ${user.email}:`, error.response?.data?.message);
        }
      }
    }

    console.log('\n2. Adding payment methods and transactions...');

    // Add data for each customer
    for (const { user, token } of tokens.filter(t => t.user.includes('customer') || t.user.includes('business'))) {
      console.log(`\n   Setting up data for ${user}...`);
      
      // Add payment methods
      const paymentMethods = [
        {
          type: 'mpesa',
          name: 'My M-Pesa Account',
          details: '+254700000000',
          metadata: { phoneNumber: '+254700000000' }
        },
        {
          type: 'card',
          name: 'Primary Visa Card',
          details: 'Visa ending in 1234',
          metadata: {
            last4: '1234',
            brand: 'visa',
            expiryMonth: 12,
            expiryYear: 2026,
            holderName: user.split('@')[0]
          }
        }
      ];

      for (const method of paymentMethods) {
        try {
          await axios.post(`${BASE_URL}/payment-methods`, method, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          console.log(`     ✅ Added ${method.type} payment method`);
        } catch (error) {
          console.log(`     ❌ Failed to add ${method.type}`);
        }
      }

      // Add sample transactions
      const transactions = [
        {
          amount: 1500,
          currency: 'KES',
          method: 'M-Pesa',
          description: 'Coffee shop payment',
          type: 'payment',
          recipient: { name: 'Java House', account: '+254711000001' }
        },
        {
          amount: 3200,
          currency: 'KES', 
          method: 'Visa Card',
          description: 'Online shopping',
          type: 'payment',
          recipient: { name: 'Jumia Kenya', account: 'orders@jumia.co.ke' }
        },
        {
          amount: 850,
          currency: 'KES',
          method: 'M-Pesa',
          description: 'Uber ride payment',
          type: 'payment',
          recipient: { name: 'Uber Kenya', account: '+254711000002' }
        },
        {
          amount: 2000,
          currency: 'KES',
          method: 'Bank Transfer',
          description: 'Refund from store',
          type: 'refund'
        },
        {
          amount: 5000,
          currency: 'KES',
          method: 'M-Pesa',
          description: 'Salary deposit',
          type: 'deposit'
        }
      ];

      for (const transaction of transactions) {
        try {
          await axios.post(`${BASE_URL}/transactions`, transaction, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          console.log(`     ✅ Added transaction: ${transaction.description}`);
        } catch (error) {
          console.log(`     ❌ Failed to add transaction: ${transaction.description}`);
        }
      }
    }

    console.log('\n🎉 Demo data setup complete!\n');
    
    console.log('🚀 READY TO TEST:');
    console.log('   Frontend: http://localhost:3000');
    console.log('   Backend:  http://localhost:4001');
    console.log('\n👤 Demo Login Credentials:');
    console.log('   Customer: customer@paygateway.com / Customer123!');
    console.log('   Business: business@paygateway.com / Business123!');
    console.log('   Admin:    admin@paygateway.com    / Admin123!');
    
    console.log('\n📊 Features to test in frontend:');
    console.log('   ✅ User registration and login');
    console.log('   ✅ Dashboard with real transaction data');
    console.log('   ✅ Payment methods management');
    console.log('   ✅ Transaction history and filtering');
    console.log('   ✅ Profile and settings management');

  } catch (error) {
    console.error('❌ Demo data setup failed:', error.message);
  }
};

setupDemoData();