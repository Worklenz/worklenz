import { createElement, ReactElement } from "react";
import { DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "./InvoiceDocument";
import { LkrReceiptDocument } from "./LkrReceiptDocument";
import { registerPdfFonts } from "./fonts";
import { loadLogo } from "./load-logo";
import { DocumentType, InvoiceData, ReceiptData } from "./types";

export type { DocumentType, InvoiceData, ReceiptData } from "./types";

/** Renders a client-portal invoice or quote (same layout, different labels) to PDF bytes. */
export const buildInvoicePdf = async (data: InvoiceData, documentType: DocumentType): Promise<Buffer> => {
  registerPdfFonts();
  const showLogo = data.organization?.showLogo !== false;
  const logo = showLogo ? await loadLogo(data.organization?.logoUrl) : null;
  return renderToBuffer(
    createElement(InvoiceDocument, { data, documentType, logo }) as unknown as ReactElement<DocumentProps>
  );
};

/** Renders a billing payment receipt to PDF bytes. */
export const buildReceiptPdf = async (data: ReceiptData): Promise<Buffer> => {
  registerPdfFonts();
  return renderToBuffer(
    createElement(LkrReceiptDocument, { data }) as unknown as ReactElement<DocumentProps>
  );
};
