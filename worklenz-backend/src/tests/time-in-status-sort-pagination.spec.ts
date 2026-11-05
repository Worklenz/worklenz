/**
 * Regression: per-issue Time in Status returns a capped window (default 100).
 * Server sort must remain available so rows outside the default first page
 * can be retrieved by changing sort order.
 */

jest.unmock("../services/reporting-analytics/time-in-status.service");

import {
  sortAndPaginateTimeInStatusIssues,
  type TimeInStatusIssueRow,
} from "../services/reporting-analytics/time-in-status.service";

const makeIssue = (
  index: number,
  totalDays: number
): TimeInStatusIssueRow => ({
  task_id: `task-${index}`,
  task_key: `KEY-${String(index).padStart(3, "0")}`,
  task_name: `Issue ${index}`,
  project_id: "p1",
  project_name: "Project",
  issue_type: "task",
  assignee_name: null,
  total_days: totalDays,
  is_outlier: false,
  segments: [],
});

describe("sortAndPaginateTimeInStatusIssues", () => {
  const issues = Array.from({ length: 150 }, (_, i) =>
    // Higher index → higher total_days so total_desc ranks high indexes first.
    makeIssue(i + 1, i + 1)
  );

  it("caps the default total_desc window at 100 rows", () => {
    const page = sortAndPaginateTimeInStatusIssues(issues, "total_desc", 100, 0);
    expect(page).toHaveLength(100);
    expect(page[0].task_key).toBe("KEY-150");
    expect(page[99].task_key).toBe("KEY-051");
    expect(page.map(r => r.task_key)).not.toContain("KEY-001");
  });

  it("surfaces rows outside the default first 100 when sort changes to key_asc", () => {
    const byTotal = sortAndPaginateTimeInStatusIssues(issues, "total_desc", 100, 0);
    const byKey = sortAndPaginateTimeInStatusIssues(issues, "key_asc", 100, 0);

    expect(byKey).toHaveLength(100);
    expect(byKey[0].task_key).toBe("KEY-001");
    expect(byKey.map(r => r.task_key)).toContain("KEY-001");
    expect(byTotal.map(r => r.task_key)).not.toContain("KEY-001");
    expect(byKey.map(r => r.task_id)).not.toEqual(byTotal.map(r => r.task_id));
  });

  it("supports offset paging after an alternate sort", () => {
    const page2 = sortAndPaginateTimeInStatusIssues(issues, "key_asc", 100, 100);
    expect(page2).toHaveLength(50);
    expect(page2[0].task_key).toBe("KEY-101");
    expect(page2[49].task_key).toBe("KEY-150");
  });
});
