import { Page, StyleSheet, Text, View, Document } from "@react-pdf/renderer";
import { safeColor } from "./format";
import type {
  RoadmapDependencyLink,
  RoadmapExportRow,
  TimelineBar,
  TimelineTick,
} from "../../services/roadmap/roadmap-export";

export interface RoadmapPdfRow extends RoadmapExportRow {
  bar: TimelineBar | null;
}

export interface RoadmapPdfModel {
  projectName: string;
  exportedOn: string;
  groupingLabel: string;
  hasTimeline: boolean;
  ticks: TimelineTick[];
  todayLeft: number | null;
  rows: RoadmapPdfRow[];
  dependencies: RoadmapDependencyLink[];
}

const NAME_WIDTH = 168;
const META_WIDTH = 148;
const TIMELINE_WIDTH = 454;

const styles = StyleSheet.create({
  page: {
    fontFamily: "RoadmapSans",
    fontSize: 9,
    color: "#262626",
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
  },
  project: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 2,
  },
  meta: {
    fontSize: 9,
    color: "#595959",
    marginTop: 2,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 4,
    marginBottom: 6,
  },
  axisRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
    backgroundColor: "#f0f5ff",
    borderWidth: 1,
    borderColor: "#b0bec5",
    borderBottomWidth: 0,
  },
  nameHeader: {
    width: NAME_WIDTH,
    fontSize: 8,
    color: "#1d3557",
    fontWeight: 700,
    paddingLeft: 6,
    paddingVertical: 3,
    borderRightWidth: 1,
    borderRightColor: "#b0bec5",
  },
  metaHeader: {
    width: META_WIDTH,
    fontSize: 8,
    color: "#1d3557",
    fontWeight: 700,
    paddingLeft: 4,
    paddingVertical: 3,
    borderRightWidth: 1,
    borderRightColor: "#b0bec5",
  },
  timeline: {
    flex: 1,
    height: 14,
    position: "relative",
    paddingLeft: 4,
  },
  tick: {
    position: "absolute",
    top: 0,
    fontSize: 7,
    color: "#546e7a",
  },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 22,
    borderWidth: 1,
    borderColor: "#b0bec5",
    borderTopWidth: 0,
  },
  groupRow: {
    backgroundColor: "#e8eaf6",
  },
  nameCell: {
    width: NAME_WIDTH,
    justifyContent: "center",
    paddingLeft: 6,
    paddingRight: 4,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: "#b0bec5",
  },
  metaCell: {
    width: META_WIDTH,
    justifyContent: "center",
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: "#b0bec5",
  },
  name: {
    fontSize: 8,
  },
  groupName: {
    fontSize: 8,
    fontWeight: 700,
  },
  metaLine: {
    fontSize: 7,
    color: "#595959",
  },
  depLine: {
    fontSize: 7,
    color: "#0958d9",
    marginTop: 1,
  },
  barTrack: {
    flex: 1,
    minHeight: 22,
    position: "relative",
  },
  bar: {
    position: "absolute",
    top: 7,
    height: 8,
    borderRadius: 2,
  },
  barProgress: {
    height: 8,
    borderRadius: 2,
    backgroundColor: "#0958d9",
  },
  today: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "#ff4d4f",
  },
  empty: {
    marginTop: 12,
    color: "#8c8c8c",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#1890ff",
    borderWidth: 1,
    borderColor: "#1677ff",
  },
  tableHeaderCell: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: 700,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  tableRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d9d9d9",
    borderTopWidth: 0,
  },
  tableGroupRow: {
    backgroundColor: "#f5f5f5",
  },
  tableCell: {
    fontSize: 7,
    paddingVertical: 3,
    paddingHorizontal: 3,
  },
  footer: {
    position: "absolute",
    bottom: 14,
    left: 24,
    right: 24,
    fontSize: 8,
    color: "#8c8c8c",
    textAlign: "right",
  },
});

const DETAIL_COLUMNS: Array<{ key: keyof RoadmapExportRow | "type"; label: string; width: number }> = [
  { key: "group", label: "Group", width: 70 },
  { key: "type", label: "Type", width: 48 },
  { key: "name", label: "Name", width: 120 },
  { key: "startDate", label: "Start", width: 58 },
  { key: "endDate", label: "End", width: 58 },
  { key: "progress", label: "Progress", width: 42 },
  { key: "status", label: "Status", width: 56 },
  { key: "priority", label: "Priority", width: 48 },
  { key: "assignees", label: "Assignees", width: 90 },
  { key: "dependencies", label: "Dependencies", width: 100 },
  { key: "parent", label: "Parent", width: 70 },
];

const DEP_COLUMNS: Array<{ key: keyof RoadmapDependencyLink; label: string; width: number }> = [
  { key: "group", label: "Group", width: 100 },
  { key: "from", label: "Task", width: 180 },
  { key: "kind", label: "Type", width: 60 },
  { key: "to", label: "Depends on", width: 180 },
  { key: "relation", label: "Relation", width: 100 },
];

const isVeryLight = (hex: string): boolean => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return false;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.85;
};

const barColor = (row: RoadmapPdfRow): string => {
  if (row.kind === "subtask") return "#69b1ff";
  if (row.kind === "task") return "#1890ff";
  const color = safeColor(row.color, "#8c8c8c");
  return isVeryLight(color) ? "#8c8c8c" : color;
};

const indentFor = (kind: RoadmapPdfRow["kind"]): number => {
  if (kind === "subtask") return 16;
  if (kind === "task") return 8;
  return 0;
};

const clip = (value: string, max: number): string => {
  const chars = Array.from(value || "");
  return chars.length > max ? `${chars.slice(0, max - 3).join("")}...` : value || "";
};

const typeLabel = (kind: RoadmapPdfRow["kind"]): string => {
  if (kind === "group") return "Group";
  if (kind === "subtask") return "Subtask";
  return "Task";
};

const dateRange = (row: RoadmapPdfRow): string => {
  if (row.startDate && row.endDate) return `${row.startDate} - ${row.endDate}`;
  return row.startDate || row.endDate || "-";
};

const detailValue = (row: RoadmapPdfRow, key: (typeof DETAIL_COLUMNS)[number]["key"]): string => {
  if (key === "type") return typeLabel(row.kind);
  if (key === "progress") return row.progress == null ? "" : `${row.progress}%`;
  if (key === "startDate" || key === "endDate") return row[key] || "";
  return String(row[key] || "");
};

// Explicit text runs avoid renderer fallback producing incorrect glyph mappings
// when a line mixes several font subsets.
const PdfTextRuns = ({ text }: { text: string }) => {
  const runs: Array<{ font: string; text: string }> = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const font = ((code >= 0x3000 && code <= 0x30ff) || (code >= 0x3400 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af)) ? "DroidSansFallback"
      : code >= 0x0d80 && code <= 0x0dff ? "NotoSansSinhala"
      : code >= 0x0b80 && code <= 0x0bff ? "NotoSansTamil"
      : "RoadmapSans";
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text += char;
    else runs.push({ font, text: char });
  }
  return <>{runs.map((run, index) => <Text key={index} style={{ fontFamily: run.font }}>{run.text}</Text>)}</>;
};

// Explicit text runs avoid renderer fallback producing incorrect glyph mappings
// when a line mixes several font subsets.
const PdfTextRuns = ({ text }: { text: string }) => {
  const runs: Array<{ font: string; text: string }> = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const font = ((code >= 0x3000 && code <= 0x30ff) || (code >= 0x3400 && code <= 0x9fff) || (code >= 0xac00 && code <= 0xd7af)) ? "DroidSansFallback"
      : code >= 0x0d80 && code <= 0x0dff ? "NotoSansSinhala"
      : code >= 0x0b80 && code <= 0x0bff ? "NotoSansTamil"
      : "RoadmapSans";
    const last = runs[runs.length - 1];
    if (last?.font === font) last.text += char;
    else runs.push({ font, text: char });
  }
  return <>{runs.map((run, index) => <Text key={index} style={{ fontFamily: run.font }}>{run.text}</Text>)}</>;
};

interface RoadmapDocumentProps {
  model: RoadmapPdfModel;
}

export const RoadmapDocument = ({ model }: RoadmapDocumentProps) => (
  <Document title={`Roadmap - ${model.projectName}`} author="Worklenz">
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>Roadmap</Text>
      <Text style={styles.project}><PdfTextRuns text={model.projectName} /></Text>
      <Text style={styles.meta}>
        <PdfTextRuns text={`Grouped by ${model.groupingLabel}  ·  Exported ${model.exportedOn}`} />
      </Text>

    {model.hasTimeline ? (
      <View style={styles.axisRow}>
        <Text style={styles.nameHeader}>Name</Text>
        <Text style={styles.metaHeader}>Schedule / Status</Text>
        <View style={styles.timeline}>
          {model.ticks.map(tick => (
            <Text key={`${tick.label}-${tick.left}`} style={[styles.tick, { left: tick.left * TIMELINE_WIDTH }]}>
              {tick.label}
            </Text>
          ))}
          {model.todayLeft != null ? (
            <View style={[styles.today, { left: model.todayLeft * TIMELINE_WIDTH }]} />
          ) : null}
        </View>
      </View>
    ) : (
      <View style={styles.axisRow}>
        <Text style={styles.nameHeader}>Name</Text>
        <Text style={styles.metaHeader}>Schedule / Status</Text>
      </View>
    )}

    {model.rows.length === 0 ? (
      <Text style={styles.empty}>This roadmap has no phases or tasks to export.</Text>
    ) : (
      model.rows.map((row, index) => (
        <View
          key={`chart-${row.kind}-${index}-${row.name}`}
          style={row.kind === "group" ? [styles.row, styles.groupRow] : styles.row}
          wrap={false}
        >
          <View style={[styles.nameCell, { paddingLeft: indentFor(row.kind) }]}>
            <Text style={row.kind === "group" ? styles.groupName : styles.name}>
              <PdfTextRuns text={clip(row.name, row.kind === "group" ? 28 : 24)} />
            </Text>
            {row.kind !== "group" && row.dependencies ? (
              <Text style={styles.depLine}>
                <PdfTextRuns text={clip(`Depends: ${row.dependencies}`, 34)} />
              </Text>
            ) : null}
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLine}>
              <PdfTextRuns text={dateRange(row)} />
            </Text>
            <Text style={styles.metaLine}>
              <PdfTextRuns
                text={
                  [
                    row.progress != null ? `${row.progress}%` : null,
                    row.status || null,
                    row.priority || null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "-"
                }
              />
            </Text>
          </View>
          <View style={styles.barTrack}>
            {model.todayLeft != null ? (
              <View style={[styles.today, { left: model.todayLeft * TIMELINE_WIDTH }]} />
            ) : null}
            {row.bar ? (
              <View
                style={[
                  styles.bar,
                  {
                    left: row.bar.left * TIMELINE_WIDTH,
                    width: Math.max(3, row.bar.width * TIMELINE_WIDTH),
                    backgroundColor: barColor(row),
                  },
                ]}
              >
                {row.kind !== "group" && row.progress ? (
                  <View style={[styles.barProgress, { width: `${row.progress}%` }]} />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      ))
    )}

    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </Page>
);

const DetailsPage = ({ model }: RoadmapDocumentProps) => (
  <Page size="A4" orientation="landscape" style={styles.page} wrap>
    <Text style={styles.title}>Task details</Text>
    <Text style={styles.project}>{model.projectName}</Text>
    <Text style={styles.meta}>
      {`Grouped by ${model.groupingLabel}  ·  Exported ${model.exportedOn}`}
    </Text>

    <View style={styles.tableHeader} wrap={false}>
      {DETAIL_COLUMNS.map(column => (
        <Text key={column.key} style={[styles.tableHeaderCell, { width: column.width }]}>
          {column.label}
        </Text>
      ))}
    </View>

    {model.rows.length === 0 ? (
      <Text style={styles.empty}>No tasks to list.</Text>
    ) : (
      model.rows.map((row, index) => (
        <View
          key={`detail-${row.kind}-${index}-${row.name}`}
          style={row.kind === "group" ? [styles.tableRow, styles.tableGroupRow] : styles.tableRow}
          wrap={false}
        >
          {DETAIL_COLUMNS.map(column => (
            <Text
              key={column.key}
              style={[
                styles.tableCell,
                { width: column.width },
                row.kind === "group" ? { fontWeight: 700 } : {},
              ]}
            >
              <PdfTextRuns text={clip(detailValue(row, column.key), column.key === "name" ? 28 : 22)} />
            </Text>
          ))}
        </View>
      ))
    )}

      {model.rows.length === 0 ? (
        <Text style={styles.empty}>This roadmap has no phases or tasks to export.</Text>
      ) : (
        model.rows.map((row, index) => (
          <View
            key={`${row.kind}-${index}-${row.name}`}
            style={row.kind === "group" ? [styles.row, styles.groupRow] : styles.row}
            wrap={false}
          >
            <View style={[styles.nameCell, { paddingLeft: indentFor(row.kind) }]}>
              <Text style={row.kind === "group" ? styles.groupName : styles.name}>
                <PdfTextRuns text={clipName(row.name, row.kind)} />
              </Text>
            </View>
            <View style={styles.barTrack}>
              {model.todayLeft != null ? (
                <View style={[styles.today, { left: model.todayLeft * TIMELINE_WIDTH }]} />
              ) : null}
              {row.bar ? (
                <View
                  style={[
                    styles.bar,
                    {
                      left: row.bar.left * TIMELINE_WIDTH,
                      width: Math.max(3, row.bar.width * TIMELINE_WIDTH),
                      backgroundColor: barColor(row),
                    },
                  ]}
                >
                  {row.kind !== "group" && row.progress ? (
                    <View style={[styles.barProgress, { width: `${row.progress}%` }]} />
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}

    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
    />
  </Page>
);

export const RoadmapDocument = ({ model }: RoadmapDocumentProps) => (
  <Document title={`Roadmap - ${model.projectName}`} author="Worklenz">
    <ChartPage model={model} />
    <DetailsPage model={model} />
    <DependenciesPage model={model} />
  </Document>
);
