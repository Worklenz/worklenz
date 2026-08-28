import { combineReducers } from '@reduxjs/toolkit';
import serviceReducer from './services/client-view-services';
import projectsReducer from './projects/client-view-projects';
import dashboardReducer from './dashboard/client-view-dashboard';
import requestsReducer from './requests/client-view-requests';
import invoicesReducer from './invoices/client-view-invoices';
import settingsReducer from './settings/client-view-settings';

const clientViewReducer = combineReducers({
  serviceReducer: serviceReducer,
  projectsReducer: projectsReducer,
  dashboardReducer: dashboardReducer,
  requestsReducer: requestsReducer,
  invoicesReducer: invoicesReducer,
  settingsReducer: settingsReducer,
});

export default clientViewReducer;
