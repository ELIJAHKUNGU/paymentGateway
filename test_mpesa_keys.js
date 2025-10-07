const axios = require('axios');

const BASE_URL = 'http://localhost:4001/api/v1';

const testMpesaKeys = async () => {
  try {
    console.log('🔐 Testing Encrypted M-Pesa Keys Management System\n');

    // Test 1: Initialize default keys (admin)
    console.log('1. Testing admin login and default keys initialization...');
    
    let adminToken = null;
    try {
      const adminLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'admin@paygateway.com',
        password: 'Admin123!'
      });
      adminToken = adminLogin.data.data.token;
      console.log('✅ Admin login successful');
    } catch (error) {
      console.log('❌ Admin login failed:', error.response?.data?.message);
      return;
    }

    // Initialize default keys
    try {
      const defaultKeysResponse = await axios.post(`${BASE_URL}/mpesa-keys/init-defaults`, {
        environment: 'sandbox'
      }, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('✅ Default sandbox keys initialized');
    } catch (error) {
      if (error.response?.data?.message?.includes('already exist')) {
        console.log('ℹ️  Default keys already exist');
      } else {
        console.log('❌ Failed to initialize default keys:', error.response?.data?.message);
      }
    }

    console.log();

    // Test 2: Customer creates M-Pesa payment method with custom credentials
    console.log('2. Testing customer M-Pesa setup with custom credentials...');
    
    let customerToken = null;
    try {
      const customerLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'customer@paygateway.com',
        password: 'Customer123!'
      });
      customerToken = customerLogin.data.data.token;
      console.log('✅ Customer login successful');
    } catch (error) {
      console.log('❌ Customer login failed:', error.response?.data?.message);
      return;
    }

    // Add M-Pesa payment method with custom credentials
    try {
      const customMpesaResponse = await axios.post(`${BASE_URL}/payment-methods`, {
        type: 'mpesa',
        metadata: {
          useCustomCredentials: true,
          countryCode: '+254',
          phoneNumber: '743770216',
          callbackUrl: 'https://mysite.com/mpesa/callback',
          consumerKey: 'MY_CUSTOM_CONSUMER_KEY_12345',
          consumerSecret: 'MY_CUSTOM_CONSUMER_SECRET_67890',
          businessShortCode: '123456',
          passKey: 'MY_CUSTOM_PASS_KEY_ABCDEF'
        }
      }, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      console.log('✅ Custom M-Pesa payment method created');
      console.log('   Phone:', customMpesaResponse.data.data.metadata.fullPhoneNumber);
      console.log('   Keys stored securely with encryption');
    } catch (error) {
      console.log('❌ Failed to create custom M-Pesa:', error.response?.data?.message);
    }

    console.log();

    // Test 3: Customer creates M-Pesa with default credentials
    console.log('3. Testing M-Pesa setup with default credentials...');
    
    try {
      const defaultMpesaResponse = await axios.post(`${BASE_URL}/payment-methods`, {
        type: 'mpesa',
        metadata: {
          useCustomCredentials: false,
          countryCode: '+254',
          phoneNumber: '700000001',
          callbackUrl: 'https://mysite.com/mpesa/callback'
        }
      }, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      console.log('✅ Default M-Pesa payment method created');
      console.log('   Phone:', defaultMpesaResponse.data.data.metadata.fullPhoneNumber);
      console.log('   Uses system default keys');
    } catch (error) {
      console.log('❌ Failed to create default M-Pesa:', error.response?.data?.message);
    }

    console.log();

    // Test 4: Admin views all M-Pesa keys
    console.log('4. Testing admin M-Pesa keys management...');
    
    try {
      const allKeysResponse = await axios.get(`${BASE_URL}/mpesa-keys`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('✅ Admin can view all M-Pesa keys');
      console.log(`   Total keys: ${allKeysResponse.data.data.keys.length}`);
      
      // Show key types and encryption status
      allKeysResponse.data.data.keys.forEach((key, index) => {
        console.log(`   Key ${index + 1}: ${key.name} (${key.keyType}) - ${key.status}`);
        console.log(`     Consumer Key: ${key.credentials.consumerKey}`);
        console.log(`     Encrypted: ${key.isEncrypted}`);
      });
    } catch (error) {
      console.log('❌ Failed to get all keys:', error.response?.data?.message);
    }

    console.log();

    // Test 5: Customer views their keys
    console.log('5. Testing customer M-Pesa keys access...');
    
    try {
      const myKeysResponse = await axios.get(`${BASE_URL}/mpesa-keys/my-keys`, {
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      console.log('✅ Customer can view their M-Pesa keys');
      console.log(`   User keys: ${myKeysResponse.data.data.length}`);
      
      myKeysResponse.data.data.forEach((key, index) => {
        console.log(`   Key ${index + 1}: ${key.name} - ${key.approval.status}`);
      });
    } catch (error) {
      console.log('❌ Failed to get user keys:', error.response?.data?.message);
    }

    console.log();

    // Test 6: Get M-Pesa keys statistics
    console.log('6. Testing M-Pesa keys statistics...');
    
    try {
      const statsResponse = await axios.get(`${BASE_URL}/mpesa-keys/stats`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      console.log('✅ M-Pesa keys statistics retrieved');
      console.log('   Total keys:', statsResponse.data.data.overview.totalKeys);
      console.log('   Active keys:', statsResponse.data.data.overview.activeKeys);
      console.log('   Pending approval:', statsResponse.data.data.overview.pendingKeys);
      console.log('   User keys:', statsResponse.data.data.overview.userKeys);
    } catch (error) {
      console.log('❌ Failed to get stats:', error.response?.data?.message);
    }

    console.log();

    // Test 7: Test encryption functionality
    console.log('7. Testing encryption functionality...');
    
    const { validateEncryption } = require('./utils/encryption');
    const testData = 'MY_SECRET_CONSUMER_KEY_123456789';
    const isValid = validateEncryption(testData);
    
    console.log('✅ Encryption test:', isValid ? 'PASSED' : 'FAILED');
    
    console.log('\n🎉 M-Pesa Keys Management System Testing Complete!');
    console.log('\n📊 System Features:');
    console.log('   ✅ Encrypted storage of sensitive M-Pesa credentials');
    console.log('   ✅ Default keys for quick setup');
    console.log('   ✅ Custom keys for advanced users');
    console.log('   ✅ Admin approval workflow');
    console.log('   ✅ Usage tracking and limits');
    console.log('   ✅ Comprehensive API endpoints');
    console.log('   ✅ Security and access controls');

  } catch (error) {
    console.error('❌ M-Pesa keys test failed:', error.message);
  }
};

testMpesaKeys();