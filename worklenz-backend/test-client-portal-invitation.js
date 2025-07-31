// Test script for client portal invitation system
// This script tests the complete invitation flow

const axios = require('axios');
const { faker } = require('@faker-js/faker');

const API_BASE_URL = 'http://localhost:3000/api';

// Test configuration
const testConfig = {
  // You'll need to replace these with actual values from your database
  clientId: 'your-client-id-here',
  userId: 'your-user-id-here',
  userToken: 'your-user-jwt-token-here'
};

async function testInvitationFlow() {
  console.log('🧪 Testing Client Portal Invitation Flow...\n');

  try {
    // Step 1: Invite a team member
    console.log('📧 Step 1: Inviting team member...');
    const inviteData = {
      email: faker.internet.email(),
      name: faker.person.fullName(),
      role: 'member'
    };

    const inviteResponse = await axios.post(
      `${API_BASE_URL}/client-portal/clients/${testConfig.clientId}/team`,
      inviteData,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Invitation sent successfully');
    console.log('Response:', inviteResponse.data);

    const invitationToken = inviteResponse.data.body.invitationId;
    console.log('🔐 Invitation token:', invitationToken);

    // Step 2: Validate the invitation
    console.log('\n🔍 Step 2: Validating invitation...');
    const validateResponse = await axios.get(
      `${API_BASE_URL}/client-portal/invitation/validate?token=${invitationToken}`
    );

    console.log('✅ Invitation validated successfully');
    console.log('Response:', validateResponse.data);

    // Step 3: Accept the invitation
    console.log('\n✅ Step 3: Accepting invitation...');
    const acceptData = {
      token: invitationToken,
      password: 'TestPassword123!',
      name: inviteData.name
    };

    const acceptResponse = await axios.post(
      `${API_BASE_URL}/client-portal/invitation/accept`,
      acceptData
    );

    console.log('✅ Invitation accepted successfully');
    console.log('Response:', acceptResponse.data);

    const newUserEmail = acceptResponse.data.body.email;

    // Step 4: Login with the new user
    console.log('\n🔐 Step 4: Testing login with new user...');
    const loginData = {
      email: newUserEmail,
      password: 'TestPassword123!'
    };

    const loginResponse = await axios.post(
      `${API_BASE_URL}/client-portal/auth/login`,
      loginData
    );

    console.log('✅ Login successful');
    console.log('Response:', loginResponse.data);

    const clientToken = loginResponse.data.body.accessToken;

    // Step 5: Test accessing protected resource
    console.log('\n🛡️  Step 5: Testing protected resource access...');
    const profileResponse = await axios.get(
      `${API_BASE_URL}/client-portal/profile`,
      {
        headers: {
          'x-client-token': clientToken
        }
      }
    );

    console.log('✅ Protected resource accessed successfully');
    console.log('Response:', profileResponse.data);

    // Step 6: Test logout
    console.log('\n👋 Step 6: Testing logout...');
    const logoutResponse = await axios.post(
      `${API_BASE_URL}/client-portal/auth/logout`,
      {},
      {
        headers: {
          'x-client-token': clientToken
        }
      }
    );

    console.log('✅ Logout successful');
    console.log('Response:', logoutResponse.data);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ Team member invitation');
    console.log('- ✅ Invitation validation');
    console.log('- ✅ Invitation acceptance');
    console.log('- ✅ Client login');
    console.log('- ✅ Protected resource access');
    console.log('- ✅ Client logout');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.error('Full error:', error);
  }
}

// Test individual components
async function testEmailService() {
  console.log('📧 Testing Email Service...');
  
  try {
    // This would need to be called from within the application
    // as EmailService is not directly accessible
    console.log('Email service test requires running from within the application');
    console.log('Check the server logs for email sending confirmations');
  } catch (error) {
    console.error('❌ Email service test failed:', error);
  }
}

async function testTokenService() {
  console.log('🔐 Testing Token Service...');
  
  try {
    // This would need to be called from within the application
    // as TokenService is not directly accessible
    console.log('Token service test requires running from within the application');
    console.log('Tokens are generated and validated during the invitation flow');
  } catch (error) {
    console.error('❌ Token service test failed:', error);
  }
}

// Run the tests
if (require.main === module) {
  console.log('🚀 Starting Client Portal Invitation System Tests\n');
  
  if (!testConfig.clientId || !testConfig.userId || !testConfig.userToken) {
    console.error('❌ Please configure the test values in testConfig object');
    console.error('You need to set:');
    console.error('- clientId: A valid client ID from your database');
    console.error('- userId: A valid user ID from your database');
    console.error('- userToken: A valid JWT token for the user');
    process.exit(1);
  }

  testInvitationFlow()
    .then(() => {
      console.log('\n✅ All tests completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testInvitationFlow,
  testEmailService,
  testTokenService
};