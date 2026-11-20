jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("../shared/entitlements/gates", () => ({
  teamCanUseFeature: jest.fn(async () => true),
}));
jest.mock("../shared/organization-permissions", () => {
  const actual = jest.requireActual("../shared/organization-permissions");
  return {
    ...actual,
    hasOrganizationPermission: jest.fn(async () => true),
  };
});

import db from "../config/db";
import i18next from "../config/i18n";
import { IPassportSession } from "../interfaces/passport-session";
import { teamCanUseFeature } from "../shared/entitlements/gates";
import {
  hasOrganizationPermission,
  ORGANIZATION_PERMISSIONS,
} from "../shared/organization-permissions";
import {
  MAX_ANALYTICS_SCHEDULES_PER_KIND,
  MAX_ANALYTICS_SCHEDULES_PER_USER,
} from "../shared/reporting-analytics.constants";
import {
  upsertSchedule,
  ScheduleServiceError,
} from "../services/reporting-analytics/analytics-schedules.service";

const user: IPassportSession = {
  id: "11111111-1111-1111-1111-111111111111",
  team_id: "22222222-2222-2222-2222-222222222222",
  role_name: "Admin",
  owner: false,
  is_admin: true,
};

const scheduleRow = {
  id: "33333333-3333-3333-3333-333333333333",
  team_id: user.team_id,
  owner_id: user.id,
  report_kind: "velocity",
  report_name: "Velocity",
  template_id: null,
  schedule_type: "daily",
  days_of_week: null,
  day_of_month: null,
  date_of_month: null,
  week_of_month: null,
  interval_days: null,
  interval_weeks: null,
  interval_months: null,
  send_time: "08:00",
  timezone: "UTC",
  recipients: ["owner@example.com"],
  formats: ["PDF"],
  message: null,
  filters_json: {},
  paused: false,
  last_sent_at: null,
  next_send_at: "2026-11-21T08:00:00.000Z",
  created_at: "2026-11-20T00:00:00.000Z",
  updated_at: "2026-11-20T00:00:00.000Z",
};

const baseInput = {
  reportKind: "velocity",
  reportName: "Velocity",
  scheduleType: "daily" as const,
  sendTime: "08:00",
  timezone: "UTC",
  recipients: ["owner@example.com"],
  formats: ["PDF" as const],
  filters: {},
};

const query = jest.fn();
const release = jest.fn();
let ownerCount = { count: 0, total_count: 0 };

beforeAll(async () => {
  await i18next.init({ lng: "en", resources: {} });
});

beforeEach(() => {
  ownerCount = { count: 0, total_count: 0 };
  jest.mocked(teamCanUseFeature).mockResolvedValue(true);
  jest.mocked(hasOrganizationPermission).mockResolvedValue(true);
  (db.connect as jest.Mock).mockResolvedValue({ query, release });
  (db.query as jest.Mock).mockResolvedValue({ rows: [] });
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("COUNT(*)")) return { rows: [ownerCount] };
    if (sql.includes("INSERT INTO")) return { rows: [scheduleRow] };
    return { rows: [] };
  });
});

describe("upsertSchedule finance authorization", () => {
  it.each(["project-health", "budget-tracking"])(
    "rejects %s without View finance",
    async reportKind => {
      jest.mocked(hasOrganizationPermission).mockImplementation(async (_user, permission) =>
        permission !== ORGANIZATION_PERMISSIONS.VIEW_FINANCE
      );

      await expect(
        upsertSchedule(user, { ...baseInput, reportKind, reportName: reportKind })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "View finance permission required",
      } satisfies Partial<ScheduleServiceError>);

      expect(db.connect).not.toHaveBeenCalled();
      expect(hasOrganizationPermission).toHaveBeenCalledWith(
        user,
        ORGANIZATION_PERMISSIONS.VIEW_FINANCE
      );
    }
  );

  it.each(["project-health", "budget-tracking"])(
    "rejects %s without finance_module",
    async reportKind => {
      jest.mocked(teamCanUseFeature).mockResolvedValue(false);

      await expect(
        upsertSchedule(user, { ...baseInput, reportKind, reportName: reportKind })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Finance module required",
      });

      expect(db.connect).not.toHaveBeenCalled();
      expect(teamCanUseFeature).toHaveBeenCalledWith(user.team_id, "finance_module");
    }
  );

  it("allows non-finance schedules without View finance", async () => {
    jest.mocked(hasOrganizationPermission).mockResolvedValue(false);

    await expect(upsertSchedule(user, baseInput)).resolves.toMatchObject({
      id: scheduleRow.id,
      report_kind: "velocity",
    });
    expect(hasOrganizationPermission).not.toHaveBeenCalled();
  });
});

describe("upsertSchedule creation caps", () => {
  it.each(["kind", "total"])("enforces the owner %s quota before inserting", async quota => {
    ownerCount =
      quota === "kind"
        ? {
            count: MAX_ANALYTICS_SCHEDULES_PER_KIND,
            total_count: MAX_ANALYTICS_SCHEDULES_PER_KIND,
          }
        : { count: 0, total_count: MAX_ANALYTICS_SCHEDULES_PER_USER };

    await expect(upsertSchedule(user, baseInput)).rejects.toMatchObject({ statusCode: 400 });
    expect(query.mock.calls.some(([sql]) => /INSERT/.test(sql))).toBe(false);
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("locks the team before checking counts and writing", async () => {
    await upsertSchedule(user, baseInput);
    expect(query.mock.calls[0]).toEqual(["BEGIN"]);
    expect(query.mock.calls[1]).toEqual([
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`analytics-schedule-quota:${user.team_id}`],
    ]);
    expect(query.mock.calls[2][0]).toContain("COUNT(*)");
  });

  it("allows creation just below both owner limits", async () => {
    ownerCount = {
      count: MAX_ANALYTICS_SCHEDULES_PER_KIND - 1,
      total_count: MAX_ANALYTICS_SCHEDULES_PER_USER - 1,
    };
    await expect(upsertSchedule(user, baseInput)).resolves.toMatchObject({
      id: scheduleRow.id,
    });
    expect(query.mock.calls.some(([sql]) => sql.includes("INSERT INTO"))).toBe(true);
    expect(query).toHaveBeenLastCalledWith("COMMIT");
  });
});
