import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Task {
  id: number;
  value: string;
}

interface Email {
  id: number;
  value: string;
}

interface AccountSetupState {
  organizationName: string;
  projectName: string;
  templateId: string | null;
  tasks: Task[];
  teamMembers: Email[];
  currentStep: number;
}

const initialState: AccountSetupState = {
  organizationName: '',
  projectName: '',
  templateId: null,
  tasks: [{ id: 0, value: '' }],
  teamMembers: [{ id: 0, value: '' }],
  currentStep: 0,
};

const accountSetupSlice = createSlice({
  name: 'accountSetup',
  initialState,
  reducers: {
    setOrganizationName: (state, action: PayloadAction<string>) => {
      state.organizationName = action.payload;
    },
    setProjectName: (state, action: PayloadAction<string>) => {
      state.projectName = action.payload;
    },
    setTemplateId: (state, action: PayloadAction<string | null>) => {
      state.templateId = action.payload;
    },
    setTasks: (state, action: PayloadAction<Task[]>) => {
      state.tasks = action.payload;
    },
    setTeamMembers: (state, action: PayloadAction<Email[]>) => {
      state.teamMembers = action.payload;
    },
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    resetAccountSetup: () => initialState,
  },
});

export const {
  setOrganizationName,
  setProjectName,
  setTemplateId,
  setTasks,
  setTeamMembers,
  setCurrentStep,
  resetAccountSetup,
} = accountSetupSlice.actions;

export default accountSetupSlice.reducer;
