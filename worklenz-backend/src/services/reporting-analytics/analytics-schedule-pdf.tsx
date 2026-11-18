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
import { decodeHtmlEntities } from "../../shared/html-entity-utils";

function decodeCell(value: string): string {
  let text = value ?? "";
  for (let i = 0; i < 3; i++) {
    const next = decodeHtmlEntities(text);
    if (next === text) break;
    text = next;
  }
  return text;
}

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
  chart: { width: "100%", height: 200, marginBottom: 12, objectFit: "contain" },
  chartCompact: { width: "55%", height: 180, marginBottom: 12, objectFit: "contain" },
  tableBlock: { marginTop: 0 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#d9d9d9" },
  header: {
    backgroundColor: "#f5f5f5",
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: "#bfbfbf",
  },
  cell: { flexGrow: 1, flexBasis: 0, padding: 4, fontSize: 8 },
  empty: { marginTop: 12, color: "#8c8c8c" },
});

interface SchedulePdfProps {
  title: string;
  exportedOn: string;
  rows: string[][];
  chartPngs?: Buffer[];
}

interface ScheduleTableProps {
  header: string[];
  body: string[][];
  truncated: boolean;
}

/** Table with a fixed header so column labels repeat on every continued page. */
const ScheduleTable = ({ header, body, truncated }: ScheduleTableProps) => {
  if (header.length === 0 && body.length === 0) {
    return <Text style={pdfStyles.empty}>No rows for the saved filters.</Text>;
  }

  return (
    <View style={pdfStyles.tableBlock}>
      <Text style={pdfStyles.sectionTitle}>Table</Text>
      <View style={[pdfStyles.row, pdfStyles.header]} fixed wrap={false}>
        {header.map((cell, i) => (
          <Text key={`h-${i}`} style={pdfStyles.cell}>
            {decodeCell(cell)}
          </Text>
        ))}
      </View>
      {body.map((r, ri) => (
        <View key={`r-${ri}`} style={pdfStyles.row} wrap={false}>
          {header.map((_, ci) => (
            <Text key={`c-${ri}-${ci}`} style={pdfStyles.cell}>
              {decodeCell(r[ci] ?? "")}
            </Text>
          ))}
        </View>
      ))}
      {truncated ? (
        <Text style={pdfStyles.meta}>Showing first 200 data rows.</Text>
      ) : null}
    </View>
  );
};

const SchedulePdfDocument = ({
  title,
  exportedOn,
  rows,
  chartPngs = [],
}: SchedulePdfProps) => {
  const header = rows[0] || [];
  const body = rows.slice(1, 201);
  const truncated = rows.length > 201;
  const colCount = Math.max(header.length, 1);
  const charts = chartPngs
    .filter(buf => buf?.length)
    .map(buf => `data:image/png;base64,${buf.toString("base64")}`);
  const orientation = colCount > 6 || charts.length > 0 ? "landscape" : "portrait";
  const hasCharts = charts.length > 0;

  const titleBlock = (
    <>
      <Text style={pdfStyles.title}>{title}</Text>
      <Text style={pdfStyles.meta}>Live export · {exportedOn}</Text>
    </>
  );

  const chartsBlock = hasCharts ? (
    <>
      <Text style={pdfStyles.sectionTitle}>
        {charts.length > 1 ? "Charts" : "Chart"}
      </Text>
      {charts.map((src, index) => (
        <Image
          key={`chart-${index}`}
          src={src}
          style={
            charts.length > 1 && index === charts.length - 1
              ? pdfStyles.chartCompact
              : pdfStyles.chart
          }
        />
      ))}
    </>
  ) : null;

  // Charts alone on page 1; table starts on the next page with repeating headers.
  if (hasCharts) {
    return (
      <Document>
        <Page size="A4" orientation={orientation} style={pdfStyles.page}>
          {titleBlock}
          {chartsBlock}
        </Page>
        <Page size="A4" orientation={orientation} style={pdfStyles.page}>
          <ScheduleTable header={header} body={body} truncated={truncated} />
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={pdfStyles.page}>
        {titleBlock}
        <ScheduleTable header={header} body={body} truncated={truncated} />
      </Page>
    </Document>
  );
};

export async function renderSchedulePdf(
  title: string,
  rows: string[][],
  chartPngs?: Buffer[] | Buffer | null
): Promise<Buffer> {
  registerPdfFonts();
  const exportedOn = new Date().toISOString().slice(0, 10);
  const normalized = Array.isArray(chartPngs)
    ? chartPngs
    : chartPngs
      ? [chartPngs]
      : [];
  return renderToBuffer(
    createElement(SchedulePdfDocument, {
      title,
      exportedOn,
      rows,
      chartPngs: normalized,
    }) as unknown as ReactElement<DocumentProps>
  );
}
