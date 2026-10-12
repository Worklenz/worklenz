jest.unmock("../shared/project-template-apply-utils");

import {
  applyOffsetDate,
  calendarDayOffset,
  chunkArray,
  mergeProjectSettingsForImport,
  remapTemplateDependencies,
} from "../shared/project-template-apply-utils";

describe("project-template-apply-utils", () => {
  describe("mergeProjectSettingsForImport (8.2 back-compat)", () => {
    it("returns blank defaults for null/empty old templates", () => {
      const merged = mergeProjectSettingsForImport(null, null);
      expect(merged.category_id).toBeNull();
      expect(merged.project_manager_id).toBeNull();
      expect(merged.working_days).toBe(0);
      expect(merged.man_days).toBe(0);
      expect(merged.hours_per_day).toBe(8);
      expect(merged.budget).toBeNull();
      expect(merged.advanced.use_manual_progress).toBe(false);
    });

    it("applies overrides over template settings", () => {
      const merged = mergeProjectSettingsForImport(
        {
          category_id: "cat-1",
          estimated_working_days: 10,
          hours_per_day: 6,
          advanced: { use_manual_progress: true },
        },
        {
          category_id: "cat-2",
          estimated_working_days: 20,
          advanced: { use_manual_progress: false, use_time_progress: true },
        }
      );
      expect(merged.category_id).toBe("cat-2");
      expect(merged.working_days).toBe(20);
      expect(merged.hours_per_day).toBe(6);
      expect(merged.advanced.use_manual_progress).toBe(false);
      expect(merged.advanced.use_time_progress).toBe(true);
    });

    it("merges budget when present on template or override", () => {
      const fromTemplate = mergeProjectSettingsForImport(
        { budget: { amount: 1000, currency: "USD" } },
        null
      );
      expect(fromTemplate.budget).toEqual({ amount: 1000, currency: "USD" });

      const fromOverride = mergeProjectSettingsForImport(null, {
        budget: { amount: 500, currency: "EUR" },
      });
      expect(fromOverride.budget).toEqual({ amount: 500, currency: "EUR" });
    });
  });

  describe("date offsets (8.3)", () => {
    it("computes calendar-day offsets in UTC", () => {
      expect(calendarDayOffset("2026-01-01", "2026-01-11")).toBe(10);
      expect(calendarDayOffset("2026-01-01", null)).toBeNull();
      expect(calendarDayOffset(null, "2026-01-11")).toBeNull();
    });

    it("applies offsets to project start", () => {
      expect(applyOffsetDate("2026-09-21", 0)).toBe("2026-09-21");
      expect(applyOffsetDate("2026-09-21", 7)).toBe("2026-09-28");
      expect(applyOffsetDate("2026-09-21", null)).toBeNull();
    });
  });

  describe("chunkArray / remapTemplateDependencies (8.1 / 8.3)", () => {
    it("chunks arrays", () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("remaps dependencies and skips unmapped/self", () => {
      const idMap = new Map([
        ["a", "A"],
        ["b", "B"],
      ]);
      const { inserts, skipped } = remapTemplateDependencies(
        [
          { taskTemplateId: "a", relatedTemplateId: "b", dependencyType: "blocked_by" },
          { taskTemplateId: "a", relatedTemplateId: "missing" },
          { taskTemplateId: "a", relatedTemplateId: "a" },
        ],
        idMap
      );
      expect(inserts).toEqual([
        { taskId: "A", relatedTaskId: "B", dependencyType: "blocked_by" },
      ]);
      expect(skipped).toHaveLength(2);
    });
  });
});
