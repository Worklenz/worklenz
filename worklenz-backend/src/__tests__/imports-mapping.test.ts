import {
  FieldMappingRow,
  mapRawToTaskFields,
  resolvePriorityId,
  lookupStatusId,
} from "../services/imports-service";

jest.unmock("../services/imports-service");
jest.unmock("slugify");

describe("mapRawToTaskFields", () => {
  it("maps standard fields and collects custom column values", () => {
    const raw = {
      Description: "A task description",
      Status: "In Progress",
      Estimate: "5",
      Owner: "alice@example.com",
    };

    const mappings: FieldMappingRow[] = [
      { source_field: "Description", target_field: "description" },
      { source_field: "Status", target_field: "status" },
      { source_field: "Owner", target_field: "assignees" },
      { source_field: "Estimate", target_field: "estimation" },
    ];

    const result = mapRawToTaskFields(raw, mappings);

    expect(result.patch).toMatchObject({
      description: "A task description",
      status: "In Progress",
      assignee_source_id: "alice@example.com",
    });
    expect(result.customValues).toEqual([
      {
        columnKey: "estimation",
        columnName: "Estimate",
        value: "5",
      },
    ]);
  });

  it("ignores unmapped or excluded fields", () => {
    const raw = { Empty: "", KeepMe: "value" };
    const mappings: FieldMappingRow[] = [
      { source_field: "Empty", target_field: "description" },
      { source_field: "KeepMe", target_field: "customField", include: false },
    ];

    const result = mapRawToTaskFields(raw, mappings);

    expect(result.patch).toEqual({});
    expect(result.customValues).toEqual([]);
  });

  it("keeps unknown target fields as custom columns", () => {
    const raw = { "Customer Tier": "Enterprise" };
    const mappings: FieldMappingRow[] = [
      { source_field: "Customer Tier", target_field: "customer_tier", include: true },
    ];

    const result = mapRawToTaskFields(raw, mappings);

    expect(result.patch).toEqual({});
    expect(result.customValues).toEqual([
      {
        columnKey: "customertier",
        columnName: "Customer Tier",
        value: "Enterprise",
      },
    ]);
  });
});

describe("resolvePriorityId", () => {
  // Worklenz's real priority set — mirrors task_priorities seed data
  // (database/sql/2_dml.sql): Low, Medium, High, Critical. There is no "Urgent".
  const priorityMap = new Map<string, string>([
    ["low", "low-id"],
    ["medium", "medium-id"],
    ["high", "high-id"],
    ["critical", "critical-id"],
  ]);
  const defaultPriorityId = "low-id";

  it("matches a priority name directly, case-insensitively", () => {
    expect(resolvePriorityId("High", priorityMap, defaultPriorityId)).toBe(
      "high-id",
    );
    expect(resolvePriorityId("critical", priorityMap, defaultPriorityId)).toBe(
      "critical-id",
    );
  });

  it("maps Jira/Asana-style highest-severity aliases to Critical, not a nonexistent Urgent priority", () => {
    // Regression test: these used to alias to "urgent", which doesn't exist
    // in priorityMap, silently falling back to the default (Low) priority.
    expect(resolvePriorityId("Highest", priorityMap, defaultPriorityId)).toBe(
      "critical-id",
    );
    expect(resolvePriorityId("Urgent", priorityMap, defaultPriorityId)).toBe(
      "critical-id",
    );
    expect(resolvePriorityId("Blocker", priorityMap, defaultPriorityId)).toBe(
      "critical-id",
    );
  });

  it("maps lowest-severity aliases to Low", () => {
    expect(resolvePriorityId("Lowest", priorityMap, defaultPriorityId)).toBe(
      "low-id",
    );
    expect(resolvePriorityId("Trivial", priorityMap, defaultPriorityId)).toBe(
      "low-id",
    );
  });

  it("falls back to the default priority for unrecognized or missing values", () => {
    expect(
      resolvePriorityId("Not A Priority", priorityMap, defaultPriorityId),
    ).toBe(defaultPriorityId);
    expect(resolvePriorityId(null, priorityMap, defaultPriorityId)).toBe(
      defaultPriorityId,
    );
  });
});

describe("lookupStatusId", () => {
  // Mirrors the three default task statuses every imported project starts
  // with (database/sql/4_functions.sql): To Do, Doing, Done.
  const statusMap = new Map<string, string>([
    ["to do", "todo-id"],
    ["doing", "doing-id"],
    ["done", "done-id"],
  ]);
  const defaultStatusId = "todo-id";

  it("matches a status name directly, case-insensitively", () => {
    expect(
      lookupStatusId("Doing", statusMap, new Map(), defaultStatusId),
    ).toBe("doing-id");
  });

  it("applies a user-configured value mapping before falling back to the default", () => {
    const sourcesToTargetStatus = new Map([["in progress", "doing"]]);
    expect(
      lookupStatusId(
        "In Progress",
        statusMap,
        sourcesToTargetStatus,
        defaultStatusId,
      ),
    ).toBe("doing-id");
  });

  it("falls back to the default status when nothing matches", () => {
    // Regression guard: if a value mapping points at a status name that
    // doesn't exist on the target project (e.g. a stale/incorrect mapping),
    // this must fall back to the default rather than silently misrouting.
    const sourcesToTargetStatus = new Map([["doing", "in progress"]]);
    expect(
      lookupStatusId(
        "Doing",
        statusMap,
        sourcesToTargetStatus,
        defaultStatusId,
      ),
    ).toBe(defaultStatusId);
    expect(
      lookupStatusId(null, statusMap, new Map(), defaultStatusId),
    ).toBe(defaultStatusId);
  });
});
