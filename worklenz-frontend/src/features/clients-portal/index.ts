import { combineReducers } from '@reduxjs/toolkit';
import clientsReducer from './clients/clients-slice';
import requestsReducer from './requests/requests-slice';
import servicesReducer from './services/services-slice';
import chatsReducer from './chats/chats-slice';
import invoicesReducer from './invoices/invoices-slice';

const clientsPortalReducer = combineReducers({
  clientsReducer: clientsReducer,
  requestsReducer: requestsReducer,
  servicesReducer: servicesReducer,
  chatsReducer: chatsReducer,
  invoicesReducer: invoicesReducer,
});

export default clientsPortalReducer;
