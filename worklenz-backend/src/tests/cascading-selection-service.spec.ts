import {
  clearInvalidDependentValues,
  validateDependentSelectionValue,
  validateParentColumn,
} from "../services/cascading-selection-service";

type QueryResult = { rows: any[]; rowCount: number | null };

interface MockQuery {
  match: (text: string, params?: unknown[]) => boolean;
  result: QueryResult | ((text: string, params?: unknown[]) => QueryResult);
}

function createMockClient(handlers: MockQuery[]) {
  const calls: Array<{ text: string; params?: unknown[] }> = [];

  return {
    calls,
    async query(text: string, params?: unknown[]): Promise<QueryResult> {
      calls.push({ text, params });
      const handler = handlers.find(entry => entry.match(text, params));
      if (!handler) {
        throw new Error(`Unexpected query:\n${text}\nparams=${JSON.stringify(params)}`);
      }
      return typeof handler.result === "function" ? handler.result(text, params) : handler.result;
    },
  };
}

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const PARENT_ID = "22222222-2222-4222-8222-222222222222";
const CHILD_ID = "33333333-3333-4333-8333-333333333333";
const TASK_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_ID = "55555555-5555-4555-8555-555555555555";

describe("cascading-selection-service", () => {
  describe("validateParentColumn", () => {
    it("allows a clear parent (null/undefined)", async () => {
      const client = createMockClient([]);
      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: CHILD_ID,
          parentColumnId: null,
          fieldType: "selection",
        })
      ).resolves.toBeNull();
      expect(client.calls).toHaveLength(0);
    });

    it("rejects non-UUID parents and non-selection children", async () => {
      const client = createMockClient([]);

      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: CHILD_ID,
          parentColumnId: "not-a-uuid",
          fieldType: "selection",
        })
      ).resolves.toMatchObject({ error_code: "CASCADE_PARENT_NOT_FOUND" });

      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: CHILD_ID,
          parentColumnId: PARENT_ID,
          fieldType: "text",
        })
      ).resolves.toMatchObject({ error_code: "CASCADE_REQUIRES_SELECTION" });
    });

    it("rejects self-reference", async () => {
      const client = createMockClient([]);
      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: PARENT_ID,
          parentColumnId: PARENT_ID,
          fieldType: "selection",
        })
      ).resolves.toMatchObject({ error_code: "CASCADE_SELF_REFERENCE" });
    });

    it("rejects parents that already depend on another field", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("FROM cc_custom_columns cc"),
          result: {
            rows: [
              {
                name: "Team",
                field_type: "selection",
                project_id: PROJECT_ID,
                parent_column_id: OTHER_ID,
              },
            ],
            rowCount: 1,
          },
        },
      ]);

      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: CHILD_ID,
          parentColumnId: PARENT_ID,
          fieldType: "selection",
        })
      ).resolves.toMatchObject({ error_code: "CASCADE_MAX_DEPTH" });
    });

    it("rejects making a parent into a dependent when it already has children", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("FROM cc_custom_columns cc"),
          result: {
            rows: [
              {
                name: "Department",
                field_type: "selection",
                project_id: PROJECT_ID,
                parent_column_id: null,
              },
            ],
            rowCount: 1,
          },
        },
        {
          match: text => text.includes("WHERE parent_column_id = $1"),
          result: { rows: [{ "?column?": 1 }], rowCount: 1 },
        },
      ]);

      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: PARENT_ID,
          parentColumnId: OTHER_ID,
          fieldType: "selection",
        })
      ).resolves.toMatchObject({ error_code: "CASCADE_MAX_DEPTH" });
    });

    it("accepts a valid top-level selection parent", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("FROM cc_custom_columns cc"),
          result: {
            rows: [
              {
                name: "Department",
                field_type: "selection",
                project_id: PROJECT_ID,
                parent_column_id: null,
              },
            ],
            rowCount: 1,
          },
        },
        {
          match: text => text.includes("WHERE parent_column_id = $1"),
          result: { rows: [], rowCount: 0 },
        },
      ]);

      await expect(
        validateParentColumn(client, {
          projectId: PROJECT_ID,
          columnId: CHILD_ID,
          parentColumnId: PARENT_ID,
          fieldType: "selection",
        })
      ).resolves.toBeNull();
    });
  });

  describe("validateDependentSelectionValue", () => {
    it("allows empty values without querying further", async () => {
      const client = createMockClient([]);
      await expect(
        validateDependentSelectionValue(TASK_ID, CHILD_ID, "", client)
      ).resolves.toBeNull();
      await expect(
        validateDependentSelectionValue(TASK_ID, CHILD_ID, null, client)
      ).resolves.toBeNull();
      expect(client.calls).toHaveLength(0);
    });

    it("rejects when the parent value is missing on the task", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("AS child_name"),
          result: {
            rows: [{ child_name: "Team", parent_id: PARENT_ID, parent_name: "Department" }],
            rowCount: 1,
          },
        },
        {
          match: text => text.includes("FROM cc_column_values"),
          result: { rows: [], rowCount: 0 },
        },
      ]);

      await expect(
        validateDependentSelectionValue(TASK_ID, CHILD_ID, "Frontend", client)
      ).resolves.toMatchObject({ error_code: "CASCADE_PARENT_VALUE_REQUIRED" });
    });

    it("rejects values that are not valid under the current parent option", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("AS child_name"),
          result: {
            rows: [{ child_name: "Team", parent_id: PARENT_ID, parent_name: "Department" }],
            rowCount: 1,
          },
        },
        {
          match: (text, params) =>
            text.includes("FROM cc_column_values") && params?.[1] === PARENT_ID,
          result: { rows: [{ text_value: "Sales" }], rowCount: 1 },
        },
        {
          match: text => text.includes("JOIN cc_selection_options par"),
          result: { rows: [], rowCount: 0 },
        },
      ]);

      await expect(
        validateDependentSelectionValue(TASK_ID, CHILD_ID, "Frontend", client)
      ).resolves.toMatchObject({ error_code: "CASCADE_INVALID_PAIR" });
    });

    it("accepts a valid parent/child option pair", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("AS child_name"),
          result: {
            rows: [{ child_name: "Team", parent_id: PARENT_ID, parent_name: "Department" }],
            rowCount: 1,
          },
        },
        {
          match: (text, params) =>
            text.includes("FROM cc_column_values") && params?.[1] === PARENT_ID,
          result: { rows: [{ text_value: "Engineering" }], rowCount: 1 },
        },
        {
          match: text => text.includes("JOIN cc_selection_options par"),
          result: { rows: [{ "?column?": 1 }], rowCount: 1 },
        },
      ]);

      await expect(
        validateDependentSelectionValue(TASK_ID, CHILD_ID, "Frontend", client)
      ).resolves.toBeNull();
    });
  });

  describe("clearInvalidDependentValues", () => {
    it("returns an empty list when no dependents have values", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("WHERE cf.parent_column_id = $2"),
          result: { rows: [], rowCount: 0 },
        },
      ]);

      await expect(clearInvalidDependentValues(TASK_ID, PARENT_ID, client)).resolves.toEqual([]);
    });

    it("clears dependents that are invalid after the parent value changes", async () => {
      const deleted: Array<{ taskId: unknown; columnId: unknown }> = [];
      const client = createMockClient([
        {
          match: text => text.includes("WHERE cf.parent_column_id = $2"),
          result: {
            rows: [
              {
                id: CHILD_ID,
                key: "team",
                name: "Team",
                text_value: "Frontend",
              },
            ],
            rowCount: 1,
          },
        },
        {
          match: (text, params) =>
            text.includes("FROM cc_column_values") &&
            text.includes("SELECT text_value") &&
            params?.[1] === PARENT_ID,
          result: { rows: [{ text_value: "Sales" }], rowCount: 1 },
        },
        {
          match: text => text.includes("JOIN cc_selection_options par"),
          result: { rows: [], rowCount: 0 },
        },
        {
          match: (text, params) => {
            if (text.includes("DELETE FROM cc_column_values")) {
              deleted.push({ taskId: params?.[0], columnId: params?.[1] });
              return true;
            }
            return false;
          },
          result: { rows: [], rowCount: 1 },
        },
      ]);

      const cleared = await clearInvalidDependentValues(TASK_ID, PARENT_ID, client);

      expect(cleared).toEqual([
        {
          column_id: CHILD_ID,
          column_key: "team",
          column_name: "Team",
          previous_value: "Frontend",
        },
      ]);
      expect(deleted).toEqual([{ taskId: TASK_ID, columnId: CHILD_ID }]);
    });

    it("keeps dependents that remain valid under the new parent value", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("WHERE cf.parent_column_id = $2"),
          result: {
            rows: [
              {
                id: CHILD_ID,
                key: "team",
                name: "Team",
                text_value: "Shared",
              },
            ],
            rowCount: 1,
          },
        },
        {
          match: (text, params) =>
            text.includes("FROM cc_column_values") &&
            text.includes("SELECT text_value") &&
            params?.[1] === PARENT_ID,
          result: { rows: [{ text_value: "Engineering" }], rowCount: 1 },
        },
        {
          match: text => text.includes("JOIN cc_selection_options par"),
          result: { rows: [{ "?column?": 1 }], rowCount: 1 },
        },
      ]);

      await expect(clearInvalidDependentValues(TASK_ID, PARENT_ID, client)).resolves.toEqual([]);
      expect(client.calls.some(call => call.text.includes("DELETE FROM cc_column_values"))).toBe(
        false
      );
    });

    it("clears dependents when the parent value itself is cleared", async () => {
      const client = createMockClient([
        {
          match: text => text.includes("WHERE cf.parent_column_id = $2"),
          result: {
            rows: [
              {
                id: CHILD_ID,
                key: "team",
                name: "Team",
                text_value: "Frontend",
              },
            ],
            rowCount: 1,
          },
        },
        {
          match: (text, params) =>
            text.includes("FROM cc_column_values") &&
            text.includes("SELECT text_value") &&
            params?.[1] === PARENT_ID,
          result: { rows: [], rowCount: 0 },
        },
        {
          match: text => text.includes("DELETE FROM cc_column_values"),
          result: { rows: [], rowCount: 1 },
        },
      ]);

      const cleared = await clearInvalidDependentValues(TASK_ID, PARENT_ID, client);
      expect(cleared).toHaveLength(1);
      expect(cleared[0].previous_value).toBe("Frontend");
    });
  });
});
