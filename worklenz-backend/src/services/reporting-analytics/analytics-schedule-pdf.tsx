import { createElement, ReactElement } from "react";
import {
  Document,
  DocumentProps,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { registerPdfFonts } from "../../shared/pdf/fonts";

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 9,
    padding: 28,
    color: "#262626",
  },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 9, color: "#595959", marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: 700, marginBottom: 8, marginTop: 4 },
  chart: { width: "100%", height: 220, marginBottom: 16, objectFit: "contain" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9d9d9" },
  header: { backgroundColor: "#f5f5f5", fontWeight: 700 },
  cell: { flexGrow: 1, flexBasis: 0, padding: 4, fontSize: 8 },
  empty: { marginTop: 12, color: "#8c8c8c" },
});

interface SchedulePdfProps {
  title: string;
  exportedOn: string;
  rows: string[][];
  chartPng?: Buffer | null;
}

const SchedulePdfDocument = ({
  title,
  exportedOn,
  rows,
  chartPng,
}: SchedulePdfProps) => {
  const header = rows[0] || [];
  const body = rows.slice(1, 201);
  const colCount = Math.max(header.length, 1);
  const chartSrc = chartPng?.length
    ? `data:image/png;base64,${chartPng.toString("base64")}`
    : null;

  return (
    <Document>
      <Page
        size="A4"
        orientation={colCount > 6 || chartSrc ? "landscape" : "portrait"}
        style={pdfStyles.page}
      >
        <Text style={pdfStyles.title}>{title}</Text>
        <Text style={pdfStyles.meta}>Live export · {exportedOn}</Text>

        {chartSrc ? (
          <>
            <Text style={pdfStyles.sectionTitle}>Chart</Text>
            <Image src={chartSrc} style={pdfStyles.chart} />
          </>
        ) : null}

        <Text style={pdfStyles.sectionTitle}>Table</Text>
        {rows.length === 0 ? (
          <Text style={pdfStyles.empty}>No rows for the saved filters.</Text>
        ) : (
          <>
            <View style={[pdfStyles.row, pdfStyles.header]} wrap={false}>
              {header.map((cell, i) => (
                <Text key={`h-${i}`} style={pdfStyles.cell}>
                  {cell}
                </Text>
              ))}
            </View>
            {body.map((r, ri) => (
              <View key={`r-${ri}`} style={pdfStyles.row} wrap={false}>
                {header.map((_, ci) => (
                  <Text key={`c-${ri}-${ci}`} style={pdfStyles.cell}>
                    {r[ci] ?? ""}
                  </Text>
                ))}
              </View>
            ))}
            {rows.length > 201 ? (
              <Text style={pdfStyles.meta}>Showing first 200 data rows.</Text>
            ) : null}
          </>
        )}
      </Page>
    </Document>
  );
};

export async function renderSchedulePdf(
  title: string,
  rows: string[][],
  chartPng?: Buffer | null
): Promise<Buffer> {
  registerPdfFonts();
  const exportedOn = new Date().toISOString().slice(0, 10);
  return renderToBuffer(
    createElement(SchedulePdfDocument, {
      title,
      exportedOn,
      rows,
      chartPng,
    }) as unknown as ReactElement<DocumentProps>
  );
}
