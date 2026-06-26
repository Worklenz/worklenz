import {
  FieldMappingRow,
  mapRawToTaskFields,
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
