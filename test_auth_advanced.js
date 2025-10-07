const axios = require('axios');

const BASE_URL = 'http://localhost:4001/api/v1/auth';

// Test advanced authentication features
const testAdvancedAuth = async () => {
  try {
    console.log('🔬 Testing Advanced Authentication Features\n');

    // Test 1: Password validation during registration
    console.log('1. Testing password validation...');
    const weakPasswordData = {
      name: 'Test User',
      email: 'test.weak@example.com',
      password: '123', // Weak password
      role: 'customer'
    };

    try {
      await axios.post(`${BASE_URL}/register`, weakPasswordData);
      console.log('❌ Weak password should have been rejected');
    } catch (error) {
      console.log('✅ Weak password correctly rejected:', error.response?.data?.errors?.[0]?.message);
    }

    console.log();

    // Test 2: Email validation
    console.log('2. Testing email validation...');
    const invalidEmailData = {
      name: 'Test User',
      email: 'invalid-email', // Invalid email
      password: 'ValidPass123!',
      role: 'customer'
    };

    try {
      await axios.post(`${BASE_URL}/register`, invalidEmailData);
      console.log('❌ Invalid email should have been rejected');
    } catch (error) {
      console.log('✅ Invalid email correctly rejected:', error.response?.data?.errors?.[0]?.message);
    }

    console.log();

    // Test 3: Duplicate email registration
    console.log('3. Testing duplicate email registration...');
    const duplicateEmailData = {
      name: 'Another User',
      email: 'john.doe@example.com', // Email already used in previous test
      password: 'AnotherPass123!',
      role: 'customer'
    };

    try {
      await axios.post(`${BASE_URL}/register`, duplicateEmailData);
      console.log('❌ Duplicate email should have been rejected');
    } catch (error) {
      console.log('✅ Duplicate email correctly rejected:', error.response?.data?.message);
    }

    console.log();

    // Test 4: Register and test password change
    console.log('4. Testing password change...');
    
    // First register a new user
    const newUserData = {
      name: 'Password Test User',
      email: 'password.test@example.com',
      password: 'OldPass123!',
      role: 'customer'
    };

    let authToken = null;
    try {
      const registerResponse = await axios.post(`${BASE_URL}/register`, newUserData);
      authToken = registerResponse.data.data.token;
      console.log('   ✅ User registered for password change test');
    } catch (error) {
      console.log('   ❌ Failed to register user for password test:', error.response?.data?.message);
      return;
    }

    // Test password change with wrong current password
    try {
      await axios.put(`${BASE_URL}/change-password`, {
        currentPassword: 'WrongPass123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!'
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('   ❌ Password change with wrong current password should fail');
    } catch (error) {
      console.log('   ✅ Wrong current password correctly rejected:', error.response?.data?.message);
    }

    // Test password change with correct current password
    try {
      await axios.put(`${BASE_URL}/change-password`, {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass123!',
        confirmPassword: 'NewPass123!'
      }, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      console.log('   ✅ Password change successful');
    } catch (error) {
      console.log('   ❌ Password change failed:', error.response?.data?.message);
    }

    console.log();

    // Test 5: Login with old password should fail, new password should work
    console.log('5. Testing login with old vs new password...');
    
    // Try login with old password
    try {
      await axios.post(`${BASE_URL}/login`, {
        email: 'password.test@example.com',
        password: 'OldPass123!'
      });
      console.log('   ❌ Login with old password should fail');
    } catch (error) {
      console.log('   ✅ Login with old password correctly rejected');
    }

    // Try login with new password
    try {
      const loginResponse = await axios.post(`${BASE_URL}/login`, {
        email: 'password.test@example.com',
        password: 'NewPass123!'
      });
      console.log('   ✅ Login with new password successful');
    } catch (error) {
      console.log('   ❌ Login with new password failed:', error.response?.data?.message);
    }

    console.log();

    // Test 6: Token refresh functionality
    console.log('6. Testing token refresh...');
    
    // Get a refresh token
    const loginResponse = await axios.post(`${BASE_URL}/login`, {
      email: 'password.test@example.com',
      password: 'NewPass123!'
    });
    
    const refreshToken = loginResponse.data.data.refreshToken;
    
    try {
      const refreshResponse = await axios.post(`${BASE_URL}/refresh`, {
        refreshToken: refreshToken
      });
      console.log('   ✅ Token refresh successful');
      console.log('   ✅ New token received:', !!refreshResponse.data.data.token);
    } catch (error) {
      console.log('   ❌ Token refresh failed:', error.response?.data?.message);
    }

    console.log();

    // Test 7: Rate limiting (try multiple rapid requests)
    console.log('7. Testing rate limiting...');
    
    const rapidRequests = [];
    for (let i = 0; i < 7; i++) { // Exceed the 5 request limit
      rapidRequests.push(
        axios.post(`${BASE_URL}/login`, {
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        }).catch(error => error.response)
      );
    }

    try {
      const responses = await Promise.all(rapidRequests);
      const rateLimitedResponse = responses.find(r => r?.status === 429);
      
      if (rateLimitedResponse) {
        console.log('   ✅ Rate limiting working:', rateLimitedResponse.data.message);
      } else {
        console.log('   ⚠️  Rate limiting not triggered (might be configured differently)');
      }
    } catch (error) {
      console.log('   ❌ Rate limiting test failed:', error.message);
    }

    console.log('\n🎉 Advanced authentication tests completed!');

  } catch (error) {
    console.error('❌ Advanced test failed:', error.message);
  }
};

// Run advanced tests
testAdvancedAuth();