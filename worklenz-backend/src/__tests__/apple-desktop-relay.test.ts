import { appleDesktopCallback, buildAppleDesktopRedirect } from "../shared/apple-desktop-relay";

const STATE = "54321.AbCdEf0123456789_-~xyzXYZ";
const TOKEN = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlLXZhbHVl";

describe("buildAppleDesktopRedirect", () => {
  it("sends the ID token and state back to the app on this computer", () => {
    const url = new URL(buildAppleDesktopRedirect({ state: STATE, id_token: TOKEN, code: "ignored" })!);
    expect(url.origin).toBe("http://127.0.0.1:54321");
    expect(url.searchParams.get("id_token")).toBe(TOKEN);
    expect(url.searchParams.get("state")).toBe("AbCdEf0123456789_-~xyzXYZ");
    expect(url.searchParams.has("code")).toBe(false);
  });

  it("passes on a cancel as an error", () => {
    const url = new URL(buildAppleDesktopRedirect({ state: STATE, error: "user_cancelled_authorize" })!);
    expect(url.searchParams.get("error")).toBe("user_cancelled_authorize");
    expect(url.searchParams.has("id_token")).toBe(false);
  });

  it("cleans and limits the error text", () => {
    const url = new URL(buildAppleDesktopRedirect({ state: STATE, error: "<script>alert(1)</script>".repeat(10) })!);
    expect(url.searchParams.get("error")).toMatch(/^[\w.-]{1,64}$/);
  });

  it("reports an unusable response when there is neither a token nor an error", () => {
    expect(new URL(buildAppleDesktopRedirect({ state: STATE, id_token: "not-a-jwt" })!).searchParams.get("error")).toBe(
      "invalid_response",
    );
    expect(new URL(buildAppleDesktopRedirect({ state: STATE })!).searchParams.get("error")).toBe("invalid_response");
  });

  it.each([
    ["no state", {}],
    ["a state that is not a string", { state: 54321 }],
    ["a missing port", { state: "AbCdEf0123456789_-~xyzXYZ" }],
    ["a privileged port", { state: "80.AbCdEf0123456789_-~xyzXYZ" }],
    ["a port above the range", { state: "70000.AbCdEf0123456789_-~xyzXYZ" }],
    ["a host smuggled into the state", { state: "5000@evil.com.AbCdEf0123456789_-~xyzXYZ" }],
    ["a short token", { state: "54321.short" }],
  ])("refuses %s", (_name, body) => {
    expect(buildAppleDesktopRedirect({ ...body, id_token: TOKEN })).toBeNull();
  });

  it("refuses a body that is missing", () => {
    expect(buildAppleDesktopRedirect(undefined)).toBeNull();
  });
});

describe("appleDesktopCallback", () => {
  const createRes = () => {
    const res: any = {};
    res.setHeader = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.type = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
  };

  it("redirects with the token kept out of caches", () => {
    const res = createRes();
    appleDesktopCallback({ body: { state: STATE, id_token: TOKEN } } as any, res);
    expect(res.redirect).toHaveBeenCalledWith(303, expect.stringContaining("http://127.0.0.1:54321/?"));
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer");
  });

  it("answers 400 and never redirects when the state is wrong", () => {
    const res = createRes();
    appleDesktopCallback({ body: { state: "x", id_token: TOKEN } } as any, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
