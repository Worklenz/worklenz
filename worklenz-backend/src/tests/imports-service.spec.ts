import {
  FieldMappingRow,
  mapRawToTaskFields,
} from "../services/imports-service";

describe("mapRawToTaskFields", () => {
  it("maps labels into built-in labels patch", () => {
    const mappings: FieldMappingRow[] = [
      { source_field: "Labels", target_field: "labels", include: true },
    ];

    const raw = { Labels: "Bug, Feature; Enhancement" } as Record<
      string,
      unknown
    >;

    const { patch, customValues } = mapRawToTaskFields(raw, mappings);

    expect(patch.labels).toEqual(["Bug", "Feature", "Enhancement"]);
    expect(customValues).toHaveLength(0);
  });

  it("keeps non-email assignee identifiers", () => {
    const mappings: FieldMappingRow[] = [
      { source_field: "Members", target_field: "assignees", include: true },
    ];

    const raw = { Members: "John Doe" } as Record<string, unknown>;

    const { patch } = mapRawToTaskFields(raw, mappings);

    expect(patch.assignee_source_id).toBe("John Doe");
  });
});
