/**
 * Phase 6 — PM lifecycle clear helpers (unit-level, no DB).
 * Socket emit / SQL paths are covered by integration; this guards reason typing.
 */

import type { ProjectPermissionChangeReason } from "../shared/pm-lifecycle";

const REASONS: ProjectPermissionChangeReason[] = [
  "pm_removed",
  "pm_assigned",
  "finance_access_changed",
  "member_deactivated",
  "member_removed",
  "project_team_changed",
];

describe("pm-lifecycle reasons", () => {
  it("includes lifecycle and audit reasons used by Phase 6", () => {
    expect(REASONS).toContain("member_deactivated");
    expect(REASONS).toContain("member_removed");
    expect(REASONS).toContain("finance_access_changed");
    expect(REASONS).toContain("pm_removed");
  });
});
