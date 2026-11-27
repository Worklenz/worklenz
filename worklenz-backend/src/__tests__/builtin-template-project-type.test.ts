import db from "../config/db";
import ProjectTemplatesControllerBase from "../controllers/project-templates/project-templates-base";
import { createQueryResult } from "../tests/utils/db-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({
  __esModule: true,
  default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor,
}));

class TestTemplates extends ProjectTemplatesControllerBase {
  static insertTemplate = this.insertProjectTemplate;
  static insertTasks = this.insertProjectTasks;
}

const query = db.query as jest.MockedFunction<typeof db.query>;
beforeEach(() => jest.clearAllMocks());

test("stores the type of a built-in template and defaults old inputs to general", async () => {
  query.mockResolvedValue(createQueryResult([{ id: "template" }]));
  await TestTemplates.insertTemplate({ name: "Software", key: "SW", project_type: "software" });
  await TestTemplates.insertTemplate({ name: "General", key: "GE" });
  expect(query.mock.calls.map(call => call[1]?.[4])).toEqual(["software", "general"]);
});

test("copies a task with its source status category as a fallback for the target workflow", async () => {
  query.mockResolvedValueOnce(createQueryResult([{ id: "task", status_id: "status" }]));
  query.mockResolvedValueOnce(createQueryResult([]));
  await TestTemplates.insertTasks(
    [{ name: "Task", status_name: "Doing", status_category_id: "category", priority_name: "Medium" }],
    "team", "project", "user", null
  );
  expect(query.mock.calls[0][0]).toContain("ts.category_id = $7::uuid");
  expect(query.mock.calls[0][1]?.[6]).toBe("category");
});
