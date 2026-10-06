import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IAccountSetupSurveyData } from '@/types/account-setup/survey.types';

interface Email {
  id: number;
  value: string;
}

interface AccountSetupState {
  organizationName: string;
  projectName: string;
  templateId: string | null;
  teamMembers: Email[];
  currentStep: number;
  // surveyData/surveySubStep are no longer collected by the account-setup wizard
  // (see OrganizationStep -> ProjectStep -> MembersStep). They're kept here because
  // SurveyPromptModal still reuses this slice for its own, separately-triggered survey.
  surveyData: IAccountSetupSurveyData;
  surveySubStep: number;
}

const initialState: AccountSetupState = {
  organizationName: '',
  projectName: '',
  templateId: null,
  teamMembers: [{ id: 0, value: '' }],
  currentStep: 0,
  surveyData: {},
  surveySubStep: 0,
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
    setTeamMembers: (state, action: PayloadAction<Email[]>) => {
      state.teamMembers = action.payload;
    },
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStep = action.payload;
    },
    setSurveyData: (state, action: PayloadAction<Partial<IAccountSetupSurveyData>>) => {
      state.surveyData = { ...state.surveyData, ...action.payload };
    },
    setSurveySubStep: (state, action: PayloadAction<number>) => {
      state.surveySubStep = action.payload;
    },
    resetSurveyData: state => {
      state.surveyData = {};
      state.surveySubStep = 0;
    },
    resetAccountSetup: () => initialState,
  },
});

export const {
  setOrganizationName,
  setProjectName,
  setTemplateId,
  setTeamMembers,
  setCurrentStep,
  setSurveyData,
  setSurveySubStep,
  resetSurveyData,
  resetAccountSetup,
} = accountSetupSlice.actions;

export default accountSetupSlice.reducer;
