jest.unmock("../services/imports/value-utils");
jest.unmock("../services/imports/field-mapping");
jest.unmock("../services/imports/resolvers");
jest.unmock("slugify");
jest.unmock("path");

import {
  isDateSample,
  isIdentifierColumnName,
  parseImportDate,
  safeDate,
} from "../services/imports/value-utils";
import { parseDateValue } from "../services/imports/resolvers";
import { inferColumnConfig } from "../services/imports/field-mapping";
import { CustomColumnPlan } from "../services/imports/types";

const makePlan = (
  name: string,
  samples: string[],
  key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "custom-column",
): CustomColumnPlan => ({
  key,
  name,
  sourceField: name,
  samples: new Set(samples),
});

describe("isDateSample", () => {
  it("rejects issue-key style identifiers that Date.parse treats as dates", () => {
    expect(isDateSample("JAT-1")).toBe(false);
    expect(isDateSample("JAT-2")).toBe(false);
    expect(isDateSample("JAT-3")).toBe(false);
    expect(isDateSample("PROJ-123")).toBe(false);
    expect(isDateSample("MAY-1")).toBe(false);
    expect(isDateSample("ID-1")).toBe(false);
    expect(Number.isFinite(Date.parse("JAT-1"))).toBe(true);
  });

  it("rejects ambiguous numeric fragments", () => {
    expect(isDateSample("1-2")).toBe(false);
    expect(isDateSample("2021")).toBe(false);
    expect(isDateSample("44317")).toBe(false);
    expect(isDateSample("hello")).toBe(false);
  });

  it("accepts real CSV date formats", () => {
    expect(isDateSample("2021-05-01")).toBe(true);
    expect(isDateSample("2025-03-03 00:00:00")).toBe(true);
    expect(isDateSample("2025-03-03T00:00:00.000Z")).toBe(true);
    expect(isDateSample("3/3/2025")).toBe(true);
    expect(isDateSample("5/1/2021 12:00 AM")).toBe(true);
    expect(isDateSample("May 01, 2021")).toBe(true);
    expect(isDateSample("01-May-2021")).toBe(true);
    expect(isDateSample("03/Mar/25 12:00 PM")).toBe(true);
  });

  it("accepts timezone suffixes, weekday prefixes, and unpadded ISO dates", () => {
    expect(isDateSample("2025-03-03 10:00:00 UTC")).toBe(true);
    expect(isDateSample("2025-03-03 10:00:00 +05:30")).toBe(true);
    expect(isDateSample("2025-03-03T10:00:00.000+0000")).toBe(true);
    expect(isDateSample("Mon, 03 Mar 2025 10:00:00 GMT")).toBe(true);
    expect(isDateSample("Mon Mar 03 2025 10:00:00 GMT+0530 (India Standard Time)")).toBe(true);
    expect(isDateSample("Monday, March 3, 2025")).toBe(true);
    expect(isDateSample("2025-3-3")).toBe(true);
  });
});

describe("parseImportDate", () => {
  it("does not convert task IDs into dates", () => {
    expect(parseImportDate("JAT-1")).toBeNull();
    expect(parseImportDate("PROJ-123")).toBeNull();
    expect(parseImportDate("MAY-1")).toBeNull();
    expect(parseImportDate("  ")).toBeNull();
  });

  it("parses ISO dates", () => {
    const parsed = parseImportDate("2021-05-01");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed?.toISOString().startsWith("2021-05-01")).toBe(true);
  });

  it.each([
    "2025-03-03T10:00:00.000+0000",
    "03/Mar/25 12:00 PM",
    "2025-03-03 10:00:00 UTC",
    "2025-03-03 10:00:00 +05:30",
    "Mon, 03 Mar 2025 10:00:00 GMT",
    "Mon Mar 03 2025 10:00:00 GMT+0530",
    "Monday, March 3, 2025",
    "2025-3-3",
  ])("keeps parsing source date format %s", (value) => {
    expect(parseImportDate(value)).toBeInstanceOf(Date);
  });
});

describe("core import dates (completed, comments, worklogs)", () => {
  it("still recognizes completed dates in non-ISO formats", () => {
    expect(parseDateValue("2025-03-03 10:00:00 UTC")).toBeInstanceOf(Date);
    expect(parseDateValue("Mon, 03 Mar 2025 10:00:00 GMT")).toBeInstanceOf(Date);
  });

  it("keeps comment and worklog timestamps from Jira", () => {
    expect(safeDate("2025-03-03T10:00:00.000+0000")?.toISOString()).toBe(
      "2025-03-03T10:00:00.000Z",
    );
  });

  it("does not treat an issue key as a completed date", () => {
    expect(parseDateValue("JAT-1")).toBeNull();
  });
});

describe("inferColumnConfig", () => {
  it("keeps a custom ID column as text even when values look date-like to Date.parse", () => {
    const config = inferColumnConfig(makePlan("ID", ["JAT-1", "JAT-2", "JAT-3"], "id"));
    expect(config.fieldType).toBe("text");
  });

  it("keeps identifier-named columns as text", () => {
    expect(isIdentifierColumnName("Issue Key", "issue-key")).toBe(true);
    expect(
      inferColumnConfig(makePlan("Issue ID", ["ABC-10", "ABC-11"], "issue-id")).fieldType,
    ).toBe("text");
    expect(
      inferColumnConfig(makePlan("Task ID", ["T-1", "T-2"], "task-id")).fieldType,
    ).toBe("text");
  });

  it("still infers real date columns as dates", () => {
    const config = inferColumnConfig(
      makePlan("Due Date", ["2025-03-03 00:00:00", "2025-03-04 00:00:00"], "due-date"),
    );
    expect(config.fieldType).toBe("date");
  });

  it("does not infer untitled identifier values as dates", () => {
    const config = inferColumnConfig(
      makePlan("External Ref", ["JAT-1", "JAT-2", "JAT-3"], "external-ref"),
    );
    expect(config.fieldType).toBe("text");
  });
});
