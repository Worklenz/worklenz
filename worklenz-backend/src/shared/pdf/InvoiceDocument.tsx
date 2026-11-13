import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import {
  formatCityStateZip,
  formatCurrency,
  formatDate,
  htmlToPlainText,
  getClientAddressParts,
  getStatusBadgeColors,
  getStatusText,
  safeColor,
  DEFAULT_FOOTER_MESSAGES,
} from "./format";
import { PDF_FONT_FAMILY } from "./fonts";
import { DocumentType, InvoiceData } from "./types";

interface InvoiceDocumentProps {
  data: InvoiceData;
  documentType: DocumentType;
  /** Pre-fetched PNG/JPEG logo bytes; null renders the organization's initial instead. */
  logo: Buffer | null;
}

export const LABELS: Record<DocumentType, { title: string; heading: string; party: string; date: string; due: string }> = {
  invoice: { title: "Invoice", heading: "INVOICE", party: "BILLED TO", date: "Invoice Date", due: "Due Date" },
  quote: { title: "Quote", heading: "QUOTE", party: "PREPARED FOR", date: "Quote Date", due: "Valid Until" },
};

const COLUMN_WIDTHS = { description: "46%", quantity: "14%", rate: "20%", amount: "20%" };

const createStyles = (primary: string, isModern: boolean) =>
  StyleSheet.create({
    page: {
      fontFamily: PDF_FONT_FAMILY,
      fontSize: 10,
      color: "#333333",
      lineHeight: 1.4,
      paddingTop: 40,
      paddingBottom: 60,
      paddingLeft: 40,
      paddingRight: 40,
    },
    container: isModern ? { borderLeftWidth: 4, borderLeftColor: primary, paddingLeft: 18 } : {},
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 28,
      paddingBottom: isModern ? 0 : 14,
      borderBottomWidth: isModern ? 0 : 2,
      borderBottomColor: primary,
    },
    companySection: { flexDirection: "row", alignItems: "center", flexShrink: 1, maxWidth: "62%" },
    logoBox: {
      width: 44,
      height: 44,
      borderRadius: 6,
      backgroundColor: primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    logoImage: { width: 44, height: 44, objectFit: "contain" },
    logoInitial: { color: "#ffffff", fontWeight: 700, fontSize: 20 },
    companyName: { fontSize: 17, fontWeight: 700, color: primary, marginBottom: 3 },
    companyLine: { fontSize: 9, color: "#666666", marginTop: 1 },
    titleSection: { alignItems: "flex-end" },
    heading: {
      fontSize: 26,
      color: isModern ? primary : "#333333",
      fontWeight: isModern ? 700 : 400,
      letterSpacing: isModern ? 0 : 1.5,
      marginBottom: 6,
    },
    number: { fontSize: 11, color: "#666666", marginBottom: 6 },
    badge: {
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 0.4,
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 12,
      paddingRight: 12,
      borderRadius: 12,
    },
    meta: { flexDirection: "row", marginBottom: 28 },
    party: { flex: 1, paddingRight: 20 },
    details: { flex: 1 },
    detailsRow: { flexDirection: "row", marginBottom: 12 },
    detailCell: { width: "50%" },
    sectionLabel: { fontSize: 8, letterSpacing: 0.8, color: "#999999", fontWeight: 700, marginBottom: 6 },
    partyName: { fontSize: 13, fontWeight: 700, color: "#333333", marginBottom: 3 },
    partyLine: { fontSize: 10, color: "#666666" },
    detailLabel: { fontSize: 8, letterSpacing: 0.4, color: "#999999", marginBottom: 3 },
    detailValue: { fontSize: 10, fontWeight: 700, color: "#333333" },
    detailHighlight: { fontSize: 14, fontWeight: 700, color: primary },
    danger: { color: "#ff4d4f" },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: isModern ? "#ffffff" : "#f8f9fa",
      borderBottomWidth: 1.5,
      borderBottomColor: isModern ? primary : "#e8e8e8",
    },
    th: { fontSize: 8, letterSpacing: 0.4, color: "#666666", fontWeight: 700, padding: 10 },
    row: { flexDirection: "row", borderBottomWidth: isModern ? 0 : 0.75, borderBottomColor: "#eeeeee" },
    td: { fontSize: 10, color: "#333333", padding: 10 },
    totalsSection: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20, marginBottom: 28 },
    totalsBox: { width: 210 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, paddingBottom: 6 },
    totalsText: { fontSize: 10, color: "#666666" },
    grandTotalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1.5,
      borderTopColor: "#333333",
      paddingTop: 10,
      marginTop: 6,
    },
    grandTotalLabel: { fontSize: 13, fontWeight: 700, color: "#333333" },
    grandTotalAmount: { fontSize: 15, fontWeight: 700, color: primary },
    notes: { backgroundColor: "#f8f9fa", padding: 14, borderRadius: 6, marginBottom: 28 },
    notesTitle: { fontSize: 8, letterSpacing: 0.4, color: "#666666", fontWeight: 700, marginBottom: 6 },
    notesText: { fontSize: 10, color: "#555555", lineHeight: 1.5 },
    footer: { alignItems: "center", paddingTop: 18, borderTopWidth: 0.75, borderTopColor: "#eeeeee" },
    thankYou: { fontSize: 11, color: "#666666", marginBottom: 5 },
    footerText: { fontSize: 9, color: "#999999" },
    pageNumber: {
      position: "absolute",
      bottom: 24,
      left: 40,
      right: 40,
      textAlign: "center",
      fontSize: 8,
      color: "#999999",
    },
  });

export const InvoiceDocument = ({ data, documentType, logo }: InvoiceDocumentProps) => {
  const labels = LABELS[documentType];
  const org = data.organization;
  const primary = safeColor(org?.primaryColor);
  const isModern = org?.templateStyle === "modern";
  const showLogo = org?.showLogo !== false;
  const styles = createStyles(primary, isModern);

  const organizationName = org?.name || "Your Company";
  const organizationEmail = org?.email || "";
  const organizationPhone = org?.phone || "";
  const companyLines = [
    organizationEmail,
    organizationPhone,
    org?.addressLine1 || "",
    org?.addressLine2 || "",
    formatCityStateZip(org?.city, org?.state, org?.zipCode),
    org?.country || "",
  ].filter(Boolean);

  const badgeStatus = data.paymentStatus || data.status;
  const badgeColors = getStatusBadgeColors(badgeStatus);

  // Invoices saved before line items existed have none: show the whole amount as one line.
  const lineItems =
    data.lineItems && data.lineItems.length > 0
      ? data.lineItems
      : [
          {
            description: data.request?.service?.name || "Service Items",
            quantity: 1,
            rate: data.subtotal || data.amount,
            amount: data.subtotal || data.amount,
          },
        ];
  const subtotal = data.subtotal || data.amount;
  const discountAmount = data.discountAmount || 0;
  const taxAmount = data.taxAmount || 0;
  const footerContact = [organizationName, organizationEmail, organizationPhone].filter(Boolean).join(" • ");

  return (
    <Document title={`${labels.title} - ${data.invoiceNumber}`} author={organizationName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.companySection}>
              {showLogo ? (
                <View style={styles.logoBox}>
                  {logo ? (
                    <Image src={logo} style={styles.logoImage} />
                  ) : (
                    <Text style={styles.logoInitial}>{organizationName.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
              ) : null}
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.companyName}>{organizationName}</Text>
                {companyLines.map(line => (
                  <Text key={line} style={styles.companyLine}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
            <View style={styles.titleSection}>
              <Text style={styles.heading}>{labels.heading}</Text>
              <Text style={styles.number}>#{data.invoiceNumber}</Text>
              <Text style={[styles.badge, badgeColors]}>{getStatusText(badgeStatus).toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.meta}>
            <View style={styles.party}>
              <Text style={styles.sectionLabel}>{labels.party}</Text>
              <Text style={styles.partyName}>{data.client?.name || "-"}</Text>
              {getClientAddressParts(data.client).map(part => (
                <Text key={part} style={styles.partyLine}>
                  {part}
                </Text>
              ))}
            </View>
            <View style={styles.details}>
              <View style={styles.detailsRow}>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>{labels.date.toUpperCase()}</Text>
                  <Text style={styles.detailValue}>{formatDate(data.createdAt)}</Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>{labels.due.toUpperCase()}</Text>
                  <Text style={data.isOverdue ? [styles.detailValue, styles.danger] : styles.detailValue}>
                    {formatDate(data.dueDate)}
                  </Text>
                </View>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>REFERENCE</Text>
                  <Text style={styles.detailValue}>{data.request?.requestNumber || "-"}</Text>
                </View>
                <View style={styles.detailCell}>
                  <Text style={styles.detailLabel}>TOTAL</Text>
                  <Text style={styles.detailHighlight}>{formatCurrency(data.amount, data.currency)}</Text>
                </View>
              </View>
            </View>
          </View>

          <View>
            <View style={styles.tableHeader} fixed>
              <Text style={[styles.th, { width: COLUMN_WIDTHS.description }]}>DESCRIPTION</Text>
              <Text style={[styles.th, { width: COLUMN_WIDTHS.quantity, textAlign: "center" }]}>QUANTITY</Text>
              <Text style={[styles.th, { width: COLUMN_WIDTHS.rate, textAlign: "center" }]}>RATE</Text>
              <Text style={[styles.th, { width: COLUMN_WIDTHS.amount, textAlign: "right" }]}>AMOUNT</Text>
            </View>
            {lineItems.map((item, index) => (
              <View
                key={index}
                style={[styles.row, isModern && index % 2 === 1 ? { backgroundColor: "#fafafa" } : {}]}
                wrap={false}
              >
                <Text style={[styles.td, { width: COLUMN_WIDTHS.description }]}>{item.description}</Text>
                <Text style={[styles.td, { width: COLUMN_WIDTHS.quantity, textAlign: "center" }]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.td, { width: COLUMN_WIDTHS.rate, textAlign: "center" }]}>
                  {formatCurrency(item.rate, data.currency)}
                </Text>
                <Text style={[styles.td, { width: COLUMN_WIDTHS.amount, textAlign: "right" }]}>
                  {formatCurrency(item.amount, data.currency)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalsSection} wrap={false}>
            <View style={styles.totalsBox}>
              <View style={styles.totalsRow}>
                <Text style={styles.totalsText}>Subtotal</Text>
                <Text style={styles.totalsText}>{formatCurrency(subtotal, data.currency)}</Text>
              </View>
              {discountAmount > 0 ? (
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsText}>
                    Discount ({data.discountType === "percentage" ? `${data.discountValue || 0}%` : "flat"})
                  </Text>
                  <Text style={styles.totalsText}>-{formatCurrency(discountAmount, data.currency)}</Text>
                </View>
              ) : null}
              <View style={styles.totalsRow}>
                <Text style={styles.totalsText}>Tax ({data.taxRate || 0}%)</Text>
                <Text style={styles.totalsText}>{formatCurrency(taxAmount, data.currency)}</Text>
              </View>
              <View style={styles.grandTotalRow}>
                <Text style={styles.grandTotalLabel}>Total</Text>
                <Text style={styles.grandTotalAmount}>{formatCurrency(data.amount, data.currency)}</Text>
              </View>
            </View>
          </View>

          {data.notes ? (
            <View style={styles.notes} wrap={false}>
              <Text style={styles.notesTitle}>NOTES</Text>
              <Text style={styles.notesText}>{htmlToPlainText(data.notes)}</Text>
            </View>
          ) : null}

          <View style={styles.footer} wrap={false}>
            <Text style={styles.thankYou}>{org?.invoiceFooterMessage?.trim() || DEFAULT_FOOTER_MESSAGES[documentType]}</Text>
            <Text style={styles.footerText}>{footerContact}</Text>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => (totalPages > 1 ? `${pageNumber} / ${totalPages}` : "")}
        />
      </Page>
    </Document>
  );
};
