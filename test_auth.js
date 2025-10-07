const axios = require('axios');

const BASE_URL = 'http://localhost:4001/api/v1/auth';

// Test authentication endpoints
const testAuth = async () => {
  try {
    console.log('🧪 Testing Payment Gateway Authentication API\n');

    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      password: 'SecurePass123!',
      phone: '+254700000000',
      role: 'customer'
    };

    try {
      const registerResponse = await axios.post(`${BASE_URL}/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data.message);
      console.log('   User ID:', registerResponse.data.data.user.id);
      console.log('   Token received:', !!registerResponse.data.data.token);
    } catch (error) {
      console.log('❌ Registration failed:', error.response?.data?.message || error.message);
    }

    console.log();

    // Test 2: Login with valid credentials
    console.log('2. Testing user login...');
    const loginData = {
      email: 'john.doe@example.com',
      password: 'SecurePass123!'
    };

    let authToken = null;
    try {
      const loginResponse = await axios.post(`${BASE_URL}/login`, loginData);
      console.log('✅ Login successful:', loginResponse.data.message);
      authToken = loginResponse.data.data.token;
      console.log('   Token received:', !!authToken);
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data?.message || error.message);
    }

    console.log();

    // Test 3: Get current user info (protected route)
    if (authToken) {
      console.log('3. Testing protected route (get current user)...');
      try {
        const meResponse = await axios.get(`${BASE_URL}/me`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('✅ Get user info successful');
        console.log('   User name:', meResponse.data.data.name);
        console.log('   User email:', meResponse.data.data.email);
        console.log('   User role:', meResponse.data.data.role);
      } catch (error) {
        console.log('❌ Get user info failed:', error.response?.data?.message || error.message);
      }
    }

    console.log();

    // Test 4: Update user profile
    if (authToken) {
      console.log('4. Testing profile update...');
      const updateData = {
        name: 'John Updated Doe',
        phone: '+254700000001'
      };

      try {
        const updateResponse = await axios.put(`${BASE_URL}/profile`, updateData, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('✅ Profile update successful:', updateResponse.data.message);
        console.log('   Updated name:', updateResponse.data.data.name);
      } catch (error) {
        console.log('❌ Profile update failed:', error.response?.data?.message || error.message);
      }
    }

    console.log();

    // Test 5: Test invalid login
    console.log('5. Testing invalid login...');
    const invalidLoginData = {
      email: 'john.doe@example.com',
      password: 'wrongpassword'
    };

    try {
      await axios.post(`${BASE_URL}/login`, invalidLoginData);
      console.log('❌ Invalid login should have failed');
    } catch (error) {
      console.log('✅ Invalid login correctly rejected:', error.response?.data?.message);
    }

    console.log();

    // Test 6: Test unauthorized access
    console.log('6. Testing unauthorized access...');
    try {
      await axios.get(`${BASE_URL}/me`);
      console.log('❌ Unauthorized access should have failed');
    } catch (error) {
      console.log('✅ Unauthorized access correctly rejected:', error.response?.data?.message);
    }

    console.log();

    // Test 7: Logout
    if (authToken) {
      console.log('7. Testing logout...');
      try {
        const logoutResponse = await axios.post(`${BASE_URL}/logout`, {}, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        console.log('✅ Logout successful:', logoutResponse.data.message);
      } catch (error) {
        console.log('❌ Logout failed:', error.response?.data?.message || error.message);
      }
    }

    console.log('\n🎉 Authentication API tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run tests if server is running
testAuth();