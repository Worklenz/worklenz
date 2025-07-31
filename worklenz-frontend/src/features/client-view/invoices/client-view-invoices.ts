import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ClientInvoice {
  id: string;
  invoice_no: string;
  amount: number;
  currency: string;
  status: string;
  due_date: string;
  created_at: string;
  sent_at?: string;
  paid_at?: string;
}

interface InvoicesState {
  invoices: ClientInvoice[];
  loading: boolean;
  error: string | null;
}

const initialState: InvoicesState = {
  invoices: [],
  loading: false,
  error: null
};

const invoicesSlice = createSlice({
  name: 'invoices',
  initialState,
  reducers: {
    setInvoices: (state, action: PayloadAction<ClientInvoice[]>) => {
      state.invoices = action.payload;
    },
    addInvoice: (state, action: PayloadAction<ClientInvoice>) => {
      state.invoices.push(action.payload);
    },
    updateInvoice: (state, action: PayloadAction<ClientInvoice>) => {
      const index = state.invoices.findIndex(inv => inv.id === action.payload.id);
      if (index !== -1) {
        state.invoices[index] = action.payload;
      }
    },
    removeInvoice: (state, action: PayloadAction<string>) => {
      state.invoices = state.invoices.filter(inv => inv.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const { setInvoices, addInvoice, updateInvoice, removeInvoice, setLoading, setError } = invoicesSlice.actions;
export default invoicesSlice.reducer; 