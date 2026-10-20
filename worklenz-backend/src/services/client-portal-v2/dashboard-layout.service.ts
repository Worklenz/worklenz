import { badRequest } from "./errors";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";

/** Bumped when the stored shape changes, so the app can discard layouts it cannot read. */
export const DASHBOARD_LAYOUT_VERSION = 1;

export const DASHBOARD_WIDGET_TYPES = [
  "tile-active-projects",
  "tile-pending-actions",
  "tile-upcoming-milestones",
  "tile-unpaid",
  "needs-action",
  "upcoming-milestones",
  "projects",
  "recent-activity",
  "chart-projects-by-status",
  "chart-project-progress",
  "chart-open-items",
] as const;
export type DashboardWidgetType = (typeof DASHBOARD_WIDGET_TYPES)[number];

export const PROJECT_CARD_FIELDS = [
  "status",
  "progress",
  "phase",
  "nextMilestone",
  "expectedCompletion",
  "openItems",
  "sharedCounts",
] as const;
type ProjectCardField = (typeof PROJECT_CARD_FIELDS)[number];

export interface ProjectsWidgetSettings {
  projectIds: string[] | "all";
  cardFields: ProjectCardField[];
  view: "cards" | "compact";
}

export interface DashboardWidgetInstance {
  type: DashboardWidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  settings?: ProjectsWidgetSettings;
}

export interface DashboardLayout {
  version: number;
  widgets: DashboardWidgetInstance[];
}

export interface DashboardLayoutView {
  /** null when the user never customised: the app renders its default layout. */
  layout: DashboardLayout | null;
}

const GRID_COLS = 12;
const MAX_WIDGETS = 30;
const MAX_ROW = 10_000;
const MAX_HEIGHT = 60;
const MAX_PROJECT_IDS = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalid = (message: string) => badRequest(message, "INVALID_LAYOUT");
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const isWidgetType = (value: unknown): value is DashboardWidgetType =>
  typeof value === "string" && (DASHBOARD_WIDGET_TYPES as readonly string[]).includes(value);

function validateProjectsSettings(input: unknown): ProjectsWidgetSettings {
  const raw = input as Partial<ProjectsWidgetSettings> | null;
  if (!raw || typeof raw !== "object") throw invalid("projects widget settings are missing");

  let projectIds: ProjectsWidgetSettings["projectIds"];
  if (raw.projectIds === "all") {
    projectIds = "all";
  } else if (Array.isArray(raw.projectIds)) {
    if (raw.projectIds.length > MAX_PROJECT_IDS) throw invalid("too many projects selected");
    if (!raw.projectIds.every((id) => typeof id === "string" && UUID_RE.test(id))) {
      throw invalid("projectIds must be project ids");
    }
    projectIds = Array.from(new Set(raw.projectIds));
  } else {
    throw invalid("projectIds must be 'all' or a list of project ids");
  }

  if (!Array.isArray(raw.cardFields)) throw invalid("cardFields must be a list");
  if (!raw.cardFields.every((field) => (PROJECT_CARD_FIELDS as readonly string[]).includes(field as string))) {
    throw invalid("cardFields has an unknown field");
  }
  const cardFields = Array.from(new Set(raw.cardFields)) as ProjectCardField[];

  if (raw.view !== "cards" && raw.view !== "compact") throw invalid("view must be cards or compact");

  return { projectIds, cardFields, view: raw.view };
}

/**
 * A saved layout is only ever a bounded list of known widgets with in-grid geometry and, for the
 * projects widget, a settings object of known shape. Anything else is a 400, so the stored JSON can
 * always be read back by the app.
 */
export function validateDashboardLayout(input: unknown): DashboardLayout {
  const raw = input as Partial<DashboardLayout> | null;
  if (!raw || typeof raw !== "object") throw invalid("layout must be an object");
  if (raw.version !== DASHBOARD_LAYOUT_VERSION) throw invalid("layout version is not supported");
  if (!Array.isArray(raw.widgets)) throw invalid("layout.widgets must be a list");
  if (raw.widgets.length > MAX_WIDGETS) throw invalid("layout has too many widgets");

  const seen = new Set<string>();
  const widgets = raw.widgets.map((entry: unknown): DashboardWidgetInstance => {
    const item = entry as Partial<DashboardWidgetInstance> | null;
    if (!item || typeof item !== "object" || !isWidgetType(item.type)) throw invalid("layout has an unknown widget");
    if (seen.has(item.type)) throw invalid("layout lists a widget twice");
    seen.add(item.type);
    if (!isInt(item.w, 1, GRID_COLS) || !isInt(item.x, 0, GRID_COLS - 1) || item.x + item.w > GRID_COLS) {
      throw invalid("layout has a widget outside the grid");
    }
    if (!isInt(item.y, 0, MAX_ROW) || !isInt(item.h, 1, MAX_HEIGHT)) throw invalid("layout has an invalid widget size");
    if (typeof item.hidden !== "boolean") throw invalid("layout has an invalid visibility");

    const widget: DashboardWidgetInstance = { type: item.type, x: item.x, y: item.y, w: item.w, h: item.h, hidden: item.hidden };
    if (item.type === "projects") widget.settings = validateProjectsSettings(item.settings);
    return widget;
  });

  return { version: DASHBOARD_LAYOUT_VERSION, widgets };
}

export async function getDashboardLayout(q: Queryable, subject: ClientSubject): Promise<DashboardLayoutView> {
  const result = await q.query(
    `SELECT layout, version FROM client_portal_dashboard_layouts WHERE contact_id = $1`,
    [subject.contactId]
  );
  const row = result.rows[0];
  // A layout written by a future version is ignored rather than guessed at.
  return { layout: row && row.version === DASHBOARD_LAYOUT_VERSION ? (row.layout as DashboardLayout) : null };
}

export async function saveDashboardLayout(
  q: Queryable,
  subject: ClientSubject,
  input: unknown
): Promise<DashboardLayoutView> {
  const layout = validateDashboardLayout(input);
  await q.query(
    `INSERT INTO client_portal_dashboard_layouts (contact_id, layout, version)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (contact_id) DO UPDATE
       SET layout = EXCLUDED.layout, version = EXCLUDED.version, updated_at = CURRENT_TIMESTAMP`,
    [subject.contactId, JSON.stringify(layout), DASHBOARD_LAYOUT_VERSION]
  );
  return { layout };
}

/** Back to the default layout. */
export async function resetDashboardLayout(q: Queryable, subject: ClientSubject): Promise<DashboardLayoutView> {
  await q.query(`DELETE FROM client_portal_dashboard_layouts WHERE contact_id = $1`, [subject.contactId]);
  return { layout: null };
}
