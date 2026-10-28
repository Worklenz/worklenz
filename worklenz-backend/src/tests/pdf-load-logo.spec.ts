import dns from "dns";
import { EventEmitter } from "events";
import http from "http";
import { Readable } from "stream";
import { loadLogo, safeLookup } from "../shared/pdf/load-logo";
import { formatDate, htmlToPlainText } from "../shared/pdf/format";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

const fakeResponse = (statusCode: number, body: Buffer = Buffer.alloc(0), headers: Record<string, string> = {}) =>
  Object.assign(Readable.from([body]), { statusCode, headers });

describe("loadLogo", () => {
  let requestMock: jest.SpyInstance;
  const respondWith = (...responses: ReturnType<typeof fakeResponse>[]) => {
    requestMock.mockImplementation(((_url: unknown, _options: unknown, callback: (r: unknown) => void) => {
      const request = Object.assign(new EventEmitter(), { end: () => callback(responses.shift()) });
      return request;
    }) as unknown as typeof http.request);
  };
  // restoreMocks is on in jest.config, so the spy has to be created per test.
  beforeEach(() => {
    requestMock = jest.spyOn(http, "request");
  });

  it.each([
    "http://127.0.0.1/logo.png",
    "http://169.254.169.254/latest/meta-data",
    "http://localhost/logo.png",
    "http://[::1]/logo.png",
    "http://[::ffff:127.0.0.1]/logo.png",
    "http://[::ffff:7f00:1]/logo.png",
    "http://[::ffff:10.0.0.5]/logo.png",
    "http://[::ffff:a9fe:a9fe]/latest/meta-data",
    "http://[::127.0.0.1]/logo.png",
    "http://[64:ff9b::7f00:1]/logo.png",
    "http://[2002:7f00:1::]/logo.png",
    "http://[fd00::1]/logo.png",
  ])("rejects %s without connecting", async url => {
    expect(await loadLogo(url)).toBeNull();
    expect(requestMock).not.toHaveBeenCalled();
  });

  it.each([
    "http://10.0.0.5/secret.png",
    "http://[::ffff:7f00:1]/secret.png",
    "http://[::ffff:c0a8:101]/secret.png",
  ])("rejects a redirect to %s", async target => {
    respondWith(fakeResponse(302, Buffer.alloc(0), { location: target }));
    expect(await loadLogo("http://93.184.216.34/logo.png")).toBeNull();
    expect(requestMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when a body without Content-Length exceeds the limit", async () => {
    respondWith(fakeResponse(200, Buffer.alloc(3 * 1024 * 1024)));
    expect(await loadLogo("http://93.184.216.34/big.png")).toBeNull();
  });

  it("loads a valid PNG from a public address and pins the connection lookup", async () => {
    respondWith(fakeResponse(200, PNG));
    const logo = await loadLogo("http://93.184.216.34/logo.png");
    expect(logo?.equals(PNG)).toBe(true);
    expect(requestMock.mock.calls[0][1]).toMatchObject({ lookup: safeLookup });
  });
});

describe("safeLookup", () => {
  const resolveTo = (...addresses: string[]) =>
    jest.spyOn(dns, "lookup").mockImplementation(((_host: string, _opts: unknown, cb: (e: null, a: unknown) => void) =>
      cb(null, addresses.map(address => ({ address, family: address.includes(":") ? 6 : 4 })))) as unknown as typeof dns.lookup);
  const run = (all = false) =>
    new Promise<{ error: Error | null; result: unknown }>(resolve =>
      safeLookup("logo.example.com", { all }, ((error: Error | null, result: unknown) => resolve({ error, result })) as never)
    );

  it("returns a public address", async () => {
    resolveTo("93.184.216.34");
    expect(await run()).toEqual({ error: null, result: "93.184.216.34" });
  });

  it("blocks a hostname that resolves to a private or mapped-loopback address", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "::ffff:7f00:1", "fe80::1"]) {
      resolveTo(address);
      expect((await run()).error).toBeInstanceOf(Error);
    }
  });

  it("blocks when any resolved address is private", async () => {
    resolveTo("93.184.216.34", "192.168.1.5");
    expect((await run(true)).error).toBeInstanceOf(Error);
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
