const { io } = require('socket.io-client');

// Test client portal Socket.IO connection
async function testClientPortalSocket() {
  console.log('Testing Client Portal Socket.IO connection...');
  
  // Create socket connection with client authentication
  const socket = io('http://localhost:3000', {
    auth: {
      token: 'your-client-token-here', // Replace with actual client token
      type: 'client'
    },
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('✅ Connected to server with ID:', socket.id);
    
    // Test client authentication
    socket.emit('client_portal:connect', {
      token: 'your-client-token-here', // Replace with actual client token  
      type: 'client'
    });
  });

  socket.on('client_portal:connected', (data) => {
    console.log('✅ Client portal authenticated:', data);
    
    // Test joining a chat room
    socket.emit('CHAT_JOIN', {
      chatId: 'test-chat-123'
    });
  });

  socket.on('chat:joined', (data) => {
    console.log('✅ Joined chat:', data);
    
    // Test sending a message
    socket.emit('CHAT_SEND_MESSAGE', {
      chatId: 'test-chat-123',
      message: 'Hello from Socket.IO test!',
      messageType: 'text',
      tempId: Date.now()
    });
  });

  socket.on('chat:message_sent', (data) => {
    console.log('✅ Message sent confirmation:', data);
  });

  socket.on('chat:message_received', (data) => {
    console.log('✅ Message received:', data);
  });

  socket.on('client_portal:new_message', (data) => {
    console.log('✅ Client portal new message event:', data);
  });

  socket.on('client_portal:request_status_updated', (data) => {
    console.log('✅ Request status updated:', data);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Disconnected:', reason);
  });

  // Keep the test running for a few seconds
  setTimeout(() => {
    console.log('Closing test connection...');
    socket.disconnect();
    process.exit(0);
  }, 10000);
}

testClientPortalSocket().catch(console.error);