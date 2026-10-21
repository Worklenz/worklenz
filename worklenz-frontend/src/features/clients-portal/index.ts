import { combineReducers } from '@reduxjs/toolkit';
import clientsReducer from './clients/clients-slice';
import chatsReducer from './chats/chats-slice';

const clientsPortalReducer = combineReducers({
  clientsReducer: clientsReducer,
  chatsReducer: chatsReducer,
});

export default clientsPortalReducer;
