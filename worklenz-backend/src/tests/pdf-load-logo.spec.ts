import { loadLogo } from "../shared/pdf/load-logo";
import { formatDate, htmlToPlainText } from "../shared/pdf/format";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("loadLogo", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as { fetch: unknown }).fetch = fetchMock;
  });

  it("rejects private and loopback addresses without fetching", async () => {
    expect(await loadLogo("http://127.0.0.1/logo.png")).toBeNull();
    expect(await loadLogo("http://169.254.169.254/latest/meta-data")).toBeNull();
    expect(await loadLogo("http://localhost/logo.png")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a redirect to an internal host", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "http://10.0.0.5/secret.png" } })
    );
    expect(await loadLogo("http://93.184.216.34/logo.png")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when a body without Content-Length exceeds the limit", async () => {
    fetchMock.mockResolvedValueOnce(new Response(Buffer.alloc(3 * 1024 * 1024), { status: 200 }));
    expect(await loadLogo("http://93.184.216.34/big.png")).toBeNull();
  });

  it("loads a valid PNG from a public address", async () => {
    fetchMock.mockResolvedValueOnce(new Response(PNG, { status: 200 }));
    const logo = await loadLogo("http://93.184.216.34/logo.png");
    expect(logo?.equals(PNG)).toBe(true);
  });
});

describe("PDF text helpers", () => {
  it("keeps a date-only value on the same calendar day", () => {
    expect(formatDate("2026-02-15")).toBe("February 15, 2026");
  });

  it("strips notes markup into plain text", () => {
    const text = htmlToPlainText("<p>Pay &amp; go</p><ul><li>One</li><li>Two</li></ul>");
    expect(text).not.toMatch(/<|>/);
    expect(text).toContain("Pay & go");
    expect(text).toContain("• One");
  });
});
