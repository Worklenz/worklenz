// Test script for Client Portal Requests System
// This script tests the complete requests functionality

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// Test configuration
const testConfig = {
  // Replace with actual client token from the login endpoint
  clientToken: 'your-client-token-here'
};

async function testRequestsSystem() {
  console.log('🧪 Testing Client Portal Requests System...\n');

  try {
    // Step 1: Get dashboard data
    console.log('📊 Step 1: Getting dashboard data...');
    const dashboardResponse = await axios.get(
      `${API_BASE_URL}/client-portal/dashboard`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ Dashboard data retrieved successfully');
    console.log('Dashboard stats:', dashboardResponse.data.body);

    // Step 2: Get available services
    console.log('\n🛠️  Step 2: Getting available services...');
    const servicesResponse = await axios.get(
      `${API_BASE_URL}/client-portal/services`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ Services retrieved successfully');
    console.log('Available services:', servicesResponse.data.body.length);

    if (servicesResponse.data.body.length === 0) {
      console.log('⚠️  No services available for testing. Please create some services first.');
      return;
    }

    const firstService = servicesResponse.data.body[0];
    console.log('Using service:', firstService.name);

    // Step 3: Create a new request
    console.log('\n📝 Step 3: Creating a new request...');
    const requestData = {
      serviceId: firstService.id,
      requestData: {
        title: 'Test Request',
        description: 'This is a test request created by the automated test',
        priority: 'medium',
        category: 'bug'
      },
      notes: 'Automated test request - please ignore'
    };

    const createResponse = await axios.post(
      `${API_BASE_URL}/client-portal/requests`,
      requestData,
      {
        headers: {
          'x-client-token': testConfig.clientToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Request created successfully');
    console.log('Request number:', createResponse.data.body.requestNumber);

    const requestId = createResponse.data.body.id;

    // Step 4: Get all requests
    console.log('\n📋 Step 4: Getting all requests...');
    const allRequestsResponse = await axios.get(
      `${API_BASE_URL}/client-portal/requests`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ All requests retrieved successfully');
    console.log('Total requests:', allRequestsResponse.data.body.total);

    // Step 5: Get specific request details
    console.log('\n🔍 Step 5: Getting request details...');
    const requestDetailsResponse = await axios.get(
      `${API_BASE_URL}/client-portal/requests/${requestId}`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ Request details retrieved successfully');
    console.log('Request status:', requestDetailsResponse.data.body.status);

    // Step 6: Update the request
    console.log('\n✏️  Step 6: Updating request...');
    const updateData = {
      requestData: {
        title: 'Updated Test Request',
        description: 'This request has been updated by the automated test',
        priority: 'high',
        category: 'bug'
      },
      notes: 'Updated by automated test'
    };

    const updateResponse = await axios.put(
      `${API_BASE_URL}/client-portal/requests/${requestId}`,
      updateData,
      {
        headers: {
          'x-client-token': testConfig.clientToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Request updated successfully');
    console.log('Updated at:', updateResponse.data.body.updatedAt);

    // Step 7: Get request status options
    console.log('\n🏷️  Step 7: Getting request status options...');
    const statusOptionsResponse = await axios.get(
      `${API_BASE_URL}/client-portal/requests/status-options`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ Status options retrieved successfully');
    console.log('Available statuses:', statusOptionsResponse.data.body.map(s => s.value));

    // Step 8: Test filtering
    console.log('\n🔍 Step 8: Testing request filtering...');
    const filteredResponse = await axios.get(
      `${API_BASE_URL}/client-portal/requests?status=pending&search=test`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ Filtered requests retrieved successfully');
    console.log('Filtered results:', filteredResponse.data.body.requests.length);

    // Step 9: Delete the test request
    console.log('\n🗑️  Step 9: Deleting test request...');
    const deleteResponse = await axios.delete(
      `${API_BASE_URL}/client-portal/requests/${requestId}`,
      {
        headers: {
          'x-client-token': testConfig.clientToken
        }
      }
    );

    console.log('✅ Request deleted successfully');

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ Dashboard data retrieval');
    console.log('- ✅ Services listing');
    console.log('- ✅ Request creation');
    console.log('- ✅ Request listing');
    console.log('- ✅ Request details');
    console.log('- ✅ Request updating');
    console.log('- ✅ Status options');
    console.log('- ✅ Request filtering');
    console.log('- ✅ Request deletion');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your client token.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check the API endpoints.');
    } else if (error.response?.status === 500) {
      console.error('💥 Server error. Please check the server logs.');
    }
    
    console.error('Full error:', error);
  }
}

// Test individual endpoints
async function testIndividualEndpoints() {
  console.log('🧪 Testing Individual Endpoints...\n');

  const endpoints = [
    { method: 'GET', path: '/client-portal/dashboard', description: 'Dashboard data' },
    { method: 'GET', path: '/client-portal/services', description: 'Services list' },
    { method: 'GET', path: '/client-portal/requests', description: 'Requests list' },
    { method: 'GET', path: '/client-portal/requests/status-options', description: 'Status options' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint.method} ${endpoint.path}...`);
      const response = await axios({
        method: endpoint.method,
        url: `${API_BASE_URL}${endpoint.path}`,
        headers: {
          'x-client-token': testConfig.clientToken
        }
      });

      console.log(`✅ ${endpoint.description}: ${response.status} - ${response.data.message}`);
    } catch (error) {
      console.error(`❌ ${endpoint.description}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
}

// Run the tests
if (require.main === module) {
  console.log('🚀 Starting Client Portal Requests System Tests\n');
  
  if (!testConfig.clientToken || testConfig.clientToken === 'your-client-token-here') {
    console.error('❌ Please configure a valid client token in testConfig object');
    console.error('You can get a client token by:');
    console.error('1. Creating a client user account');
    console.error('2. Logging in via POST /api/client-portal/auth/login');
    console.error('3. Using the returned accessToken as clientToken');
    process.exit(1);
  }

  testRequestsSystem()
    .then(() => {
      console.log('\n✅ Main tests completed');
      return testIndividualEndpoints();
    })
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
  testRequestsSystem,
  testIndividualEndpoints
};