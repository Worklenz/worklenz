import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const PROJECT_SETTINGS_SECTIONS = [
  'general',
  'advanced',
  'budget',
  'statuses',
  'phases',
  'customColumns',
  'integrations',
  'dangerZone',
] as const;

export type ProjectSettingsSection = (typeof PROJECT_SETTINGS_SECTIONS)[number];

interface IProjectSettingsModalState {
  isOpen: boolean;
  activeSection: ProjectSettingsSection;
}

const initialState: IProjectSettingsModalState = {
  isOpen: false,
  activeSection: 'general',
};

const projectSettingsModalSlice = createSlice({
  name: 'projectSettingsModal',
  initialState,
  reducers: {
    openProjectSettingsModal: state => {
      state.isOpen = true;
    },
    closeProjectSettingsModal: state => {
      state.isOpen = false;
      state.activeSection = 'general';
    },
    setActiveSettingsSection: (state, action: PayloadAction<ProjectSettingsSection>) => {
      state.activeSection = action.payload;
    },
  },
});

export const { openProjectSettingsModal, closeProjectSettingsModal, setActiveSettingsSection } =
  projectSettingsModalSlice.actions;
export default projectSettingsModalSlice.reducer;
