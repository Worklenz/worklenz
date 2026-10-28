import {
  SAVED_VIEW_CONFIG_VERSION,
  SAVED_VIEW_NAME_MAX_LENGTH,
  validateSavedViewBaseView,
  validateSavedViewConfig,
  validateSavedViewName,
} from "../shared/project-saved-views";

const ID_A = "0b3f6c1e-2a4d-4c8b-9e1f-5a6b7c8d9e0f";
const ID_B = "1c4a7d2f-3b5e-4d9c-8f2a-6b7c8d9e0f1a";

const validConfig = () => ({
  version: SAVED_VIEW_CONFIG_VERSION,
  priorities: [ID_A],
  statuses: [ID_A, ID_B],
  phases: [],
  members: [ID_B],
  labels: [],
  search: "login",
  archived: false,
  group: "priority",
  sort_field: "end_date",
  sort_order: "DESC",
});

describe("validateSavedViewName", () => {
  it("trims and accepts a normal name", () => {
    expect(validateSavedViewName("  My tasks  ")).toEqual({ ok: true, value: "My tasks" });
  });

  it.each([undefined, null, 42, "", "   "])("rejects %p", raw => {
    expect(validateSavedViewName(raw).ok).toBe(false);
  });

  it("rejects names over the length limit", () => {
    expect(validateSavedViewName("x".repeat(SAVED_VIEW_NAME_MAX_LENGTH + 1)).ok).toBe(false);
    expect(validateSavedViewName("x".repeat(SAVED_VIEW_NAME_MAX_LENGTH)).ok).toBe(true);
  });
});

describe("validateSavedViewBaseView", () => {
  it("defaults to the task list", () => {
    expect(validateSavedViewBaseView(undefined)).toEqual({ ok: true, value: "tasks-list" });
  });

  it("rejects unsupported views", () => {
    expect(validateSavedViewBaseView("finance").ok).toBe(false);
  });
});

describe("validateSavedViewConfig", () => {
  it("accepts a full config", () => {
    expect(validateSavedViewConfig(validConfig())).toEqual({ ok: true, value: validConfig() });
  });

  it("fills defaults for omitted optional fields", () => {
    const result = validateSavedViewConfig({ version: SAVED_VIEW_CONFIG_VERSION });
    expect(result).toEqual({
      ok: true,
      value: {
        version: SAVED_VIEW_CONFIG_VERSION,
        priorities: [],
        statuses: [],
        phases: [],
        members: [],
        labels: [],
        search: "",
        archived: false,
        group: "status",
        sort_field: "",
        sort_order: "ASC",
      },
    });
  });

  it("removes duplicate ids", () => {
    const result = validateSavedViewConfig({ ...validConfig(), labels: [ID_A, ID_A] });
    expect(result.ok && result.value.labels).toEqual([ID_A]);
  });

  it.each([
    ["a non-object", "nope"],
    ["an array", []],
    ["an unknown key", { ...validConfig(), extra: true }],
    ["a wrong version", { ...validConfig(), version: 99 }],
    ["a non-id filter value", { ...validConfig(), members: ["'; DROP TABLE tasks; --"] }],
    ["a non-array filter", { ...validConfig(), statuses: ID_A }],
    ["too many ids", { ...validConfig(), labels: Array(201).fill(ID_A) }],
    ["a non-string search", { ...validConfig(), search: 5 }],
    ["an oversized search", { ...validConfig(), search: "x".repeat(201) }],
    ["a non-boolean archived", { ...validConfig(), archived: "yes" }],
    ["an unknown group", { ...validConfig(), group: "project" }],
    ["an unsafe sort field", { ...validConfig(), sort_field: "name; DROP" }],
    ["an unknown sort order", { ...validConfig(), sort_order: "UP" }],
  ])("rejects %s", (_label, raw) => {
    expect(validateSavedViewConfig(raw).ok).toBe(false);
  });
});
