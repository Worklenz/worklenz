import { pathWithoutQuery } from "../shared/path-without-query";

describe("pathWithoutQuery", () => {
  it("leaves a plain path alone", () => {
    expect(pathWithoutQuery("/api/v1/clients/portal/v2/organizations")).toBe("/api/v1/clients/portal/v2/organizations");
  });

  it("drops the query string and the fragment", () => {
    expect(pathWithoutQuery("/api/v1/clients?search=a")).toBe("/api/v1/clients");
    expect(pathWithoutQuery("/api/v1/clients#section")).toBe("/api/v1/clients");
  });

  it("cannot be made to look like an exempt route by something in the query string", () => {
    const smuggled = pathWithoutQuery("/api/v1/clients/portal/v2/organizations/abc?x=/client-portal/auth/login");
    expect(smuggled.includes("/client-portal/")).toBe(false);
    expect(smuggled.startsWith("/api/client-portal")).toBe(false);

    expect(pathWithoutQuery("/api/v1/projects?next=/webhook/directpay/").includes("/webhook/")).toBe(false);
  });

  it("still recognises a real client portal route", () => {
    expect(pathWithoutQuery("/api/client-portal/auth/otp/request?x=1").startsWith("/api/client-portal")).toBe(true);
  });
});
