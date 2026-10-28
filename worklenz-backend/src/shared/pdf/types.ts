export interface InvoiceData {
  invoiceNumber: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  amount: number;
  currency: string;
  isOverdue?: boolean;
  /** unpaid | partially_paid | paid — shown as the document badge. */
  paymentStatus?: string;
  lineItems?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  discountType?: string | null;
  discountValue?: number;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  client: {
    name: string;
    companyName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  request?: {
    requestNumber: string;
    service?: {
      name: string;
      description?: string;
    };
  } | null;
  notes?: string | null;
  organization?: {
    name: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    invoiceFooterMessage: string | null;
    /** Defaults to 'classic' (centered-header, bordered-table look) when unset. */
    templateStyle?: "classic" | "modern";
    /** Defaults to true when unset. */
    showLogo?: boolean;
  };
}

export type DocumentType = "invoice" | "quote";

export interface ReceiptData {
  receiptNumber: string;
  date: string;
  amount: number;
  currency: string;
  transactionId: string | null;
  orderId: string | null;
  cardNumber: string | null;
  planName: string | null;
  userName: string | null;
  userEmail: string | null;
  orgName: string | null;
}
