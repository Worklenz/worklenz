import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ImportWizardState {
  step: number;
  furthestCompletedStep: number;
  csvText: string;
  csvColumns: string[];
  csvRows: Record<string, any>[];
  fieldMappings: Record<string, string>;
  includeInImport: Record<string, boolean>;
  statusValueMapping: Record<string, string>;
  pendingNewStatuses: Record<string, { name: string; categoryId: string }>;
  addUsers: boolean;
  userEmails: Record<string, string>;
  spaceName: string;
  spaceType: string;
  spaceTemplate: string;
  delimiter: string;
  encoding: string;
  stepErrors: Record<number, string | null>;
}

const initialState: ImportWizardState = {
  step: 0,
  furthestCompletedStep: 0,
  csvText: '',
  csvColumns: [],
  csvRows: [],
  fieldMappings: {},
  includeInImport: {},
  statusValueMapping: {},
  pendingNewStatuses: {},
  addUsers: true,
  userEmails: {},
  spaceName: '',
  spaceType: '',
  spaceTemplate: '',
  delimiter: '',
  encoding: 'UTF-8',
  stepErrors: {},
};

const importWizardSlice = createSlice({
  name: 'importWizard',
  initialState,
  reducers: {
    stepSet: (state, action: PayloadAction<number>) => {
      state.step = action.payload;
      if (action.payload > state.furthestCompletedStep) {
        state.furthestCompletedStep = action.payload;
      }
    },
    csvTextSet: (state, action: PayloadAction<string>) => {
      state.csvText = action.payload;
    },
    csvColumnsSet: (state, action: PayloadAction<string[]>) => {
      state.csvColumns = action.payload;
    },
    csvRowsSet: (state, action: PayloadAction<Record<string, any>[]>) => {
      state.csvRows = action.payload;
    },
    fieldMappingsSet: (state, action: PayloadAction<Record<string, string>>) => {
      state.fieldMappings = action.payload;
    },
    includeInImportSet: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.includeInImport = action.payload;
    },
    statusValueMappingSet: (state, action: PayloadAction<Record<string, string>>) => {
      state.statusValueMapping = action.payload;
    },
    pendingNewStatusesSet: (
      state,
      action: PayloadAction<Record<string, { name: string; categoryId: string }>>
    ) => {
      state.pendingNewStatuses = action.payload;
    },
    addUsersSet: (state, action: PayloadAction<boolean>) => {
      state.addUsers = action.payload;
    },
    userEmailsSet: (state, action: PayloadAction<Record<string, string>>) => {
      state.userEmails = action.payload;
    },
    spaceNameSet: (state, action: PayloadAction<string>) => {
      state.spaceName = action.payload;
    },
    spaceTypeSet: (state, action: PayloadAction<string>) => {
      state.spaceType = action.payload;
    },
    spaceTemplateSet: (state, action: PayloadAction<string>) => {
      state.spaceTemplate = action.payload;
    },
    delimiterSet: (state, action: PayloadAction<string>) => {
      state.delimiter = action.payload;
    },
    encodingSet: (state, action: PayloadAction<string>) => {
      state.encoding = action.payload;
    },
    stepErrorSet: (state, action: PayloadAction<{ step: number; error: string | null }>) => {
      state.stepErrors[action.payload.step] = action.payload.error;
    },
    stepErrorsCleared: state => {
      state.stepErrors = {};
    },
    importWizardReset: (state, action: PayloadAction<{ spaceName: string }>) => {
      Object.assign(state, initialState, { spaceName: action.payload.spaceName });
    },
  },
});

export const {
  stepSet,
  csvTextSet,
  csvColumnsSet,
  csvRowsSet,
  fieldMappingsSet,
  includeInImportSet,
  statusValueMappingSet,
  pendingNewStatusesSet,
  addUsersSet,
  userEmailsSet,
  spaceNameSet,
  spaceTypeSet,
  spaceTemplateSet,
  delimiterSet,
  encodingSet,
  stepErrorSet,
  stepErrorsCleared,
  importWizardReset,
} = importWizardSlice.actions;

export default importWizardSlice.reducer;
