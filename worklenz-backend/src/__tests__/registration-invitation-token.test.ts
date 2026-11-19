import { createRegistrationInvitationToken, verifyRegistrationInvitationToken } from "../shared/registration-invitation-token";

describe("registration invitation tokens", () => {
  const token = createRegistrationInvitationToken("team", "member", "Person@Example.com");
  it("accepts the invited email, team and member", () => {
    expect(verifyRegistrationInvitationToken(token, "team", "member", " person@example.com ")).toBe(true);
  });
  it.each([
    ["other", "member", "person@example.com"],
    ["team", "other", "person@example.com"],
    ["team", "member", "other@example.com"],
  ])("rejects a changed team, member or email", (team, member, email) => {
    expect(verifyRegistrationInvitationToken(token, team, member, email)).toBe(false);
  });
  it("rejects missing and forged tokens", () => {
    expect(verifyRegistrationInvitationToken(undefined, "team", "member", "person@example.com")).toBe(false);
    expect(verifyRegistrationInvitationToken(`${token}x`, "team", "member", "person@example.com")).toBe(false);
  });
});
