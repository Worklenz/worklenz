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

/** True for numeric table values (counts, %, currency, "+3 days") — body cells only. */
export function isNumericCellValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^[+-]?\d+(\.\d+)?\s+days$/i.test(trimmed)) return true;
  const normalized = trimmed.replace(/[,\s]/g, "");
  return /^-?\$?\(?\d+(\.\d+)?\)?%?$/.test(normalized);
}

/** Columns whose body values are numeric (right-aligned like the on-demand export PDF). */
export function detectNumericColumns(header: string[], body: string[][]): boolean[] {
  return header.map((_, ci) =>
    body.some(row => isNumericCellValue(decodeCell(row[ci] ?? "")))
  );
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
  /** Topic above each chart PNG (e.g. "Progress & budget", "Health status"). */
  chartTitles?: string[] | null;
  /**
   * Optional hex text colors matching `rows` (null = default).
   * Used for tinted numeric/status cells (variance, utilization, burn, etc.).
   */
  tableCellColors?: Array<Array<string | null>> | null;
  /** Pre-fetched PNG/JPEG logo bytes (org logo or Worklenz default). */
  logo?: Buffer | null;
  kpis?: SchedulePdfKpiTile[];
  /** Compact filter summary shown under the report title. */
  filterDetails?: string | null;
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
  filterDetails: {
    fontSize: 8,
    color: "#595959",
    marginTop: 2,
    maxWidth: 520,
  },
  filterLabel: {
    fontWeight: 700,
    color: "#434343",
  },
  filterValue: {
    fontWeight: 400,
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
  /** Match reporting ChartTableWrapper card: clearer border + radius + padding. */
  chartCard: {
    borderWidth: 1.25,
    borderColor: "#bfbfbf",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#ffffff",
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  chartTopic: {
    fontSize: 11,
    fontWeight: 700,
    color: "#262626",
    marginBottom: 8,
    alignSelf: "flex-start",
    width: "100%",
  },
  chartsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 10,
  },
  chart: { objectFit: "contain" },
  chartSlotBar: {
    width: "74%",
    marginRight: "2%",
  },
  chartSlotDonut: {
    width: "24%",
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
    justifyContent: "center",
  },
  headerCell: {
    paddingVertical: 10,
  },
  cellLast: {
    borderRightWidth: 0,
  },
  cellText: {
    width: "100%",
    fontSize: 8,
  },
  headerCellText: {
    width: "100%",
    fontSize: 10,
    fontWeight: 700,
  },
  cellTextRight: {
    textAlign: "right",
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
  chartTitles?: string[];
  tableCellColors?: Array<Array<string | null>>;
  logo?: Buffer | null;
  kpis?: SchedulePdfKpiTile[];
  filterDetails?: string | null;
  footerNote?: string;
}

interface ScheduleTableProps {
  header: string[];
  body: string[][];
  truncated: boolean;
  /** Body-aligned colors (index 0 = first data row). */
  bodyCellColors?: Array<Array<string | null>>;
  /** Total data rows across all table pages (for the caption). */
  totalRowCount?: number;
  /** Show the "Table" section title (first table page only). */
  showSectionTitle?: boolean;
  /** Precomputed numeric column flags (from the full table body). */
  numericColumns?: boolean[];
}

/**
 * Landscape A4 usable height is tight once branding + column header are included.
 * Keep this conservative so each Page fits without react-pdf splitting mid-table
 * (which would drop the column header on the overflow page).
 */
export const TABLE_ROWS_PER_PAGE = 12;

export function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages;
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

/** Split "Label: value · Label: value" into parts for bold labels. */
function parseFilterDetailParts(
  details: string
): Array<{ label: string; value: string }> {
  return details
    .split(" · ")
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const idx = part.indexOf(": ");
      if (idx <= 0) return { label: "", value: part };
      return { label: part.slice(0, idx), value: part.slice(idx + 2) };
    });
}

const ScheduleHeader = ({
  title,
  logo,
  filterDetails,
}: {
  title: string;
  logo?: Buffer | null;
  filterDetails?: string | null;
}) => {
  const src = logoSrc(logo);
  const filterParts = filterDetails?.trim()
    ? parseFilterDetailParts(filterDetails.trim())
    : [];
  return (
    <View style={pdfStyles.header}>
      <View style={pdfStyles.headerLeft}>
        {src ? <Image src={src} style={pdfStyles.logo} /> : null}
        <View style={pdfStyles.titleBlock}>
          <Text style={pdfStyles.title}>{title}</Text>
          {filterParts.length > 0 ? (
            <Text style={pdfStyles.filterDetails}>
              {filterParts.map((part, index) => (
                <Text key={`${part.label}-${index}`}>
                  {index > 0 ? " · " : ""}
                  {part.label ? (
                    <Text style={pdfStyles.filterLabel}>{part.label}: </Text>
                  ) : null}
                  <Text style={pdfStyles.filterValue}>{part.value}</Text>
                </Text>
              ))}
            </Text>
          ) : null}
        </View>
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

const TableHeaderRow = ({
  header,
  numericColumns = [],
}: {
  header: string[];
  numericColumns?: boolean[];
}) => (
  <View style={[pdfStyles.row, pdfStyles.headerRow]} wrap={false}>
    {header.map((cell, i) => {
      const isNumeric = !!numericColumns[i];
      const cellStyles = [
        pdfStyles.cell,
        pdfStyles.headerCell,
        ...(i === header.length - 1 ? [pdfStyles.cellLast] : []),
      ];
      const textStyles = [
        pdfStyles.headerCellText,
        ...(isNumeric ? [pdfStyles.cellTextRight] : []),
      ];
      return (
        <View key={`h-${i}`} style={cellStyles}>
          <Text style={textStyles}>{decodeCell(cell)}</Text>
        </View>
      );
    })}
  </View>
);

/**
 * Data table for one PDF page. Column headers are in-flow on every table page
 * (pages are chunked so react-pdf does not wrap mid-table without a header).
 */
const ScheduleTable = ({
  header,
  body,
  truncated,
  bodyCellColors = [],
  totalRowCount,
  showSectionTitle = true,
  numericColumns: numericColumnsProp,
}: ScheduleTableProps) => {
  if (header.length === 0 && body.length === 0) {
    return <Text style={pdfStyles.empty}>No rows for the saved filters.</Text>;
  }

  const rowCount = totalRowCount ?? body.length;
  const numericColumns =
    numericColumnsProp ?? detectNumericColumns(header, body);

  return (
    <View style={pdfStyles.tableBlock}>
      {showSectionTitle ? <Text style={pdfStyles.sectionTitle}>Table</Text> : null}
      <Text style={pdfStyles.tableContinues}>
        Report data ({rowCount} row{rowCount === 1 ? "" : "s"})
      </Text>
      <View style={pdfStyles.tableFrame}>
        <TableHeaderRow header={header} numericColumns={numericColumns} />
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
            {header.map((_, ci) => {
              const text = decodeCell(r[ci] ?? "");
              const color = bodyCellColors[ri]?.[ci] || undefined;
              const isNumeric = numericColumns[ci] || isNumericCellValue(text);
              const cellStyles = [
                pdfStyles.cell,
                ...(ci === header.length - 1 ? [pdfStyles.cellLast] : []),
              ];
              const textStyles = [
                pdfStyles.cellText,
                ...(isNumeric ? [pdfStyles.cellTextRight] : []),
                ...(color ? [{ color }] : []),
              ];
              return (
                <View key={`c-${ri}-${ci}`} style={cellStyles}>
                  <Text style={textStyles}>{text}</Text>
                </View>
              );
            })}
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
  chartTitles = [],
  tableCellColors = [],
  logo = null,
  kpis = [],
  filterDetails = null,
  footerNote,
}: SchedulePdfProps) => {
  const header = rows[0] || [];
  const body = rows.slice(1, 201);
  const truncated = rows.length > 201;
  // Skip header color row; align with truncated body.
  const bodyCellColors = (tableCellColors || []).slice(1, 201);
  const chartBuffers = chartPngs.filter(buf => !!buf?.length);
  const charts = chartBuffers.map(buf => `data:image/png;base64,${buf.toString("base64")}`);
  const hasCharts = charts.length > 0;
  const isSideBySideCharts = charts.length === 2;
  const topics = chartTitles || [];
  const primaryTopic = topics[0] || title;
  const secondaryTopic = topics[1] || "";

  // Landscape content width ≈ A4 landscape minus horizontal padding (28×2) and card padding.
  const pageContentW = 841.89 - 56;
  const chartInnerW = pageContentW - 24;
  const chartRowH = 180;
  const singleChartH = 170;

  const chartsBlock = !hasCharts ? null : isSideBySideCharts ? (
    <View style={pdfStyles.chartsRow} wrap={false}>
      {(() => {
        const barPx = readPngPixelSize(chartBuffers[0]) || { width: 1160, height: 400 };
        const donutPx = readPngPixelSize(chartBuffers[1]) || { width: 480, height: 480 };
        const barBoxW = chartInnerW * 0.74;
        const donutBoxW = chartInnerW * 0.24;
        const barSize = fitContainedSize(barPx.width, barPx.height, barBoxW, chartRowH);
        const donutSize = fitContainedSize(
          donutPx.width,
          donutPx.height,
          donutBoxW,
          chartRowH
        );
        return (
          <>
            <View style={[pdfStyles.chartSlotBar, pdfStyles.chartCard, { marginBottom: 0 }]}>
              {primaryTopic ? <Text style={pdfStyles.chartTopic}>{primaryTopic}</Text> : null}
              <Image
                src={charts[0]}
                style={{
                  width: barSize.width,
                  height: barSize.height,
                  objectFit: "contain",
                }}
              />
            </View>
            <View style={[pdfStyles.chartSlotDonut, pdfStyles.chartCard, { marginBottom: 0 }]}>
              {secondaryTopic ? (
                <Text style={pdfStyles.chartTopic}>{secondaryTopic}</Text>
              ) : null}
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
    <View style={pdfStyles.chartCard} wrap={false}>
      {primaryTopic ? <Text style={pdfStyles.chartTopic}>{primaryTopic}</Text> : null}
      {charts.map((src, index) => {
        const px = readPngPixelSize(chartBuffers[index]) || {
          width: 960,
          height: 420,
        };
        const size = fitContainedSize(px.width, px.height, chartInnerW, singleChartH);
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
  // Page 2+: one table chunk per page so the column header row is on every page.
  const tableChunks = chunkRows(body, TABLE_ROWS_PER_PAGE);
  const colorChunks = chunkRows(bodyCellColors, TABLE_ROWS_PER_PAGE);
  const numericColumns = detectNumericColumns(header, body);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page} wrap>
        <ScheduleHeader title={title} logo={logo} filterDetails={filterDetails} />
        <ScheduleFooter title={title} exportedOn={exportedOn} footerNote={footerNote} />
        <View style={pdfStyles.summaryAndCharts} wrap={false}>
          <KpiCards kpis={kpis} />
          {chartsBlock}
        </View>
      </Page>
      {tableChunks.map((pageRows, pageIndex) => (
        <Page
          key={`table-page-${pageIndex}`}
          size="A4"
          orientation="landscape"
          style={pdfStyles.page}
          wrap={false}
        >
          <ScheduleHeader title={title} logo={logo} filterDetails={filterDetails} />
          <ScheduleFooter title={title} exportedOn={exportedOn} footerNote={footerNote} />
          <ScheduleTable
            header={header}
            body={pageRows}
            truncated={truncated && pageIndex === tableChunks.length - 1}
            bodyCellColors={colorChunks[pageIndex] || []}
            totalRowCount={body.length}
            showSectionTitle={pageIndex === 0}
            numericColumns={numericColumns}
          />
        </Page>
      ))}
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
      chartTitles: options.chartTitles ?? [],
      tableCellColors: options.tableCellColors ?? [],
      logo: options.logo ?? null,
      kpis: options.kpis ?? [],
      filterDetails: options.filterDetails ?? null,
      footerNote: options.footerNote,
    }) as unknown as ReactElement<DocumentProps>
  );
}
