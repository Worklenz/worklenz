import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { TempChatsType } from '../../../pages/client-portal/chats/chat-container/chat-box/chat-box-wrapper';
import { ClientPortalChat } from '../../../api/client-portal/client-portal-api';

const chatList: TempChatsType[] = [
  {
    id: '1',
    name: 'alexander turner',
    chats_data: [
      {
        id: '1',
        content: 'Hello can you tell me about this service. I want to know more about it',
        time: new Date(),
        is_me: false,
      },
      {
        id: '2',
        content: 'Sure, this is a service that does this and that',
        time: new Date(),
        is_me: true,
      },
      {
        id: '3',
        content: 'Hello can you tell me about this service. I want to know more about it',
        time: new Date(),
        is_me: false,
      },
      {
        id: '4',
        content: 'Sure, this is a service that does this and that',
        time: new Date(),
        is_me: true,
      },
      {
        id: '5',
        content: 'Hello can you tell me about this service. I want to know more about it',
        time: new Date(),
        is_me: false,
      },
      {
        id: '6',
        content: 'Sure, this is a service that does this and that',
        time: new Date(),
        is_me: true,
      },
      {
        id: '7',
        content: 'Hello can you tell me about this service. I want to know more about it',
        time: new Date(),
        is_me: false,
      },
      {
        id: '8',
        content: 'Sure, this is a service that does this and that',
        time: new Date(),
        is_me: true,
      },
    ],
    status: 'read',
    lastMessage: 'Sure, this is a service that does this and that',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    participants: ['alexander turner'],
  },
  {
    id: '2',
    name: 'emma cooper',
    chats_data: [
      {
        id: '1',
        content: 'Can you explain about this service ?',
        time: new Date(),
        is_me: false,
      },
    ],
    status: 'unread',
    lastMessage: 'Can you explain about this service ?',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 1,
    participants: ['emma cooper'],
  },
];

type ChatsState = {
  chatList: TempChatsType[];
  selectedChatId: string | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: ChatsState = {
  chatList,
  selectedChatId: null,
  isLoading: false,
  error: null,
};

const chatsSlice = createSlice({
  name: 'chatsReducer',
  initialState,
  reducers: {
    // Local state management
    sendMessage: (state, action: PayloadAction<{ chatId: string; message: string }>) => {
      const chat = state.chatList.find(chat => chat.id === action.payload.chatId);

      if (chat) {
        const newMessage = {
          id: nanoid(),
          content: action.payload.message,
          time: new Date(),
          is_me: true,
        };

        chat.chats_data.push(newMessage);
        chat.lastMessage = action.payload.message;
        chat.lastMessageTime = new Date().toISOString();
      }
    },

    // API data management
    setChats: (state, action: PayloadAction<ClientPortalChat[]>) => {
      state.chatList = action.payload.map(chat => ({
        id: chat.id,
        name: chat.title || chat.participants.join(', '),
        chats_data: [], // Will be loaded when chat is opened
        status: chat.unreadCount > 0 ? ('unread' as const) : ('read' as const),
        lastMessage: chat.lastMessage,
        lastMessageTime: chat.lastMessageTime,
        unreadCount: chat.unreadCount,
        participants: chat.participants,
      }));
    },

    setSelectedChat: (state, action: PayloadAction<string | null>) => {
      state.selectedChatId = action.payload;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Update chat messages for a specific chat
    setChatMessages: (state, action: PayloadAction<{ chatId: string; messages: any[] }>) => {
      const chat = state.chatList.find(c => c.id === action.payload.chatId);
      if (chat) {
        chat.chats_data = action.payload.messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          time: new Date(msg.created_at),
          is_me: msg.sender_id === 'current_user', // This should be replaced with actual user ID comparison
        }));
      }
    },

    // Mark chat as read
    markChatAsRead: (state, action: PayloadAction<string>) => {
      const chat = state.chatList.find(c => c.id === action.payload);
      if (chat) {
        chat.status = 'read';
        chat.unreadCount = 0;
      }
    },

    // Add new message to specific chat
    addMessage: (state, action: PayloadAction<{ chatId: string; message: any }>) => {
      const chat = state.chatList.find(c => c.id === action.payload.chatId);
      if (chat) {
        const newMessage = {
          id: action.payload.message.id,
          content: action.payload.message.content,
          time: new Date(action.payload.message.created_at),
          is_me: action.payload.message.sender_id === 'current_user',
        };

        chat.chats_data.push(newMessage);
        chat.lastMessage = action.payload.message.content;
        chat.lastMessageTime = action.payload.message.created_at;

        // If message is not from current user, increment unread count
        if (!newMessage.is_me) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
          chat.status = 'unread';
        }
      }
    },
  },
});

export const {
  sendMessage,
  setChats,
  setSelectedChat,
  setLoading,
  setError,
  setChatMessages,
  markChatAsRead,
  addMessage,
} = chatsSlice.actions;

export default chatsSlice.reducer;
