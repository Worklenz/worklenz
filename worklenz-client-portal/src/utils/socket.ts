import { io, Socket } from 'socket.io-client';
import { store } from '@/store';
import { message } from '@/shared/antd-imports';

interface ClientMessage {
  id: string;
  senderType: 'client' | 'team_member';
  senderId: string;
  senderName: string;
  message: string;
  messageType: 'text' | 'file' | 'image';
  fileUrl?: string;
  createdAt: string;
}

class SocketManager {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    this.connect();
  }

  private connect() {
    const token = localStorage.getItem('clientToken');
    if (!token) {
      console.warn('No client token found, skipping socket connection');
      return;
    }

    this.socket = io(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000', {
      auth: {
        token,
        type: 'client'
      },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to server via Socket.IO');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Send client portal authentication
      const token = localStorage.getItem('clientToken');
      if (token) {
        this.socket.emit('client_portal:connect', {
          token,
          type: 'client'
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      this.isConnected = false;
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.handleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.handleReconnect();
    });

    // Client portal authentication response
    this.socket.on('client_portal:connected', (data) => {
      console.log('Client portal authenticated:', data);
      if (data.success) {
        message.success(`Connected as ${data.clientName}`, 3);
      }
    });

    this.socket.on('error', (data) => {
      console.error('Socket error:', data);
      message.error(data.message || 'Connection error', 3);
    });

    // Client Portal specific events
    this.socket.on('client_portal:new_message', (data: ClientMessage) => {
      console.log('New message received:', data);
      // You can dispatch actions to update the store or show notifications
      message.info(`New message from ${data.senderName}`);
    });

    this.socket.on('client_portal:request_status_updated', (data: { 
      requestId: string; 
      status: string; 
      requestNumber: string;
      notes?: string;
    }) => {
      console.log('Request status updated:', data);
      message.success(`Request ${data.requestNumber} status updated to: ${data.status}`);
      
      // Invalidate requests data in RTK Query
      store.dispatch({
        type: 'clientPortalApi/invalidateTags',
        payload: ['Requests', 'Dashboard']
      });
    });

    this.socket.on('client_portal:project_updated', (data: {
      projectId: string;
      projectName: string;
      updateType: string;
      details: any;
    }) => {
      console.log('Project updated:', data);
      message.info(`Project "${data.projectName}" has been updated`);
      
      // Invalidate projects data
      store.dispatch({
        type: 'clientPortalApi/invalidateTags',
        payload: ['Projects', 'Dashboard']
      });
    });

    this.socket.on('client_portal:invoice_created', (data: {
      invoiceId: string;
      invoiceNumber: string;
      amount: number;
      currency: string;
      dueDate: string;
    }) => {
      console.log('New invoice created:', data);
      message.warning(`New invoice ${data.invoiceNumber} created: ${data.currency} ${data.amount}`);
      
      // Invalidate invoices data
      store.dispatch({
        type: 'clientPortalApi/invalidateTags',
        payload: ['Invoices', 'Dashboard']
      });
    });

    this.socket.on('client_portal:notification', (data: {
      id: string;
      type: string;
      title: string;
      message: string;
      referenceId?: string;
      referenceNumber?: string;
    }) => {
      console.log('New notification:', data);
      
      // Show notification based on type
      switch (data.type) {
        case 'request_update':
          message.info(data.title, 5);
          break;
        case 'invoice_created':
          message.warning(data.title, 5);
          break;
        case 'project_update':
          message.success(data.title, 5);
          break;
        case 'message':
          message.info(data.title, 3);
          break;
        default:
          message.info(data.title, 3);
      }
      
      // Invalidate notifications
      store.dispatch({
        type: 'clientPortalApi/invalidateTags',
        payload: ['Notifications']
      });
    });

    // Chat events
    this.socket.on('chat:message_received', (data: ClientMessage) => {
      console.log('Chat message received:', data);
      // Update chat state or show notification
      if (data.senderType === 'team_member') {
        message.info(`New message from ${data.senderName}`, 3);
      }
    });

    this.socket.on('chat:typing', (data: { senderId: string; senderName: string; isTyping: boolean }) => {
      console.log('Typing indicator:', data);
      // You could show typing indicators in the chat UI
    });

    this.socket.on('chat:message_read', (data: { messageId: string; readBy: string }) => {
      console.log('Message read:', data);
      // Update message read status in the UI
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
      
      setTimeout(() => {
        if (this.socket) {
          this.socket.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      message.error('Connection lost. Please refresh the page.');
    }
  }

  // Public methods
  public sendMessage(chatId: string, messageData: {
    message: string;
    messageType?: string;
    fileUrl?: string;
  }) {
    if (!this.isConnected || !this.socket) {
      console.warn('Socket not connected, cannot send message');
      return;
    }

    this.socket.emit('chat:send_message', {
      chatId,
      ...messageData
    });
  }

  public joinChat(chatId: string) {
    if (!this.isConnected || !this.socket) return;
    
    this.socket.emit('chat:join', { chatId });
  }

  public leaveChat(chatId: string) {
    if (!this.isConnected || !this.socket) return;
    
    this.socket.emit('chat:leave', { chatId });
  }

  public sendTypingIndicator(chatId: string, isTyping: boolean) {
    if (!this.isConnected || !this.socket) return;
    
    this.socket.emit('chat:typing', { chatId, isTyping });
  }

  public markMessageAsRead(messageId: string) {
    if (!this.isConnected || !this.socket) return;
    
    this.socket.emit('chat:mark_read', { messageId });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  public reconnect() {
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Get socket instance for custom events
  public getSocket(): Socket | null {
    return this.socket;
  }
}

// Create singleton instance
export const socketManager = new SocketManager();
export default socketManager;