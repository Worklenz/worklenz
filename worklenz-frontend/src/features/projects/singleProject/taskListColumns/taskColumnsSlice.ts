import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import React, { ReactNode } from 'react';
import PhaseHeader from '../phase/PhaseHeader';
import AddCustomColumnButton from '../../../../pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/add-custom-column-button';

export type CustomTableColumnsType = {
  id?: string;
  key: string; // this key identify each column uniquely
  name: string; // this name show the name of the column. this name is used when custom column generated, show in fields filter
  columnHeader: ReactNode | null; // this column header used to render the actual column title
  width: number;
  isVisible: boolean;
  custom_column?: boolean;
  custom_column_obj?: any; // this object include specific values that are generated based on custom column types
};

export type projectViewTaskListColumnsState = {
  columnList: CustomTableColumnsType[];
};

const initialState: projectViewTaskListColumnsState = {
  columnList: [
    {
      key: 'taskId',
      name: 'key',
      columnHeader: 'key',
      width: 20,
      isVisible: false,
    },
    {
      key: 'task',
      name: 'task',
      columnHeader: 'task',
      width: 320,
      isVisible: true,
    },
    {
      key: 'description',
      name: 'description',
      columnHeader: 'description',
      width: 200,
      isVisible: false,
    },
    {
      key: 'progress',
      name: 'progress',
      columnHeader: 'progress',
      width: 60,
      isVisible: false,
    },
    {
      key: 'status',
      name: 'status',
      columnHeader: 'status',
      width: 120,
      isVisible: true,
    },
    {
      key: 'members',
      name: 'members',
      columnHeader: 'members',
      width: 150,
      isVisible: true,
    },
    {
      key: 'labels',
      name: 'labels',
      columnHeader: 'labels',
      width: 150,
      isVisible: false,
    },
    {
      key: 'phases',
      name: 'phases',
      columnHeader: React.createElement(PhaseHeader),
      width: 150,
      isVisible: false,
    },
    {
      key: 'priority',
      name: 'priority',
      columnHeader: 'priority',
      width: 120,
      isVisible: true,
    },
    {
      key: 'timeTracking',
      name: 'timeTracking',
      columnHeader: 'timeTracking',
      width: 150,
      isVisible: false,
    },
    {
      key: 'estimation',
      name: 'estimation',
      columnHeader: 'estimation',
      width: 150,
      isVisible: false,
    },
    {
      key: 'startDate',
      name: 'startDate',
      columnHeader: 'startDate',
      width: 150,
      isVisible: false,
    },
    {
      key: 'dueDate',
      name: 'dueDate',
      columnHeader: 'dueDate',
      width: 150,
      isVisible: true,
    },
    {
      key: 'dueTime',
      name: 'dueTime',
      columnHeader: 'dueTime',
      width: 150,
      isVisible: false,
    },
    {
      key: 'completedDate',
      name: 'completedDate',
      columnHeader: 'completedDate',
      width: 150,
      isVisible: false,
    },
    {
      key: 'createdDate',
      name: 'createdDate',
      columnHeader: 'createdDate',
      width: 150,
      isVisible: false,
    },
    {
      key: 'lastUpdated',
      name: 'lastUpdated',
      columnHeader: 'lastUpdated',
      width: 150,
      isVisible: false,
    },
    {
      key: 'reporter',
      name: 'reporter',
      columnHeader: 'reporter',
      width: 150,
      isVisible: false,
    },
  ],
};

const projectViewTaskListColumnsSlice = createSlice({
  name: 'projectViewTaskListColumnsReducer',
  initialState,
  reducers: {
    toggleColumnVisibility: (state, action: PayloadAction<string>) => {
      const column = state.columnList.find(col => col.key === action.payload);
      if (column) {
        column.isVisible = !column.isVisible;
      }
    },
    addCustomColumn: (state, action: PayloadAction<CustomTableColumnsType>) => {
      const customColumnCreaterIndex = state.columnList.findIndex(
        col => col.key === 'customColumn'
      );

      if (customColumnCreaterIndex > -1) {
        state.columnList.splice(customColumnCreaterIndex, 0, action.payload);
      } else {
        state.columnList.push(action.payload);
      }
    },
    deleteCustomColumn: (state, action: PayloadAction<string>) => {
      state.columnList = state.columnList.filter(col => col.key !== action.payload);
    },
    updateCustomColumn(
      state,
      action: PayloadAction<{
        key: string;
        updatedColumn: CustomTableColumnsType;
      }>
    ) {
      const index = state.columnList.findIndex(column => column.key === action.payload.key);
      console.log('index', index, action.payload.key);
      if (index !== -1) {
        state.columnList[index] = action.payload.updatedColumn;
      }
    },
  },
});

export const { toggleColumnVisibility, addCustomColumn, deleteCustomColumn, updateCustomColumn } =
  projectViewTaskListColumnsSlice.actions;
export default projectViewTaskListColumnsSlice.reducer;
