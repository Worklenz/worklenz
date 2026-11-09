import { Page, StyleSheet, Text, View, Document } from "@react-pdf/renderer";
import { PDF_FONT_FAMILY } from "./fonts";
import { safeColor } from "./format";
import type { RoadmapExportRow, TimelineBar, TimelineTick } from "../../services/roadmap/roadmap-export";

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
}

const NAME_WIDTH = 210;
const TIMELINE_WIDTH = 560;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
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
  axisRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
    backgroundColor: "#f0f5ff",
    borderWidth: 1,
    borderColor: "#b0bec5",
    borderBottomWidth: 0,          // bottom drawn by first data row
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
    alignItems: "center",
    minHeight: 18,
    borderWidth: 1,
    borderColor: "#b0bec5",
    borderTopWidth: 0,             // collapse with row above
  },
  groupRow: {
    backgroundColor: "#e8eaf6",
  },
  nameCell: {
    width: NAME_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 2,
    borderRightWidth: 1,
    borderRightColor: "#b0bec5",
    minHeight: 18,
  },
  name: {
    flex: 1,
    fontSize: 8,
  },
  groupName: {
    flex: 1,
    fontSize: 8,
    fontWeight: 700,
  },
  barTrack: {
    flex: 1,
    height: 18,
    position: "relative",
  },
  bar: {
    position: "absolute",
    top: 5,
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

const clipName = (value: string, kind: RoadmapPdfRow["kind"]): string => {
  const max = kind === "group" ? 34 : kind === "task" ? 30 : 26;
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
};

interface RoadmapDocumentProps {
  model: RoadmapPdfModel;
}

export const RoadmapDocument = ({ model }: RoadmapDocumentProps) => (
  <Document title={`Roadmap - ${model.projectName}`} author="Worklenz">
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={styles.title}>Roadmap</Text>
      <Text style={styles.project}>{model.projectName}</Text>
      <Text style={styles.meta}>
        {`Grouped by ${model.groupingLabel}  ·  Exported ${model.exportedOn}`}
      </Text>

      {model.hasTimeline ? (
        <View style={styles.axisRow}>
          <Text style={styles.nameHeader}>Name</Text>
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
        </View>
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
                {clipName(row.name, row.kind)}
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
  </Document>
);
