import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClientSettings {
  company_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  email_notifications: boolean;
  project_updates: boolean;
  invoice_notifications: boolean;
  request_updates: boolean;
}

interface SettingsState {
  settings: ClientSettings;
  loading: boolean;
  error: string | null;
}

const initialState: SettingsState = {
  settings: {
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    email_notifications: true,
    project_updates: true,
    invoice_notifications: true,
    request_updates: true
  },
  loading: false,
  error: null
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings: (state, action: PayloadAction<ClientSettings>) => {
      state.settings = action.payload;
    },
    updateSettings: (state, action: PayloadAction<Partial<ClientSettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const { setSettings, updateSettings, setLoading, setError } = settingsSlice.actions;
export default settingsSlice.reducer; 