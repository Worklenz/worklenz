import CsvProvider from "../services/import-providers/csv-provider";

describe("CsvProvider", () => {
  it("keeps preview/import parsing compatible for quoted multiline CSV and CRLF", async () => {
    const provider = new CsvProvider();
    const result = await provider.ingest({} as any, {
      csvText: 'Title,Status,Assignee,Due Date\r\n"Task, one",Doing,Alice,2026-09-09\r\n"Task two","Done","Bob",09/10/2026\r\n',
      delimiter: ",",
    });
    expect(result.fields.map((f: any) => f.source_field)).toEqual(["Title", "Status", "Assignee", "Due Date"]);
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks[0].title).toBe("Task, one");
    expect(result.tasks[0].raw).toEqual({
      Title: "Task, one",
      Status: "Doing",
      Assignee: "Alice",
      "Due Date": "2026-09-09",
    });
  });
});
