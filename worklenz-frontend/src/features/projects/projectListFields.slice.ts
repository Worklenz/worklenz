import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  ProjectListField,
  ProjectListFieldState,
  DEFAULT_PROJECT_FIELDS,
} from '@/types/project-list-field.types';

const LOCAL_STORAGE_KEY = 'worklenz.projectList.fields';

// Load fields from localStorage or use defaults. Merges in any default fields
// missing from an older cached array (e.g. a field added after a user's last
// visit) so new columns show up without needing to clear localStorage.
const loadFieldsFromStorage = (): ProjectListField[] => {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        const missing = DEFAULT_PROJECT_FIELDS.filter(
          defaultField => !parsed.some(field => field.key === defaultField.key)
        );
        return missing.length > 0 ? [...parsed, ...missing] : parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load project list fields from localStorage:', error);
  }
  return DEFAULT_PROJECT_FIELDS;
};

const initialState: ProjectListFieldState = {
  fields: loadFieldsFromStorage(),
  loading: false,
  error: null,
};

const projectListFieldsSlice = createSlice({
  name: 'projectListFields',
  initialState,
  reducers: {
    toggleProjectField: (state, action: PayloadAction<string>) => {
      const field = state.fields.find(f => f.key === action.payload);
      if (field) {
        field.visible = !field.visible;
        // Save to localStorage
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.fields));
        } catch (error) {
          console.error('Failed to save project list fields to localStorage:', error);
        }
      }
    },
    setProjectFieldVisibility: (
      state,
      action: PayloadAction<{ key: string; visible: boolean }>
    ) => {
      const field = state.fields.find(f => f.key === action.payload.key);
      if (field) {
        field.visible = action.payload.visible;
        // Save to localStorage
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.fields));
        } catch (error) {
          console.error('Failed to save project list fields to localStorage:', error);
        }
      }
    },
    resetProjectFields: state => {
      state.fields = DEFAULT_PROJECT_FIELDS;
      // Save to localStorage
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_PROJECT_FIELDS));
      } catch (error) {
        console.error('Failed to save project list fields to localStorage:', error);
      }
    },
    reorderProjectFields: (state, action: PayloadAction<ProjectListField[]>) => {
      state.fields = action.payload;
      // Save to localStorage
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(action.payload));
      } catch (error) {
        console.error('Failed to save project list fields to localStorage:', error);
      }
    },
  },
});

export const {
  toggleProjectField,
  setProjectFieldVisibility,
  resetProjectFields,
  reorderProjectFields,
} = projectListFieldsSlice.actions;

export default projectListFieldsSlice.reducer;
