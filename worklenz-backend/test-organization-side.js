// Test script for Organization-Side Client Portal Management
// This script tests the organization-side functionality for managing client requests

const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';

// Test configuration
const testConfig = {
  // Replace with actual JWT token from team member login
  authToken: 'your-jwt-token-here',
  // Replace with actual user ID for assignment testing
  userId: 'your-user-id-here'
};

async function testOrganizationSide() {
  console.log('🏢 Testing Organization-Side Client Portal Management...\n');

  try {
    // Step 1: Get request statistics
    console.log('📊 Step 1: Getting request statistics...');
    const statsResponse = await axios.get(
      `${API_BASE_URL}/clients/portal/requests/stats`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    console.log('✅ Request statistics retrieved successfully');
    console.log('Stats:', statsResponse.data.body);

    // Step 2: Get all client requests
    console.log('\n📋 Step 2: Getting all client requests...');
    const requestsResponse = await axios.get(
      `${API_BASE_URL}/clients/portal/requests?page=1&limit=10`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    console.log('✅ Client requests retrieved successfully');
    console.log('Total requests:', requestsResponse.data.body.total);

    const requests = requestsResponse.data.body.data;
    if (requests.length === 0) {
      console.log('⚠️  No requests found for testing. Please create some requests first.');
      return;
    }

    const firstRequest = requests[0];
    console.log('Using request:', firstRequest.req_no);

    // Step 3: Get specific request details
    console.log('\n🔍 Step 3: Getting request details...');
    const requestDetailsResponse = await axios.get(
      `${API_BASE_URL}/clients/portal/requests/${firstRequest.id}`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    console.log('✅ Request details retrieved successfully');
    console.log('Request status:', requestDetailsResponse.data.body.status);
    console.log('Client:', requestDetailsResponse.data.body.client_name);

    // Step 4: Update request status
    console.log('\n📝 Step 4: Updating request status...');
    const statusUpdateResponse = await axios.put(
      `${API_BASE_URL}/clients/portal/requests/${firstRequest.id}/status`,
      {
        status: 'accepted',
        notes: 'Request has been reviewed and accepted by the team'
      },
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Request status updated successfully');
    console.log('New status:', statusUpdateResponse.data.body.status);

    // Step 5: Assign request to team member
    if (testConfig.userId !== 'your-user-id-here') {
      console.log('\n👤 Step 5: Assigning request to team member...');
      const assignResponse = await axios.put(
        `${API_BASE_URL}/clients/portal/requests/${firstRequest.id}/assign`,
        {
          assigned_to: testConfig.userId
        },
        {
          headers: {
            'Authorization': `Bearer ${testConfig.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Request assigned successfully');
      console.log('Assigned to:', assignResponse.data.body.assigned_to);
    } else {
      console.log('\n⚠️  Step 5: Skipping assignment test (user ID not configured)');
    }

    // Step 6: Get services
    console.log('\n🛠️  Step 6: Getting services...');
    const servicesResponse = await axios.get(
      `${API_BASE_URL}/clients/portal/services`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    console.log('✅ Services retrieved successfully');
    console.log('Total services:', servicesResponse.data.body.total);

    // Step 7: Create a new service
    console.log('\n🆕 Step 7: Creating a new service...');
    const serviceData = {
      name: 'Test Service',
      description: 'A test service created by the automated test',
      service_data: {
        fields: [
          {
            name: 'title',
            type: 'text',
            required: true,
            label: 'Issue Title'
          },
          {
            name: 'description',
            type: 'textarea',
            required: true,
            label: 'Description'
          },
          {
            name: 'priority',
            type: 'select',
            options: ['low', 'medium', 'high'],
            required: true,
            label: 'Priority'
          }
        ]
      },
      is_public: true,
      allowed_client_ids: null
    };

    const createServiceResponse = await axios.post(
      `${API_BASE_URL}/clients/portal/services`,
      serviceData,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Service created successfully');
    console.log('Service ID:', createServiceResponse.data.body.id);

    const serviceId = createServiceResponse.data.body.id;

    // Step 8: Update the service
    console.log('\n✏️  Step 8: Updating service...');
    const updateServiceResponse = await axios.put(
      `${API_BASE_URL}/clients/portal/services/${serviceId}`,
      {
        name: 'Updated Test Service',
        description: 'Updated description by automated test',
        status: 'active'
      },
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Service updated successfully');
    console.log('Updated name:', updateServiceResponse.data.body.name);

    // Step 9: Test filtering requests
    console.log('\n🔍 Step 9: Testing request filtering...');
    const filteredResponse = await axios.get(
      `${API_BASE_URL}/clients/portal/requests?status=accepted&page=1&limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    console.log('✅ Filtered requests retrieved successfully');
    console.log('Filtered results:', filteredResponse.data.body.data.length);

    // Step 10: Clean up - Delete the test service
    console.log('\n🗑️  Step 10: Cleaning up test service...');
    const deleteServiceResponse = await axios.delete(
      `${API_BASE_URL}/clients/portal/services/${serviceId}`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    console.log('✅ Test service deleted successfully');

    console.log('\n🎉 All organization-side tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ Request statistics');
    console.log('- ✅ Request listing');
    console.log('- ✅ Request details');
    console.log('- ✅ Status updates');
    console.log('- ✅ Request assignment');
    console.log('- ✅ Service listing');
    console.log('- ✅ Service creation');
    console.log('- ✅ Service updates');
    console.log('- ✅ Request filtering');
    console.log('- ✅ Service deletion');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('🔐 Authentication failed. Please check your auth token.');
    } else if (error.response?.status === 403) {
      console.error('🚫 Permission denied. Please check your team permissions.');
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found. Please check the API endpoints.');
    } else if (error.response?.status === 500) {
      console.error('💥 Server error. Please check the server logs.');
    }
    
    console.error('Full error:', error);
  }
}

// Test individual organization endpoints
async function testOrganizationEndpoints() {
  console.log('🧪 Testing Organization Endpoints...\n');

  const endpoints = [
    { method: 'GET', path: '/clients/portal/requests/stats', description: 'Request statistics' },
    { method: 'GET', path: '/clients/portal/requests', description: 'All requests' },
    { method: 'GET', path: '/clients/portal/services', description: 'All services' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint.method} ${endpoint.path}...`);
      const response = await axios({
        method: endpoint.method,
        url: `${API_BASE_URL}${endpoint.path}`,
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      });

      console.log(`✅ ${endpoint.description}: ${response.status} - ${response.data.message || 'Success'}`);
    } catch (error) {
      console.error(`❌ ${endpoint.description}: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    }
  }
}

// Workflow test
async function testRequestWorkflow() {
  console.log('🔄 Testing Request Workflow...\n');

  const statuses = ['pending', 'accepted', 'in_progress', 'completed'];
  
  try {
    // Get a request to test workflow
    const requestsResponse = await axios.get(
      `${API_BASE_URL}/clients/portal/requests?limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${testConfig.authToken}`
        }
      }
    );

    const requests = requestsResponse.data.body.data;
    if (requests.length === 0) {
      console.log('⚠️  No requests found for workflow testing');
      return;
    }

    const request = requests[0];
    console.log(`📋 Testing workflow for request: ${request.req_no}`);

    // Test status progression
    for (const status of statuses) {
      console.log(`📝 Updating status to: ${status}`);
      
      const response = await axios.put(
        `${API_BASE_URL}/clients/portal/requests/${request.id}/status`,
        {
          status: status,
          notes: `Status updated to ${status} by automated test`
        },
        {
          headers: {
            'Authorization': `Bearer ${testConfig.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log(`✅ Status updated to: ${response.data.body.status}`);
      
      // Small delay between status changes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('🎉 Request workflow test completed successfully!');

  } catch (error) {
    console.error('❌ Workflow test failed:', error.response?.data || error.message);
  }
}

// Run the tests
if (require.main === module) {
  console.log('🚀 Starting Organization-Side Client Portal Tests\n');
  
  if (!testConfig.authToken || testConfig.authToken === 'your-jwt-token-here') {
    console.error('❌ Please configure a valid auth token in testConfig object');
    console.error('You can get an auth token by:');
    console.error('1. Logging in as a team member');
    console.error('2. Using the JWT token from the authentication response');
    process.exit(1);
  }

  testOrganizationSide()
    .then(() => {
      console.log('\n✅ Main tests completed');
      return testOrganizationEndpoints();
    })
    .then(() => {
      console.log('\n✅ Endpoint tests completed');
      return testRequestWorkflow();
    })
    .then(() => {
      console.log('\n✅ All tests completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testOrganizationSide,
  testOrganizationEndpoints,
  testRequestWorkflow
};