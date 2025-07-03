import { createSlice, nanoid, PayloadAction } from '@reduxjs/toolkit';
import { TempChatsType } from '../../../pages/client-portal/chats/chat-container/chat-box/chat-box-wrapper';
import { send } from 'process';

const chatList: TempChatsType[] = [
  {
    id: '1',
    name: 'alexander turner',
    chats_data: [
      {
        id: '1',
        content:
          'Hello can you tell me about this service. I want to know more about it',
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
        content:
          'Hello can you tell me about this service. I want to know more about it',
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
        content:
          'Hello can you tell me about this service. I want to know more about it',
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
        content:
          'Hello can you tell me about this service. I want to know more about it',
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
  },
];

type ChatsState = {
  chatList: TempChatsType[];
};

const initialState: ChatsState = {
  chatList,
};

const chatsSlice = createSlice({
  name: 'chatsReducer',
  initialState,
  reducers: {
    sendMessage: (
      state,
      action: PayloadAction<{ chatId: string; message: string }>
    ) => {
      const chat = state.chatList.find(
        (chat) => chat.id === action.payload.chatId
      );

      if (chat) {
        chat.chats_data.push({
          id: nanoid(),
          content: action.payload.message,
          time: new Date(),
          is_me: true,
        });
      }
    },
  },
});

export const { sendMessage } = chatsSlice.actions;
export default chatsSlice.reducer;
