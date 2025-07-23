import { AlertConfig, AlertState, AlertType } from '@/types/alert.types';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { notification } from '@/shared/antd-imports';
import DOMPurify from 'dompurify';

const initialState: AlertState = {
  activeAlerts: new Set(),
  config: {
    position: 'topRight',
    duration: 4.5,
    maxCount: 5,
  },
};

const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    showAlert: (
      state,
      action: PayloadAction<{
        type: AlertType;
        title: string;
        message: string;
        duration?: number;
      }>
    ) => {
      if (!state.activeAlerts.has(action.payload.message)) {
        state.activeAlerts.add(action.payload.message);
      }
    },
    hideAlert: (state, action: PayloadAction<string>) => {
      state.activeAlerts.delete(action.payload);
    },
    updateAlertConfig: (state, action: PayloadAction<Partial<AlertConfig>>) => {
      state.config = { ...state.config, ...action.payload };
    },
  },
});

export const { showAlert, hideAlert, updateAlertConfig } = alertSlice.actions;

export default alertSlice.reducer;
