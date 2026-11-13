import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY } from "./fonts";
import { ReceiptData } from "./types";

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, color: "#1a1a2e", fontSize: 10.5, padding: 40 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 },
  brand: { flexDirection: "row", fontSize: 17, fontWeight: 700 },
  brandBlue: { color: "#1890ff" },
  badge: {
    backgroundColor: "#f6ffed",
    borderWidth: 0.75,
    borderColor: "#b7eb8f",
    color: "#389e0d",
    fontSize: 9,
    fontWeight: 700,
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 10,
    paddingRight: 10,
    borderRadius: 12,
  },
  title: { fontSize: 21, fontWeight: 700, marginBottom: 3 },
  subtitle: { color: "#8c8c8c", fontSize: 10 },
  divider: { borderTopWidth: 0.75, borderTopColor: "#f0f0f0", marginTop: 18, marginBottom: 18 },
  amountBox: {
    backgroundColor: "#f0f7ff",
    borderRadius: 9,
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 21,
    paddingRight: 21,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: { fontSize: 10, color: "#595959" },
  amountPlan: { fontSize: 10, color: "#595959", marginTop: 3 },
  amountValue: { fontSize: 21, fontWeight: 700, color: "#1890ff" },
  twoCol: { flexDirection: "row", marginBottom: 24 },
  col: { flex: 1, paddingRight: 24 },
  label: { fontSize: 8, fontWeight: 700, color: "#8c8c8c", letterSpacing: 0.5, marginBottom: 3 },
  value: { fontSize: 10.5 },
  tableRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, paddingBottom: 8 },
  tableRowBorder: { borderBottomWidth: 0.75, borderBottomColor: "#f5f5f5" },
  tableKey: { fontSize: 10, color: "#8c8c8c" },
  tableValue: { fontSize: 10, fontWeight: 700, maxWidth: "55%", textAlign: "right" },
  footer: {
    marginTop: 24,
    borderTopWidth: 0.75,
    borderTopColor: "#f0f0f0",
    paddingTop: 15,
    textAlign: "center",
    fontSize: 8.5,
    color: "#bfbfbf",
  },
  footerStrong: { color: "#8c8c8c", fontWeight: 700 },
});

const formatAmount = (amount: number, currency: string): string =>
  `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const LkrReceiptDocument = ({ data }: { data: ReceiptData }) => {
  const rows: Array<{ key: string; value: string; valueStyle?: { color: string } }> = [];
  if (data.transactionId) rows.push({ key: "Transaction ID", value: data.transactionId });
  if (data.orderId) rows.push({ key: "Order Reference", value: data.orderId });
  if (data.cardNumber) rows.push({ key: "Payment Method", value: `Card ending ${data.cardNumber.slice(-4)}` });
  rows.push({ key: "Currency", value: data.currency });
  rows.push({ key: "Status", value: "Paid", valueStyle: { color: "#389e0d" } });

  return (
    <Document title={`Payment Receipt - ${data.receiptNumber}`} author="Worklenz">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandBlue}>Work</Text>
            <Text>lenz</Text>
          </View>
          <Text style={styles.badge}>Payment Successful</Text>
        </View>

        <Text style={styles.title}>Payment Receipt</Text>
        <Text style={styles.subtitle}>Receipt #{data.receiptNumber}</Text>

        <View style={styles.divider} />

        <View style={styles.amountBox}>
          <View>
            <Text style={styles.amountLabel}>Amount Paid</Text>
            {data.planName ? <Text style={styles.amountPlan}>{data.planName}</Text> : null}
          </View>
          <Text style={styles.amountValue}>{formatAmount(data.amount, data.currency)}</Text>
        </View>

        <View style={styles.twoCol}>
          {data.orgName || data.userName ? (
            <View style={styles.col}>
              <Text style={styles.label}>BILLED TO</Text>
              {data.orgName ? <Text style={[styles.value, { fontWeight: 700 }]}>{data.orgName}</Text> : null}
              {data.userName ? <Text style={styles.value}>{data.userName}</Text> : null}
              {data.userEmail ? <Text style={[styles.value, { color: "#595959" }]}>{data.userEmail}</Text> : null}
            </View>
          ) : null}
          <View style={styles.col}>
            <Text style={styles.label}>PAYMENT DATE</Text>
            <Text style={styles.value}>{data.date}</Text>
          </View>
        </View>

        <View>
          {rows.map((row, index) => (
            <View key={row.key} style={[styles.tableRow, index < rows.length - 1 ? styles.tableRowBorder : {}]}>
              <Text style={styles.tableKey}>{row.key}</Text>
              <Text style={[styles.tableValue, row.valueStyle ?? {}]}>{row.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text>
            <Text style={styles.footerStrong}>Worklenz</Text> — This is an automatically generated receipt.
          </Text>
          <Text>
            For support, contact <Text style={styles.footerStrong}>support@worklenz.com</Text>
          </Text>
        </View>
      </Page>
    </Document>
  );
};
