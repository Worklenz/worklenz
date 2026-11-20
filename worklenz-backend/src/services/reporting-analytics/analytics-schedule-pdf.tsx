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

export interface SchedulePdfKpiTile {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}

export interface RenderSchedulePdfOptions {
  title: string;
  rows: string[][];
  chartPngs?: Buffer[] | Buffer | null;
  /** Pre-fetched PNG/JPEG logo bytes (org logo or Worklenz default). */
  logo?: Buffer | null;
  kpis?: SchedulePdfKpiTile[];
  footerNote?: string;
  exportedOn?: string;
}

const TONES = {
  primary: "#1890ff",
  success: "#52c41a",
  warn: "#faad14",
  purple: "#722ed1",
  muted: "#8c8c8c",
};

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: "NotoSans",
    fontSize: 9,
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 48,
    color: "#262626",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 12,
  },
  // Match navbar logo: height 26, maxWidth 140 (NavbarLogo.tsx).
  logo: {
    width: 140,
    height: 26,
    objectFit: "contain",
    marginRight: 12,
  },
  titleBlock: {
    flexGrow: 1,
    flexShrink: 1,
  },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 2, color: "#262626" },
  meta: { fontSize: 9, color: "#595959" },
  headerRight: {
    alignItems: "flex-end",
  },
  brandAccent: {
    width: 36,
    height: 3,
    backgroundColor: TONES.primary,
    marginBottom: 6,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 4,
    color: "#262626",
  },
  kpiSection: {
    marginBottom: 16,
  },
  kpiRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: 0,
    marginRight: 12,
    height: 88,
    position: "relative",
  },
  kpiCardLast: {
    marginRight: 0,
  },
  // Absolute fill — flexGrow card Views often skip backgroundColor in @react-pdf.
  kpiCardBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#f4f5f6",
    borderWidth: 1.5,
    borderColor: "#d9d9d9",
    borderRadius: 10,
  },
  kpiCardBody: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    paddingRight: 12,
  },
  kpiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  kpiLabel: {
    fontSize: 12,
    color: "#595959",
    fontWeight: 600,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  kpiSub: {
    fontSize: 8,
    color: "#8c8c8c",
  },
  summaryAndCharts: {
    marginBottom: 4,
  },
  chartsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  chart: { marginBottom: 10, objectFit: "contain" },
  chartSlotBar: {
    width: "74%",
    marginRight: "2%",
    alignItems: "center",
    justifyContent: "center",
  },
  chartSlotDonut: {
    width: "24%",
    alignItems: "center",
    justifyContent: "center",
  },
  tableBlock: { marginTop: 4 },
  tableFrame: {
    borderWidth: 1.25,
    borderColor: "#8c8c8c",
    borderRadius: 2,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#bfbfbf",
  },
  headerRow: {
    backgroundColor: "#f0f1f3",
    fontWeight: 700,
    borderBottomWidth: 1.25,
    borderBottomColor: "#8c8c8c",
    minHeight: 28,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8,
    borderRightWidth: 1.25,
    borderRightColor: "#8c8c8c",
  },
  headerCell: {
    fontSize: 10,
    fontWeight: 700,
    paddingVertical: 10,
  },
  cellLast: {
    borderRightWidth: 0,
  },
  empty: { marginTop: 12, color: "#8c8c8c" },
  truncated: { marginTop: 8, fontSize: 8, color: "#595959" },
  tableContinues: { fontSize: 8, color: "#8c8c8c", marginBottom: 6 },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 0.75,
    borderTopColor: "#eeeeee",
  },
  footerText: {
    fontSize: 8,
    color: "#8c8c8c",
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 12,
  },
  pageNumber: {
    fontSize: 8,
    color: "#8c8c8c",
  },
});

interface SchedulePdfProps {
  title: string;
  exportedOn: string;
  rows: string[][];
  chartPngs?: Buffer[];
  logo?: Buffer | null;
  kpis?: SchedulePdfKpiTile[];
  footerNote?: string;
}

interface ScheduleTableProps {
  header: string[];
  body: string[][];
  truncated: boolean;
}

function logoSrc(logo: Buffer | null | undefined): string | null {
  if (!logo?.length) return null;
  const isJpeg = logo.length > 3 && logo[0] === 0xff && logo[1] === 0xd8 && logo[2] === 0xff;
  const mime = isJpeg ? "image/jpeg" : "image/png";
  return `data:${mime};base64,${logo.toString("base64")}`;
}

/** Read PNG pixel size from bytes (no decode). */
function readPngPixelSize(buf: Buffer): { width: number; height: number } | null {
  if (
    buf.length < 24 ||
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

/** Fit image into a box without stretching (keeps chart fonts sharp). */
function fitContainedSize(
  pxW: number,
  pxH: number,
  boxW: number,
  boxH: number
): { width: number; height: number } {
  const ratio = pxW / Math.max(pxH, 1);
  let width = boxW;
  let height = width / ratio;
  if (height > boxH) {
    height = boxH;
    width = height * ratio;
  }
  return { width, height };
}

const ScheduleHeader = ({
  title,
  exportedOn,
  logo,
}: {
  title: string;
  exportedOn: string;
  logo?: Buffer | null;
}) => {
  const src = logoSrc(logo);
  return (
    <View style={pdfStyles.header}>
      <View style={pdfStyles.headerLeft}>
        {src ? <Image src={src} style={pdfStyles.logo} /> : null}
        <View style={pdfStyles.titleBlock}>
          <Text style={pdfStyles.title}>{title}</Text>
          <Text style={pdfStyles.meta}>Live export · {exportedOn}</Text>
        </View>
      </View>
      <View style={pdfStyles.headerRight}>
        <View style={pdfStyles.brandAccent} />
        <Text style={pdfStyles.meta}>Worklenz Analytics</Text>
      </View>
    </View>
  );
};

const ScheduleFooter = ({
  title,
  exportedOn,
  footerNote,
}: {
  title: string;
  exportedOn: string;
  footerNote?: string;
}) => {
  const note =
    footerNote?.trim() ||
    `Auto-generated by Worklenz · ${exportedOn} · ${title}`;
  return (
    <View style={pdfStyles.footer} fixed>
      <Text style={pdfStyles.footerText}>{note}</Text>
      <Text
        style={pdfStyles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
};

const KpiCards = ({ kpis }: { kpis: SchedulePdfKpiTile[] }) => {
  if (!kpis.length) return null;
  const tiles = kpis.slice(0, 6);
  return (
    <View style={pdfStyles.kpiSection} wrap={false}>
      <Text style={pdfStyles.sectionTitle}>Summary</Text>
      <View style={pdfStyles.kpiRow}>
        {tiles.map((kpi, index) => {
          const tone = kpi.tone || TONES.primary;
          const isLast = index === tiles.length - 1;
          return (
            <View
              key={`kpi-${index}`}
              style={isLast ? [pdfStyles.kpiCard, pdfStyles.kpiCardLast] : pdfStyles.kpiCard}
            >
              <View style={pdfStyles.kpiCardBg} />
              <View style={pdfStyles.kpiCardBody}>
                <View style={pdfStyles.kpiLabelRow}>
                  <View style={[pdfStyles.kpiDot, { backgroundColor: tone }]} />
                  <Text style={pdfStyles.kpiLabel}>{kpi.label}</Text>
                </View>
                <Text style={[pdfStyles.kpiValue, { color: tone }]}>{kpi.value}</Text>
                {kpi.sub ? <Text style={pdfStyles.kpiSub}>{kpi.sub}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const TableHeaderRow = ({ header }: { header: string[] }) => (
  <View style={[pdfStyles.row, pdfStyles.headerRow]} wrap={false}>
    {header.map((cell, i) => (
      <Text
        key={`h-${i}`}
        style={
          i === header.length - 1
            ? [pdfStyles.cell, pdfStyles.headerCell, pdfStyles.cellLast]
            : [pdfStyles.cell, pdfStyles.headerCell]
        }
      >
        {decodeCell(cell)}
      </Text>
    ))}
  </View>
);

/**
 * Data table: single in-flow column header above data rows.
 * (A fixed `pageNumber > 1` repeat header doubled on the table page because
 * KPIs/charts already occupy document page 1.)
 */
const ScheduleTable = ({ header, body, truncated }: ScheduleTableProps) => {
  if (header.length === 0 && body.length === 0) {
    return <Text style={pdfStyles.empty}>No rows for the saved filters.</Text>;
  }

  return (
    <View style={pdfStyles.tableBlock}>
      <Text style={pdfStyles.sectionTitle}>Table</Text>
      <Text style={pdfStyles.tableContinues}>
        Report data ({body.length} row{body.length === 1 ? "" : "s"})
      </Text>
      <View style={pdfStyles.tableFrame}>
        <TableHeaderRow header={header} />
        {body.map((r, ri) => (
          <View
            key={`r-${ri}`}
            style={
              ri === body.length - 1
                ? [pdfStyles.row, { borderBottomWidth: 0 }]
                : pdfStyles.row
            }
            wrap={false}
          >
            {header.map((_, ci) => (
              <Text
                key={`c-${ri}-${ci}`}
                style={
                  ci === header.length - 1
                    ? [pdfStyles.cell, pdfStyles.cellLast]
                    : pdfStyles.cell
                }
              >
                {decodeCell(r[ci] ?? "")}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {truncated ? (
        <Text style={pdfStyles.truncated}>Showing first 200 data rows.</Text>
      ) : null}
    </View>
  );
};

const SchedulePdfDocument = ({
  title,
  exportedOn,
  rows,
  chartPngs = [],
  logo = null,
  kpis = [],
  footerNote,
}: SchedulePdfProps) => {
  const header = rows[0] || [];
  const body = rows.slice(1, 201);
  const truncated = rows.length > 201;
  const chartBuffers = chartPngs.filter(buf => !!buf?.length);
  const charts = chartBuffers.map(buf => `data:image/png;base64,${buf.toString("base64")}`);
  const hasCharts = charts.length > 0;
  const isSideBySideCharts = charts.length === 2;

  // Landscape content width ≈ A4 landscape minus horizontal padding (28×2).
  const pageContentW = 841.89 - 56;
  const chartRowH = 200;
  const singleChartH = 180;

  const chartsBlock = !hasCharts ? null : isSideBySideCharts ? (
    <View style={pdfStyles.chartsRow}>
      {(() => {
        const barPx = readPngPixelSize(chartBuffers[0]) || { width: 1160, height: 400 };
        const donutPx = readPngPixelSize(chartBuffers[1]) || { width: 480, height: 480 };
        const barBoxW = pageContentW * 0.74;
        const donutBoxW = pageContentW * 0.24;
        const barSize = fitContainedSize(barPx.width, barPx.height, barBoxW, chartRowH);
        const donutSize = fitContainedSize(donutPx.width, donutPx.height, donutBoxW, chartRowH);
        return (
          <>
            <View style={pdfStyles.chartSlotBar}>
              <Image
                src={charts[0]}
                style={{ width: barSize.width, height: barSize.height, objectFit: "contain" }}
              />
            </View>
            <View style={pdfStyles.chartSlotDonut}>
              <Image
                src={charts[1]}
                style={{
                  width: donutSize.width,
                  height: donutSize.height,
                  objectFit: "contain",
                }}
              />
            </View>
          </>
        );
      })()}
    </View>
  ) : (
    <View>
      {charts.map((src, index) => {
        const px = readPngPixelSize(chartBuffers[index]) || {
          width: 960,
          height: 420,
        };
        const size = fitContainedSize(px.width, px.height, pageContentW, singleChartH);
        return (
          <Image
            key={`chart-${index}`}
            src={src}
            style={[pdfStyles.chart, { width: size.width, height: size.height }]}
          />
        );
      })}
    </View>
  );

  // Page 1: branding + KPI cards + charts (side-by-side when bar + donut).
  // Page 2+: table with column header always above data rows (repeats on wrap).
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page} wrap>
        <ScheduleHeader title={title} exportedOn={exportedOn} logo={logo} />
        <ScheduleFooter title={title} exportedOn={exportedOn} footerNote={footerNote} />
        <View style={pdfStyles.summaryAndCharts} wrap={false}>
          <KpiCards kpis={kpis} />
          {chartsBlock}
        </View>
      </Page>
      <Page size="A4" orientation="landscape" style={pdfStyles.page} wrap>
        <ScheduleHeader title={title} exportedOn={exportedOn} logo={logo} />
        <ScheduleFooter title={title} exportedOn={exportedOn} footerNote={footerNote} />
        <ScheduleTable header={header} body={body} truncated={truncated} />
      </Page>
    </Document>
  );
};

export async function renderSchedulePdf(
  titleOrOptions: string | RenderSchedulePdfOptions,
  rowsArg?: string[][],
  chartPngsArg?: Buffer[] | Buffer | null
): Promise<Buffer> {
  registerPdfFonts();

  const options: RenderSchedulePdfOptions =
    typeof titleOrOptions === "string"
      ? {
          title: titleOrOptions,
          rows: rowsArg || [],
          chartPngs: chartPngsArg,
        }
      : titleOrOptions;

  const exportedOn = options.exportedOn || new Date().toISOString().slice(0, 10);
  const normalized = Array.isArray(options.chartPngs)
    ? options.chartPngs
    : options.chartPngs
      ? [options.chartPngs]
      : [];

  return renderToBuffer(
    createElement(SchedulePdfDocument, {
      title: options.title,
      exportedOn,
      rows: options.rows,
      chartPngs: normalized,
      logo: options.logo ?? null,
      kpis: options.kpis ?? [],
      footerNote: options.footerNote,
    }) as unknown as ReactElement<DocumentProps>
  );
}
