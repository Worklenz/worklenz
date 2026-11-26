import dns from "dns";
import { safePublicLookup } from "../shared/ssrf-guard";

const resolveTo = (...addresses: string[]) =>
  jest.spyOn(dns, "lookup").mockImplementation(((_host: string, _options: unknown, callback: (error: null, addresses: unknown) => void) =>
    callback(null, addresses.map(address => ({ address, family: address.includes(":") ? 6 : 4 })))) as unknown as typeof dns.lookup);

const lookup = (all = false) => new Promise<{ error: Error | null; result: unknown }>(resolve => {
  safePublicLookup("jira.example.com", { all }, ((error: Error | null, result: unknown) => resolve({ error, result })) as never);
});

describe("public DNS lookup", () => {
  it("returns a public address for the actual connection", async () => {
    resolveTo("93.184.216.34");
    expect(await lookup()).toEqual({ error: null, result: "93.184.216.34" });
  });
  it.each(["127.0.0.1", "169.254.169.254", "10.0.0.1", "::ffff:7f00:1", "fe80::1"])(
    "blocks a hostname resolving to %s", async address => {
      resolveTo(address);
      expect((await lookup()).error).toBeInstanceOf(Error);
    }
  );
  it("rejects mixed public and private DNS answers", async () => {
    resolveTo("93.184.216.34", "192.168.1.5");
    expect((await lookup(true)).error).toBeInstanceOf(Error);
  });
});
