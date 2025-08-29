import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Temporary type for invoice data - replace with actual type when available
interface TempInvoiceType {
  id: string;
  invoice_no: string;
  client_name: string;
  service: string;
  status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  issued_time: string;
}

// temp data for invoices table
const tempInvoicesData: TempInvoiceType[] = [
  {
    id: '1',
    invoice_no: '2124252',
    client_name: 'alexander tuner',
    service: 'Web Development',
    status: 'paid',
    issued_time: '2024-01-15',
  },
  {
    id: '2',
    invoice_no: '8989089',
    client_name: 'emily davis',
    service: 'Mobile App Development',
    status: 'pending',
    issued_time: '2024-01-20',
  },
  {
    id: '3',
    invoice_no: '34536656',
    client_name: 'emma cooper',
    service: 'UI/UX Design',
    status: 'overdue',
    issued_time: '2024-01-10',
  },
];

export type ClientViewInvoicesState = {
  invoices: TempInvoiceType[];
  isAddInvoiceDrawerOpen: boolean;
};

const initialState: ClientViewInvoicesState = {
  invoices: tempInvoicesData,
  isAddInvoiceDrawerOpen: false,
};

const clientViewInvoicesSlice = createSlice({
  name: 'clientViewInvoicesReducer',
  initialState,
  reducers: {
    toggleAddInvoiceDrawer: state => {
      state.isAddInvoiceDrawerOpen = !state.isAddInvoiceDrawerOpen;
    },
    addInvoice: (state, action: PayloadAction<TempInvoiceType>) => {
      state.invoices.push(action.payload);
    },
    deleteInvoice: (state, action: PayloadAction<string>) => {
      state.invoices = state.invoices.filter(invoice => invoice.id !== action.payload);
    },
  },
});

export const { toggleAddInvoiceDrawer, addInvoice, deleteInvoice } =
  clientViewInvoicesSlice.actions;
export default clientViewInvoicesSlice.reducer;
