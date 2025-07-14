import { combineReducers } from '@reduxjs/toolkit';
import serviceReducer from './services/client-view-services';
import projectsReducer from './projects/client-view-projects';

const clientsViewReducer = combineReducers({
  serviceReducer: serviceReducer,
  projectsReducer: projectsReducer,
});

export default clientsViewReducer;
