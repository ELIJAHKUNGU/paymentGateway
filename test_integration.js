const axios = require('axios');

const BASE_URL = 'http://localhost:4001/api/v1';

const testIntegration = async () => {
  try {
    console.log('🔗 Testing Frontend-Backend Integration\n');

    // Test 1: Create or login a user
    console.log('1. Setting up test user...');
    
    let authToken = null;
    const testUser = {
      name: 'Customer Portal User',
      email: 'customer@paygateway.com',
      password: 'Customer123!',
      role: 'customer'
    };

    try {
      // Try to register
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, testUser);
      authToken = registerResponse.data.data.token;
      console.log('✅ User registered successfully');
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        // User exists, try to login
        try {
          const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: testUser.email,
            password: testUser.password
          });
          authToken = loginResponse.data.data.token;
          console.log('✅ User login successful');
        } catch (loginError) {
          console.log('❌ Login failed:', loginError.response?.data?.message);
          return;
        }
      } else {
        console.log('❌ Registration failed:', error.response?.data?.message);
        return;
      }
    }

    if (!authToken) {
      console.log('❌ Could not get auth token');
      return;
    }

    console.log();

    // Test 2: Add payment methods
    console.log('2. Adding payment methods...');
    
    const paymentMethods = [
      {
        type: 'mpesa',
        name: 'My M-Pesa',
        details: '+254700000000',
        metadata: {
          phoneNumber: '+254700000000'
        }
      },
      {
        type: 'card',
        name: 'My Visa Card',
        details: 'Visa **** 1234',
        metadata: {
          last4: '1234',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2026,
          holderName: 'Customer Portal User'
        }
      }
    ];

    for (const method of paymentMethods) {
      try {
        const response = await axios.post(`${BASE_URL}/payment-methods`, method, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log(`✅ Added ${method.type} payment method`);
      } catch (error) {
        console.log(`❌ Failed to add ${method.type}:`, error.response?.data?.message);
      }
    }

    console.log();

    // Test 3: Create some sample transactions
    console.log('3. Creating sample transactions...');
    
    const transactions = [
      {
        amount: 1500,
        currency: 'KES',
        method: 'M-Pesa',
        description: 'Coffee shop payment',
        type: 'payment',
        recipient: {
          name: 'Coffee House Kenya',
          account: '+254711000000'
        }
      },
      {
        amount: 2500,
        currency: 'KES',
        method: 'Visa Card',
        description: 'Online shopping',
        type: 'payment',
        recipient: {
          name: 'Online Store Ltd',
          account: 'merchant@store.com'
        }
      },
      {
        amount: 5000,
        currency: 'KES',
        method: 'M-Pesa',
        description: 'Refund received',
        type: 'refund'
      }
    ];

    for (const transaction of transactions) {
      try {
        const response = await axios.post(`${BASE_URL}/transactions`, transaction, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        console.log(`✅ Created ${transaction.type}: ${transaction.description}`);
      } catch (error) {
        console.log(`❌ Failed to create transaction:`, error.response?.data?.message);
      }
    }

    console.log();

    // Test 4: Fetch data that frontend will use
    console.log('4. Testing frontend data endpoints...');
    
    try {
      // Get user info
      const meResponse = await axios.get(`${BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('✅ User info retrieved:', meResponse.data.data.name);

      // Get payment methods
      const methodsResponse = await axios.get(`${BASE_URL}/payment-methods`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log(`✅ Payment methods retrieved: ${methodsResponse.data.data.length} methods`);

      // Get transactions
      const transactionsResponse = await axios.get(`${BASE_URL}/transactions`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log(`✅ Transactions retrieved: ${transactionsResponse.data.data.length} transactions`);

      // Get stats
      const statsResponse = await axios.get(`${BASE_URL}/stats`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('✅ Stats retrieved:', {
        totalTransactions: statsResponse.data.data.totalTransactions,
        totalAmount: statsResponse.data.data.totalAmount
      });

    } catch (error) {
      console.log('❌ Data fetch failed:', error.response?.data?.message || error.message);
    }

    console.log('\n🎉 Integration test completed!');
    console.log('\n📱 Frontend should now work with backend at:');
    console.log('   Backend: http://localhost:4001');
    console.log('   Frontend: http://localhost:3000');
    console.log('\n🔑 Use these credentials to login:');
    console.log('   Email: customer@paygateway.com');
    console.log('   Password: Customer123!');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
};

testIntegration();