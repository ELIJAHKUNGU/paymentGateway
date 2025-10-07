const axios = require('axios');

const BASE_URL = 'http://localhost:4001/api/v1/auth';

const quickTest = async () => {
  try {
    console.log('🧪 Quick API Test\n');

    // Test 1: Register a test user
    console.log('1. Registering test user...');
    const userData = {
      name: 'Test Customer',
      email: 'customer@paygateway.com',
      password: 'Customer123!',
      role: 'customer'
    };

    try {
      const registerResponse = await axios.post(`${BASE_URL}/register`, userData);
      console.log('✅ Registration successful');
      console.log('Token:', registerResponse.data.data.token.substring(0, 20) + '...');
    } catch (error) {
      if (error.response?.data?.message?.includes('already exists')) {
        console.log('ℹ️  User already exists, proceeding to login...');
      } else {
        console.log('❌ Registration failed:', error.response?.data?.message || error.message);
      }
    }

    // Test 2: Login with the user
    console.log('\n2. Testing login...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/login`, {
        email: 'customer@paygateway.com',
        password: 'Customer123!'
      });
      console.log('✅ Login successful');
      console.log('User:', loginResponse.data.data.user.name);
      console.log('Token:', loginResponse.data.data.token.substring(0, 20) + '...');
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data?.message || error.message);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

quickTest();