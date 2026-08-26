import {
  IsoDateStrategy,
  UsDateStrategy,
  EuDateStrategy,
  NaturalDateStrategy,
  UnixTimestampStrategy,
  parseDate,
  detectDateStrategy,feat(backend): implement RFC 4180 CSV parsing, date strategies, and safety gates
  stripBom,
  detectDelimiter,
  tokenizeCsv,
  isBinaryContent,
  suggestFieldMapping,
  autoMapHeaders,
  MAX_CSV_ROWS,
} from "../services/import-providers/csv-parser-strategies";

jest.unmock("../services/import-providers/csv-parser-strategies");


describe("IsoDateStrategy", () => {
  const strategy = new IsoDateStrategy();

  it("parses YYYY-MM-DD dates", () => {
    expect(strategy.canParse("2026-08-21")).toBe(true);
    const result = strategy.parse("2026-08-21");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
    expect(result!.getMonth()).toBe(7); // 0-indexed
    expect(result!.getDate()).toBe(21);
  });

  it("parses ISO 8601 with time component", () => {
    expect(strategy.canParse("2026-08-21T14:30:00Z")).toBe(true);
    const result = strategy.parse("2026-08-21T14:30:00Z");
    expect(result).toBeInstanceOf(Date);
  });

  it("rejects non-ISO formats", () => {
    expect(strategy.canParse("08/21/2026")).toBe(false);
    expect(strategy.canParse("21 Aug 2026")).toBe(false);
    expect(strategy.canParse("not a date")).toBe(false);
  });
});

describe("UsDateStrategy", () => {
  const strategy = new UsDateStrategy();

  it("parses MM/DD/YYYY dates", () => {
    expect(strategy.canParse("08/21/2026")).toBe(true);
    const result = strategy.parse("08/21/2026");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(7);
    expect(result!.getDate()).toBe(21);
    expect(result!.getFullYear()).toBe(2026);
  });

  it("parses MM-DD-YYYY dates", () => {
    expect(strategy.canParse("12-25-2026")).toBe(true);
    const result = strategy.parse("12-25-2026");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(11);
    expect(result!.getDate()).toBe(25);
  });

  it("rejects invalid months", () => {
    expect(strategy.canParse("13/01/2026")).toBe(false);
    expect(strategy.canParse("00/15/2026")).toBe(false);
  });
});

describe("EuDateStrategy", () => {
  const strategy = new EuDateStrategy();

  it("parses DD/MM/YYYY dates", () => {
    expect(strategy.canParse("25/12/2026")).toBe(true);
    const result = strategy.parse("25/12/2026");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(25);
    expect(result!.getMonth()).toBe(11);
    expect(result!.getFullYear()).toBe(2026);
  });

  it("parses DD-MM-YYYY dates", () => {
    expect(strategy.canParse("01-06-2026")).toBe(true);
    const result = strategy.parse("01-06-2026");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(1);
    expect(result!.getMonth()).toBe(5);
  });

  it("rejects invalid months", () => {
    expect(strategy.canParse("15/13/2026")).toBe(false);
  });
});

describe("NaturalDateStrategy", () => {
  const strategy = new NaturalDateStrategy();

  it("parses '21 Aug 2026' format", () => {
    expect(strategy.canParse("21 Aug 2026")).toBe(true);
    const result = strategy.parse("21 Aug 2026");
    expect(result).toBeInstanceOf(Date);
  });

  it("parses 'August 21, 2026' format", () => {
    expect(strategy.canParse("August 21, 2026")).toBe(true);
    const result = strategy.parse("August 21, 2026");
    expect(result).toBeInstanceOf(Date);
  });

  it("rejects plain numbers", () => {
    expect(strategy.canParse("12345")).toBe(false);
  });
});

describe("UnixTimestampStrategy", () => {
  const strategy = new UnixTimestampStrategy();

  it("parses 10-digit unix timestamps (seconds)", () => {
    expect(strategy.canParse("1787500800")).toBe(true);
    const result = strategy.parse("1787500800");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it("parses 13-digit unix timestamps (milliseconds)", () => {
    expect(strategy.canParse("1787500800000")).toBe(true);
    const result = strategy.parse("1787500800000");
    expect(result).toBeInstanceOf(Date);
  });

  it("rejects non-numeric strings", () => {
    expect(strategy.canParse("abc")).toBe(false);
    expect(strategy.canParse("2026-08-21")).toBe(false);
  });
});

describe("parseDate (facade)", () => {
  it("parses ISO dates", () => {
    const result = parseDate("2026-08-21");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2026);
  });

  it("parses US dates", () => {
    const result = parseDate("08/21/2026");
    expect(result).toBeInstanceOf(Date);
  });

  it("returns null for empty strings", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("   ")).toBeNull();
  });

  it("returns null for unparseable values", () => {
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("detectDateStrategy", () => {
  it("detects ISO strategy for ISO-formatted samples", () => {
    const samples = ["2026-01-15", "2026-03-22", "2026-07-01"];
    const result = detectDateStrategy(samples);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("ISO 8601");
  });

  it("returns null for non-date data", () => {
    const samples = ["hello", "world", "foo"];
    const result = detectDateStrategy(samples);
    expect(result).toBeNull();
  });
});

describe("stripBom", () => {
  it("removes UTF-8 BOM from the start of text", () => {
    const withBom = "\uFEFFTitle,Status,Assignee";
    expect(stripBom(withBom)).toBe("Title,Status,Assignee");
  });

  it("leaves text without BOM unchanged", () => {
    const noBom = "Title,Status,Assignee";
    expect(stripBom(noBom)).toBe(noBom);
  });
});

describe("detectDelimiter", () => {
  it("detects comma delimiter", () => {
    const csv = "Title,Status,Assignee\nTask 1,Open,Alice\nTask 2,Done,Bob";
    expect(detectDelimiter(csv)).toBe(",");
  });

  it("detects semicolon delimiter", () => {
    const csv = "Title;Status;Assignee\nTask 1;Open;Alice\nTask 2;Done;Bob";
    expect(detectDelimiter(csv)).toBe(";");
  });

  it("detects tab delimiter", () => {
    const csv = "Title\tStatus\tAssignee\nTask 1\tOpen\tAlice";
    expect(detectDelimiter(csv)).toBe("\t");
  });

  it("defaults to comma for empty input", () => {
    expect(detectDelimiter("")).toBe(",");
  });
});

describe("tokenizeCsv", () => {
  it("parses simple comma-delimited CSV", () => {
    const csv = "Title,Status\nTask 1,Open\nTask 2,Done";
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["Title", "Status"]);
    expect(rows[1]).toEqual(["Task 1", "Open"]);
    expect(rows[2]).toEqual(["Task 2", "Done"]);
  });

  it("handles quoted fields containing commas", () => {
    const csv = 'Title,Description\n"Task A","Design, implement, and test"\nTask B,Simple';
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1][0]).toBe("Task A");
    expect(rows[1][1]).toBe("Design, implement, and test");
  });

  it("handles escaped double quotes within quoted fields", () => {
    const csv = 'Name,Note\n"He said ""Hello""","OK"';
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('He said "Hello"');
    expect(rows[1][1]).toBe("OK");
  });

  it("handles multiline text within quoted fields", () => {
    const csv = 'Title,Description\n"Task A","Line 1\nLine 2"\nTask B,Simple';
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1][1]).toContain("Line 1");
    expect(rows[1][1]).toContain("Line 2");
  });

  it("handles CRLF line endings", () => {
    const csv = "Title,Status\r\nTask 1,Open\r\nTask 2,Done";
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(["Task 1", "Open"]);
  });

  it("strips UTF-8 BOM", () => {
    const csv = "\uFEFFTitle,Status\nTask 1,Open";
    const rows = tokenizeCsv(csv);
    expect(rows[0][0]).toBe("Title"); // Not "\uFEFFTitle"
  });

  it("handles semicolon-delimited CSV", () => {
    const csv = "Title;Status;Assignee\nTask 1;Open;Alice";
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(["Title", "Status", "Assignee"]);
    expect(rows[1]).toEqual(["Task 1", "Open", "Alice"]);
  });

  it("handles empty rows gracefully", () => {
    const csv = "Title,Status\n\nTask 1,Open\n\n";
    const rows = tokenizeCsv(csv);
    expect(rows).toHaveLength(2); // header + 1 data row
    expect(rows[0]).toEqual(["Title", "Status"]);
    expect(rows[1]).toEqual(["Task 1", "Open"]);
  });
});


describe("isBinaryContent", () => {
  it("detects PDF files", () => {
    expect(isBinaryContent("%PDF-1.4 some binary data")).toBe(true);
  });

  it("passes plain CSV text", () => {
    expect(isBinaryContent("Title,Status\nTask 1,Open")).toBe(false);
  });
});



describe("suggestFieldMapping", () => {
  it("maps 'Task Name' to 'key'", () => {
    expect(suggestFieldMapping("Task Name")).toBe("key");
  });

  it("maps 'title' to 'key'", () => {
    expect(suggestFieldMapping("title")).toBe("key");
  });

  it("maps 'Assigned To' to 'assignees'", () => {
    expect(suggestFieldMapping("Assigned To")).toBe("assignees");
  });

  it("maps 'Due Date' to 'dueDate'", () => {
    expect(suggestFieldMapping("Due Date")).toBe("dueDate");
  });

  it("maps 'Priority' to 'priority'", () => {
    expect(suggestFieldMapping("Priority")).toBe("priority");
  });

  it("maps 'Description' to 'description'", () => {
    expect(suggestFieldMapping("Description")).toBe("description");
  });

  it("returns null for unknown headers", () => {
    expect(suggestFieldMapping("Custom Column XYZ")).toBeNull();
  });
});

describe("autoMapHeaders", () => {
  it("auto-maps common headers to WorkLenz fields", () => {
    const headers = ["Task Name", "Status", "Assignee", "Due Date", "Priority"];
    const result = autoMapHeaders(headers);
    expect(result["Task Name"]).toBe("key");
    expect(result["Status"]).toBe("status");
    expect(result["Assignee"]).toBe("assignees");
    expect(result["Due Date"]).toBe("dueDate");
    expect(result["Priority"]).toBe("priority");
  });

  it("sets null for unrecognized headers", () => {
    const headers = ["Custom Field", "Random Column"];
    const result = autoMapHeaders(headers);
    expect(result["Custom Field"]).toBeNull();
    expect(result["Random Column"]).toBeNull();
  });

  it("prevents duplicate target assignments", () => {
    // Both 'Title' and 'Name' would map to 'key', but only the first should win
    const headers = ["Title", "Name", "Status"];
    const result = autoMapHeaders(headers);
    expect(result["Title"]).toBe("key");
    expect(result["Name"]).toBeNull(); // already taken
    expect(result["Status"]).toBe("status");
  });
});
