import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface TaskListField {
  key: string;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_FIELDS: TaskListField[] = [
  { key: 'KEY', label: 'Key', visible: false, order: 1 },
  { key: 'DESCRIPTION', label: 'Description', visible: false, order: 2 },
  { key: 'PROGRESS', label: 'Progress', visible: true, order: 3 },
  { key: 'ASSIGNEES', label: 'Assignees', visible: true, order: 4 },
  { key: 'LABELS', label: 'Labels', visible: true, order: 5 },
  { key: 'PHASE', label: 'Phase', visible: true, order: 6 },
  { key: 'STATUS', label: 'Status', visible: true, order: 7 },
  { key: 'PRIORITY', label: 'Priority', visible: true, order: 8 },
  { key: 'TIME_TRACKING', label: 'Time Tracking', visible: true, order: 9 },
  { key: 'ESTIMATION', label: 'Estimation', visible: false, order: 10 },
  { key: 'START_DATE', label: 'Start Date', visible: false, order: 11 },
  { key: 'DUE_DATE', label: 'Due Date', visible: true, order: 12 },
  { key: 'DUE_TIME', label: 'Due Time', visible: false, order: 13 },
  { key: 'COMPLETED_DATE', label: 'Completed Date', visible: false, order: 14 },
  { key: 'CREATED_DATE', label: 'Created Date', visible: false, order: 15 },
  { key: 'LAST_UPDATED', label: 'Last Updated', visible: false, order: 16 },
  { key: 'REPORTER', label: 'Reporter', visible: false, order: 17 },
];

const LOCAL_STORAGE_KEY = 'worklenz.taskManagement.fields';

function loadFields(): TaskListField[] {
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return parsed;
    } catch (error) {
      console.warn('Failed to parse stored fields, using defaults:', error);
    }
  }
  
  return DEFAULT_FIELDS;
}

function saveFields(fields: TaskListField[]) {
  console.log('Saving fields to localStorage:', fields);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fields));
}

const initialState: TaskListField[] = loadFields();

const taskListFieldsSlice = createSlice({
  name: 'taskManagementFields',
  initialState,
  reducers: {
    toggleField(state, action: PayloadAction<string>) {
      const field = state.find(f => f.key === action.payload);
      if (field) {
        field.visible = !field.visible;
      }
    },
    setFields(state, action: PayloadAction<TaskListField[]>) {
      return action.payload;
    },
    resetFields() {
      return DEFAULT_FIELDS;
    },
  },
});

export const { toggleField, setFields, resetFields } = taskListFieldsSlice.actions;

// Utility function to force reset fields (can be called from browser console)
export const forceResetFields = () => {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  console.log('Cleared localStorage and reset fields to defaults');
  return DEFAULT_FIELDS;
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).forceResetTaskFields = forceResetFields;
}

export default taskListFieldsSlice.reducer; 