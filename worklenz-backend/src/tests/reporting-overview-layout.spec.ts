import { InvalidOverviewLayoutError, validateLayout } from "../services/reporting-overview-layout.service";

const PROJECT_ID = "6f1c1f3e-0f5a-4c43-9a3b-1b7f2f4f9c11";
const layoutWith = (config: Record<string, unknown>, key = "burndown_chart") => ({
  version: 1,
  widgets: [{ id: "w1", key, x: 0, y: 0, w: 6, h: 9, hidden: false, config }],
});

describe("validateLayout - burnup / burndown widgets", () => {
  it("accepts a project-scoped sprint configuration", () => {
    const config = {
      progressScope: "project",
      projectId: PROJECT_ID,
      progressSource: "sprint",
      sprintId: PROJECT_ID,
      progressMetric: "estimated_hours",
      includeSubtasks: true,
      showIdealLine: false,
      showForecast: true,
    };
    expect(validateLayout(layoutWith(config, "burnup_chart")).widgets[0].config).toEqual(config);
  });

  it("allows the same chart to be added twice", () => {
    const layout = {
      version: 1,
      widgets: [
        { id: "a", key: "burndown_chart", x: 0, y: 0, w: 6, h: 9, hidden: false },
        { id: "b", key: "burndown_chart", x: 6, y: 0, w: 6, h: 9, hidden: false },
      ],
    };
    expect(validateLayout(layout).widgets).toHaveLength(2);
  });

  it("rejects the organization scope and other bad values", () => {
    expect(() => validateLayout(layoutWith({ progressScope: "organization" }))).toThrow(InvalidOverviewLayoutError);
    expect(() => validateLayout(layoutWith({ progressMetric: "hours" }))).toThrow(InvalidOverviewLayoutError);
    expect(() => validateLayout(layoutWith({ progressSource: "release" }))).toThrow(InvalidOverviewLayoutError);
    expect(() => validateLayout(layoutWith({ projectId: "not-a-uuid" }))).toThrow(InvalidOverviewLayoutError);
    expect(() => validateLayout(layoutWith({ includeSubtasks: "true" }))).toThrow(InvalidOverviewLayoutError);
  });
});
