import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export const PROJECT_SETTINGS_SECTIONS = [
  'general',
  'advanced',
  'budget',
  'statuses',
  'phases',
  'customColumns',
  'integrations',
  'taskExport',
  'dangerZone',
] as const;

export type ProjectSettingsSection = (typeof PROJECT_SETTINGS_SECTIONS)[number];

interface IProjectSettingsModalState {
  isOpen: boolean;
  activeSection: ProjectSettingsSection;
  /** When true, Update navigates into the project (used after customize-on-create). */
  navigateToProjectOnUpdate: boolean;
}

const initialState: IProjectSettingsModalState = {
  isOpen: false,
  activeSection: 'general',
  navigateToProjectOnUpdate: false,
};

const projectSettingsModalSlice = createSlice({
  name: 'projectSettingsModal',
  initialState,
  reducers: {
    openProjectSettingsModal: (
      state,
      action: PayloadAction<{ navigateToProjectOnUpdate?: boolean } | undefined>
    ) => {
      state.isOpen = true;
      state.navigateToProjectOnUpdate = Boolean(action.payload?.navigateToProjectOnUpdate);
    },
    closeProjectSettingsModal: state => {
      state.isOpen = false;
      state.activeSection = 'general';
      state.navigateToProjectOnUpdate = false;
    },
    setActiveSettingsSection: (state, action: PayloadAction<ProjectSettingsSection>) => {
      state.activeSection = action.payload;
    },
  },
});

export const { openProjectSettingsModal, closeProjectSettingsModal, setActiveSettingsSection } =
  projectSettingsModalSlice.actions;

export default projectSettingsModalSlice.reducer;
