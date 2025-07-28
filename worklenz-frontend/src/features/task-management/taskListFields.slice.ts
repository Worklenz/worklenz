import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { updateColumnVisibility } from './task-management.slice';
import { ITaskListColumn } from '@/types/tasks/taskList.types';
import logger from '@/utils/errorLogger';

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
  { key: 'STATUS', label: 'Status', visible: true, order: 4 },
  { key: 'ASSIGNEES', label: 'Assignees', visible: true, order: 5 },
  { key: 'LABELS', label: 'Labels', visible: true, order: 6 },
  { key: 'PHASE', label: 'Phase', visible: true, order: 7 },
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
      logger.error('Failed to parse stored fields, using defaults:', error);
    }
  }

  return DEFAULT_FIELDS;
}

function saveFields(fields: TaskListField[]) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fields));
}

// Async thunk to sync field visibility with database
export const syncFieldWithDatabase = createAsyncThunk(
  'taskManagementFields/syncFieldWithDatabase',
  async (
    {
      projectId,
      fieldKey,
      visible,
      columns,
    }: {
      projectId: string;
      fieldKey: string;
      visible: boolean;
      columns: ITaskListColumn[];
    },
    { dispatch }
  ) => {
    // Find the corresponding backend column
    const backendColumn = columns.find(c => c.key === fieldKey);
    if (backendColumn) {
      // Update the column visibility in the database
      await dispatch(
        updateColumnVisibility({
          projectId,
          item: {
            ...backendColumn,
            pinned: visible,
          },
        })
      );
    }
    return { fieldKey, visible };
  }
);

// Async thunk to sync all fields with database
export const syncAllFieldsWithDatabase = createAsyncThunk(
  'taskManagementFields/syncAllFieldsWithDatabase',
  async (
    {
      projectId,
      fields,
      columns,
    }: {
      projectId: string;
      fields: TaskListField[];
      columns: ITaskListColumn[];
    },
    { dispatch }
  ) => {
    // Find fields that need to be synced
    const fieldsToSync = fields.filter(field => {
      const backendColumn = columns.find(c => c.key === field.key);
      return backendColumn && (backendColumn.pinned ?? false) !== field.visible;
    });

    // Sync each field
    const syncPromises = fieldsToSync.map(field => {
      const backendColumn = columns.find(c => c.key === field.key);
      if (backendColumn) {
        return dispatch(
          updateColumnVisibility({
            projectId,
            item: {
              ...backendColumn,
              pinned: field.visible,
            },
          })
        );
      }
      return Promise.resolve();
    });

    await Promise.all(syncPromises);
    return fieldsToSync.map(f => ({ fieldKey: f.key, visible: f.visible }));
  }
);

const initialState: TaskListField[] = loadFields();

const taskListFieldsSlice = createSlice({
  name: 'taskManagementFields',
  initialState,
  reducers: {
    toggleField(state, action: PayloadAction<string>) {
      const field = state.find(f => f.key === action.payload);
      if (field) {
        field.visible = !field.visible;
        // Save to localStorage immediately after toggle
        saveFields(state);
      }
    },
    setFields(state, action: PayloadAction<TaskListField[]>) {
      const newState = action.payload;
      // Save to localStorage when fields are set
      saveFields(newState);
      return newState;
    },
    resetFields() {
      const defaultFields = DEFAULT_FIELDS;
      // Save to localStorage when fields are reset
      saveFields(defaultFields);
      return defaultFields;
    },
    // New action to update field visibility from database
    updateFieldVisibilityFromDatabase(
      state,
      action: PayloadAction<{ fieldKey: string; visible: boolean }>
    ) {
      const { fieldKey, visible } = action.payload;
      const field = state.find(f => f.key === fieldKey);
      if (field) {
        field.visible = visible;
        // Save to localStorage
        saveFields(state);
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(syncFieldWithDatabase.fulfilled, (state, action) => {
        // Field visibility has been synced with database
        const { fieldKey, visible } = action.payload;
        const field = state.find(f => f.key === fieldKey);
        if (field) {
          field.visible = visible;
          saveFields(state);
        }
      })
      .addCase(syncAllFieldsWithDatabase.fulfilled, (state, action) => {
        // All fields have been synced with database
        action.payload.forEach(({ fieldKey, visible }) => {
          const field = state.find(f => f.key === fieldKey);
          if (field) {
            field.visible = visible;
          }
        });
        saveFields(state);
      });
  },
});

export const { toggleField, setFields, resetFields, updateFieldVisibilityFromDatabase } =
  taskListFieldsSlice.actions;

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
