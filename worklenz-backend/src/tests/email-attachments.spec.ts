import {
  MAX_EMAIL_ATTACHMENT_BYTES,
  normalizeEmailAttachments,
} from "../shared/email";

describe("normalizeEmailAttachments", () => {
  it("returns empty list when none provided", () => {
    expect(normalizeEmailAttachments(undefined)).toEqual({ attachments: [] });
    expect(normalizeEmailAttachments([])).toEqual({ attachments: [] });
  });

  it("normalizes string content to a Buffer", () => {
    const result = normalizeEmailAttachments([
      {
        filename: "report.csv",
        content: "a,b\n1,2",
        contentType: "text/csv",
      },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0].filename).toBe("report.csv");
    expect(Buffer.isBuffer(result.attachments[0].content)).toBe(true);
    expect(result.attachments[0].content.toString("utf8")).toBe("a,b\n1,2");
  });

  it("rejects missing filename", () => {
    const result = normalizeEmailAttachments([
      { filename: "  ", content: Buffer.from("x") },
    ]);
    expect(result.error).toMatch(/filename/i);
    expect(result.attachments).toHaveLength(0);
  });

  it("rejects oversized total payload", () => {
    const big = Buffer.alloc(MAX_EMAIL_ATTACHMENT_BYTES + 1, 1);
    const result = normalizeEmailAttachments([
      { filename: "big.bin", content: big },
    ]);
    expect(result.error).toMatch(/limit/i);
  });
});
