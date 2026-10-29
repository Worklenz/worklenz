import { buildInvoicePdf, buildReceiptPdf, InvoiceData } from "../shared/pdf";

const base: InvoiceData = {
  invoiceNumber: "INV-0001",
  status: "sent",
  paymentStatus: "unpaid",
  createdAt: "2026-01-15T00:00:00.000Z",
  dueDate: "2026-02-15T00:00:00.000Z",
  amount: 1180,
  currency: "USD",
  subtotal: 1000,
  taxRate: 18,
  taxAmount: 180,
  lineItems: [{ description: "Design work", quantity: 2, rate: 500, amount: 1000 }],
  client: { name: "Acme Ltd", companyName: "Acme", email: "billing@acme.test", phone: "123", address: "1 Main St" },
  request: { requestNumber: "REQ-7", service: { name: "Design" } },
  notes: "Thanks for your business.",
  organization: {
    name: "Worklenz Org",
    logoUrl: null,
    primaryColor: "#1890ff",
    email: "org@worklenz.test",
    phone: "999",
    addressLine1: "10 Road",
    addressLine2: null,
    invoiceFooterMessage: "Thank you!",
  },
};

const isPdf = (buffer: Buffer): boolean => buffer.subarray(0, 5).toString() === "%PDF-";

describe("PDF documents", () => {
  it("renders an invoice", async () => {
    const pdf = await buildInvoicePdf(base, "invoice");
    expect(isPdf(pdf)).toBe(true);
  });

  it("renders a quote in the modern preset with a bad logo url and no line items", async () => {
    const pdf = await buildInvoicePdf(
      {
        ...base,
        lineItems: [],
        organization: { ...base.organization!, templateStyle: "modern", logoUrl: "https://invalid.invalid/logo.png" },
      },
      "quote"
    );
    expect(isPdf(pdf)).toBe(true);
  });

  it("renders discount, overdue state and an invalid brand colour", async () => {
    const pdf = await buildInvoicePdf(
      {
        ...base,
        isOverdue: true,
        discountAmount: 100,
        discountType: "percentage",
        discountValue: 10,
        organization: { ...base.organization!, primaryColor: "not-a-color" },
      },
      "invoice"
    );
    expect(isPdf(pdf)).toBe(true);
  });

  it("renders a long item list across pages and non-Latin text", async () => {
    const lineItems = Array.from({ length: 80 }, (_, i) => ({
      description: `Item ${i + 1} ශ්‍රී ලංකා தமிழ்`,
      quantity: 1,
      rate: 10,
      amount: 10,
    }));
    const pdf = await buildInvoicePdf(
      { ...base, lineItems, client: { ...base.client, name: "සමාගම தமிழ் Ltd" } },
      "invoice"
    );
    expect(isPdf(pdf)).toBe(true);
    if (process.env.PDF_SAMPLE_DIR) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("fs").writeFileSync(`${process.env.PDF_SAMPLE_DIR}/long.pdf`, pdf);
    }
  });

  it("renders a receipt", async () => {
    const pdf = await buildReceiptPdf({
      receiptNumber: "ABC123",
      date: "15 January 2026",
      amount: 5000,
      currency: "LKR",
      transactionId: "T1",
      orderId: "O1",
      cardNumber: "4111111111111111",
      planName: "Pro Plan — LKR 5000.00 / month",
      userName: "Sam",
      userEmail: "sam@test.dev",
      orgName: "Org",
    });
    expect(isPdf(pdf)).toBe(true);
  });
});

describe("document labels", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LABELS } = require("../shared/pdf/InvoiceDocument");

  it("uses quote wording for quotes", () => {
    expect(LABELS.quote).toEqual(
      expect.objectContaining({ heading: "QUOTE", party: "PREPARED FOR", due: "Valid Until" })
    );
  });

  it("keeps the invoice wording", () => {
    expect(LABELS.invoice).toEqual(
      expect.objectContaining({ heading: "INVOICE", party: "BILLED TO", due: "Due Date" })
    );
  });
});
