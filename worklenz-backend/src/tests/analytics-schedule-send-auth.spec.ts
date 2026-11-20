jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
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
import { teamCanUseFeature } from "../shared/entitlements/gates";
import {
  hasOrganizationPermission,
  ORGANIZATION_PERMISSIONS,
} from "../shared/organization-permissions";
import { canOwnerSendSchedule } from "../services/reporting-analytics/analytics-schedule-access";

const userId = "11111111-1111-1111-1111-111111111111";
const teamId = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  jest.mocked(teamCanUseFeature).mockResolvedValue(true);
  jest.mocked(hasOrganizationPermission).mockResolvedValue(true);
  (db.query as jest.Mock).mockResolvedValue({
    rows: [
      {
        team_member_id: "tm-1",
        role_name: "Admin",
        is_owner: false,
        is_admin_role: true,
      },
    ],
  });
});

describe("canOwnerSendSchedule", () => {
  it("denies when advanced_reporting is revoked", async () => {
    jest.mocked(teamCanUseFeature).mockImplementation(async (_team, feature) =>
      feature !== "advanced_reporting"
    );

    await expect(canOwnerSendSchedule(userId, teamId, "velocity")).resolves.toBe(false);
    expect(teamCanUseFeature).toHaveBeenCalledWith(teamId, "advanced_reporting");
    expect(hasOrganizationPermission).not.toHaveBeenCalled();
  });

  it("denies when View reports is revoked", async () => {
    jest.mocked(hasOrganizationPermission).mockImplementation(async (_user, permission) =>
      permission !== ORGANIZATION_PERMISSIONS.VIEW_REPORTS
    );

    await expect(canOwnerSendSchedule(userId, teamId, "time-report")).resolves.toBe(false);
    expect(hasOrganizationPermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: userId, team_id: teamId }),
      ORGANIZATION_PERMISSIONS.VIEW_REPORTS
    );
  });

  it("denies when the owner is no longer an active team member", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });

    await expect(canOwnerSendSchedule(userId, teamId, "velocity")).resolves.toBe(false);
    expect(hasOrganizationPermission).not.toHaveBeenCalled();
  });

  it("allows a non-finance schedule when View reports + advanced_reporting hold", async () => {
    await expect(canOwnerSendSchedule(userId, teamId, "velocity")).resolves.toBe(true);
    expect(teamCanUseFeature).toHaveBeenCalledWith(teamId, "advanced_reporting");
    expect(hasOrganizationPermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: userId }),
      ORGANIZATION_PERMISSIONS.VIEW_REPORTS
    );
  });

  it.each(["project-health", "budget-tracking"])(
    "denies finance kind %s when View finance is revoked",
    async reportKind => {
      jest.mocked(hasOrganizationPermission).mockImplementation(async (_user, permission) =>
        permission !== ORGANIZATION_PERMISSIONS.VIEW_FINANCE
      );

      await expect(canOwnerSendSchedule(userId, teamId, reportKind)).resolves.toBe(false);
      expect(hasOrganizationPermission).toHaveBeenCalledWith(
        expect.objectContaining({ id: userId }),
        ORGANIZATION_PERMISSIONS.VIEW_FINANCE
      );
    }
  );

  it("denies finance kinds when finance_module is revoked", async () => {
    jest.mocked(teamCanUseFeature).mockImplementation(async (_team, feature) =>
      feature !== "finance_module"
    );

    await expect(
      canOwnerSendSchedule(userId, teamId, "project-health")
    ).resolves.toBe(false);
  });
});
