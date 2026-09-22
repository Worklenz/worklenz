import {
  FieldMappingRow,
  mapRawToTaskFields,
} from "../services/imports-service";
import { parseDateValue } from "../services/imports/resolvers";

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

describe("CSV import date validation", () => {
  it("accepts common valid dates and rejects impossible dates", () => {
    expect(parseDateValue("2026-09-09")).not.toBeNull();
    expect(parseDateValue("09/09/2026")).not.toBeNull();
    expect(parseDateValue("2026-02-30")).toBeNull();
    expect(parseDateValue("not-a-date")).toBeNull();
  });
});
