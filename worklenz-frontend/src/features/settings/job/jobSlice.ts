import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { JobType } from '../../../types/job.types';

type JobState = {
  jobsList: JobType[];
  isCreateJobTitleDrawerOpen: boolean;
  isUpdateJobTitleDrawerOpen: boolean;
};

const initialState: JobState = {
  jobsList: [],
  isCreateJobTitleDrawerOpen: false,
  isUpdateJobTitleDrawerOpen: false,
};

const jobSlice = createSlice({
  name: 'jobReducer',
  initialState,
  reducers: {
    toggleCreateJobTitleDrawer: state => {
      state.isCreateJobTitleDrawerOpen
        ? (state.isCreateJobTitleDrawerOpen = false)
        : (state.isCreateJobTitleDrawerOpen = true);
    },
    toggleUpdateJobTitleDrawer: state => {
      state.isUpdateJobTitleDrawerOpen
        ? (state.isUpdateJobTitleDrawerOpen = false)
        : (state.isUpdateJobTitleDrawerOpen = true);
    },
    // action for create job
    addJobTitle: (state, action: PayloadAction<JobType>) => {
      state.jobsList.push(action.payload);
    },
    // action for update job title
    updateJobTitle: (state, action: PayloadAction<JobType>) => {
      const index = state.jobsList.findIndex(job => job.jobId === action.payload.jobId);
      if (index >= 0) {
        state.jobsList[index] = action.payload;
      }
    },
    // action for delete job title
    deleteJobTitle: (state, action: PayloadAction<string>) => {
      state.jobsList = state.jobsList.filter(job => job.jobId !== action.payload);
    },
  },
});

export const {
  toggleCreateJobTitleDrawer,
  toggleUpdateJobTitleDrawer,
  addJobTitle,
  updateJobTitle,
  deleteJobTitle,
} = jobSlice.actions;
export default jobSlice.reducer;
