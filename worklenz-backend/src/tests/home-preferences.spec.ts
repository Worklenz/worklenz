// jest.config.js sets automock: true repo-wide - unmock explicitly so these pure functions run for real.
jest.unmock("../shared/home-preferences");

import {
  DEFAULT_HOME_PREFERENCES,
  HOME_PREFERENCES_MAX_BYTES,
  validateHomePreferences,
} from "../shared/home-preferences";

const clone = () => JSON.parse(JSON.stringify(DEFAULT_HOME_PREFERENCES));
const error = (doc: unknown) => {
  const result = validateHomePreferences(doc);
  return result.ok ? null : result.error;
};

describe("validateHomePreferences", () => {
  it("accepts the default document", () => {
    const result = validateHomePreferences(clone());
    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual(DEFAULT_HOME_PREFERENCES);
  });

  it("accepts a fully customised document", () => {
    const doc = clone();
    doc.layout = {
      columns: { main: ["priorities", "continue"], side: ["progress-donut"] },
      hidden: ["greeting", "stat-cards"],
    };
    doc.tabs = { order: ["Pinned", "Today", "All", "Overdue", "Upcoming", "NoDueDate"], hidden: ["Upcoming"] };
    doc.selections = {
      period: "week",
      assignedGroup: 1,
      pinnedAssignedGroup: 1,
      priorityTab: "Pinned",
      sort: { field: "priority", order: "desc" },
    };
    const result = validateHomePreferences(doc);
    expect(result.ok && result.value).toEqual(doc);
  });

  it("treats a missing pinnedAssignedGroup as none, for documents saved before it existed", () => {
    const doc = clone();
    delete doc.selections.pinnedAssignedGroup;
    const result = validateHomePreferences(doc);
    expect(result.ok && result.value.selections.pinnedAssignedGroup).toBeNull();
  });

  it("drops nothing it was not told about: only known fields come back", () => {
    const result = validateHomePreferences(clone());
    expect(result.ok && Object.keys(result.value).sort()).toEqual(["continueTabs", "layout", "selections", "tabs", "version"]);
  });

  it("treats a missing continueTabs as nothing hidden, for documents saved before it existed", () => {
    const doc = clone();
    delete doc.continueTabs;
    const result = validateHomePreferences(doc);
    expect(result.ok && result.value.continueTabs).toEqual({ hidden: [] });
  });

  it.each([null, "x", 4, [], undefined])("rejects a non-object document (%p)", doc => {
    expect(error(doc)).not.toBeNull();
  });

  it("rejects unknown fields at every level", () => {
    for (const mutate of [
      (d: any) => (d.extra = 1),
      (d: any) => (d.layout.extra = 1),
      (d: any) => (d.layout.columns.extra = []),
      (d: any) => (d.tabs.extra = 1),
      (d: any) => (d.selections.extra = 1),
      (d: any) => (d.selections.sort = { field: "name", order: "asc", extra: 1 }),
    ]) {
      const doc = clone();
      mutate(doc);
      expect(error(doc)).not.toBeNull();
    }
  });

  it("rejects an unsupported or non-integer version", () => {
    for (const version of [0, 2, 1.5, "1", null]) {
      const doc = clone();
      doc.version = version;
      expect(error(doc)).toMatch(/version/i);
    }
  });

  it("rejects a document over the size cap", () => {
    const doc = clone();
    doc.layout.hidden = ["greeting"];
    // Valid shape, but padded past the cap through a field the validator would otherwise reject.
    const padded = { ...doc, padding: "x".repeat(HOME_PREFERENCES_MAX_BYTES) };
    expect(error(padded)).toMatch(/too large/i);
  });
});

describe("validateHomePreferences - layout", () => {
  it("rejects unknown widgets, in a column or in hidden", () => {
    const inColumn = clone();
    inColumn.layout.columns.side.push("not-a-widget");
    expect(error(inColumn)).toMatch(/unknown widget/i);

    const inHidden = clone();
    inHidden.layout.hidden = ["not-a-widget"];
    expect(error(inHidden)).toMatch(/unknown widget/i);
  });

  it("rejects a widget in a column it cannot sit in", () => {
    const doc = clone();
    doc.layout.columns.main = ["priorities"];
    doc.layout.columns.side = ["stat-cards", "progress-donut", "continue"];
    expect(error(doc)).toMatch(/stat-cards.*side/);
  });

  it("rejects a widget placed twice", () => {
    const doc = clone();
    doc.layout.columns.main = ["stat-cards", "priorities", "continue"];
    doc.layout.columns.side = ["progress-donut", "continue"];
    expect(error(doc)).toMatch(/more than once/);
  });

  it("accepts hiding Task priorities and the greeting", () => {
    const hidePriorities = clone();
    hidePriorities.layout.hidden = ["priorities"];
    expect(error(hidePriorities)).toBeNull();

    const hideGreeting = clone();
    hideGreeting.layout.hidden = ["greeting"];
    expect(error(hideGreeting)).toBeNull();
  });

  it("rejects duplicate hidden entries", () => {
    const doc = clone();
    doc.layout.hidden = ["continue", "continue"];
    expect(error(doc)).toMatch(/duplicates/);
  });

  it("allows a layout with a column left empty", () => {
    const doc = clone();
    doc.layout.columns = { main: ["stat-cards", "priorities", "progress-donut", "continue"], side: [] };
    expect(error(doc)).toBeNull();
  });

  describe("optional widgets added from Add widget", () => {
    const OPTIONAL_WIDGETS = ["team-members", "assigned-by-me", "mentions", "todo"];

    it("accepts a document that has none of them", () => {
      expect(error(clone())).toBeNull();
    });

    it.each(OPTIONAL_WIDGETS)("accepts %s in either column", id => {
      const inSide = clone();
      inSide.layout.columns.side.push(id);
      expect(error(inSide)).toBeNull();

      const inMain = clone();
      inMain.layout.columns.main.push(id);
      expect(error(inMain)).toBeNull();
    });

    it("accepts all of them at once, in any order", () => {
      const doc = clone();
      doc.layout.columns.side = ["mentions", "progress-donut", "todo", "continue", "assigned-by-me", "team-members"];
      expect(error(doc)).toBeNull();
    });

    it.each(OPTIONAL_WIDGETS)("accepts hiding %s", id => {
      const doc = clone();
      doc.layout.columns.side.push(id);
      doc.layout.hidden = [id];
      expect(error(doc)).toBeNull();
    });

    it("still rejects one placed twice", () => {
      const doc = clone();
      doc.layout.columns.main.push("todo");
      doc.layout.columns.side.push("todo");
      expect(error(doc)).toMatch(/more than once/);
    });

    it("keeps the whole document under the size cap with every widget added", () => {
      const doc = clone();
      doc.layout.columns.side.push(...OPTIONAL_WIDGETS);
      expect(Buffer.byteLength(JSON.stringify(doc), "utf8")).toBeLessThan(HOME_PREFERENCES_MAX_BYTES / 2);
    });
  });
});

describe("validateHomePreferences - tabs", () => {
  it("requires every tab exactly once", () => {
    const missing = clone();
    missing.tabs.order = ["All", "Today", "Overdue", "Upcoming", "NoDueDate"];
    expect(error(missing)).toMatch(/every tab exactly once/);

    const duplicated = clone();
    duplicated.tabs.order = ["All", "All", "Overdue", "Upcoming", "NoDueDate", "Pinned"];
    expect(error(duplicated)).toMatch(/every tab exactly once/);

    const unknown = clone();
    unknown.tabs.order = ["All", "Today", "Overdue", "Upcoming", "NoDueDate", "Bogus"];
    expect(error(unknown)).toMatch(/every tab exactly once/);
  });

  it("rejects unknown or repeated hidden tabs", () => {
    const unknown = clone();
    unknown.tabs.hidden = ["Bogus"];
    expect(error(unknown)).toMatch(/tabs.hidden/);

    const repeated = clone();
    repeated.tabs.hidden = ["Today", "Today"];
    expect(error(repeated)).toMatch(/tabs.hidden/);
  });

  it("rejects hiding every tab", () => {
    const doc = clone();
    doc.tabs.hidden = [...doc.tabs.order];
    expect(error(doc)).toMatch(/at least one tab/i);
  });
});

describe("validateHomePreferences - continueTabs", () => {
  it("accepts any subset of the toggle items hidden, as long as one stays", () => {
    for (const hidden of [[], ["projects"], ["tasks", "activity"], ["projects", "tasks", "time"]]) {
      const doc = clone();
      doc.continueTabs = { hidden };
      const result = validateHomePreferences(doc);
      expect(result.ok && result.value.continueTabs).toEqual({ hidden });
    }
  });

  it("rejects hiding every item", () => {
    const doc = clone();
    doc.continueTabs = { hidden: ["projects", "tasks", "activity", "time"] };
    expect(error(doc)).toMatch(/at least one continue tab/i);
  });

  it.each([
    [{ hidden: ["nope"] }],
    [{ hidden: ["tasks", "tasks"] }],
    [{ hidden: "tasks" }],
    [{ hidden: [1] }],
    [{}],
    [{ hidden: [], extra: 1 }],
    ["tasks"],
    [null],
    [[]],
  ])("rejects %p", continueTabs => {
    const doc = clone();
    doc.continueTabs = continueTabs;
    expect(error(doc)).toMatch(/continueTabs/);
  });
});

describe("validateHomePreferences - selections", () => {
  it.each([
    ["period", "month"],
    ["assignedGroup", 2],
    ["assignedGroup", "0"],
    ["pinnedAssignedGroup", 2],
    ["pinnedAssignedGroup", "x"],
    ["priorityTab", "Everything"],
  ])("rejects %s = %p", (field, value) => {
    const doc = clone();
    doc.selections[field] = value;
    expect(error(doc)).toMatch(new RegExp(`selections.${field}`));
  });

  it.each([
    [{ field: "created_at", order: "asc" }],
    [{ field: "name", order: "up" }],
    [{ field: "name" }],
    ["name"],
  ])("rejects sort %p", sort => {
    const doc = clone();
    doc.selections.sort = sort;
    expect(error(doc)).toMatch(/selections.sort/);
  });

  it("accepts every tab as the remembered tab and null as no sort", () => {
    for (const tab of ["All", "Today", "Overdue", "Upcoming", "NoDueDate", "Pinned"]) {
      const doc = clone();
      doc.selections.priorityTab = tab;
      expect(error(doc)).toBeNull();
    }
    const doc = clone();
    doc.selections.sort = null;
    expect(error(doc)).toBeNull();
  });
});
