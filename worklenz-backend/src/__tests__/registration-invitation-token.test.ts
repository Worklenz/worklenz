import { createRegistrationInvitationToken, verifyRegistrationInvitationToken } from "../shared/registration-invitation-token";

describe("registration invitation tokens", () => {
  const token = createRegistrationInvitationToken("team", "member", "Person@Example.com", "invite-1");
  it("accepts the invited email, team and member", () => {
    expect(verifyRegistrationInvitationToken(token, "team", "member", " person@example.com ", "invite-1")).toBe(true);
  });
  it.each([
    ["other", "member", "person@example.com"],
    ["team", "other", "person@example.com"],
    ["team", "member", "other@example.com"],
  ])("rejects a changed team, member or email", (team, member, email) => {
    expect(verifyRegistrationInvitationToken(token, team, member, email, "invite-1")).toBe(false);
  });
  it("invalidates an old code when the invitation is replaced", () => {
    const replacement = createRegistrationInvitationToken("team", "member", "person@example.com", "invite-2");
    expect(replacement).not.toBe(token);
    expect(verifyRegistrationInvitationToken(token, "team", "member", "person@example.com", "invite-2")).toBe(false);
    expect(verifyRegistrationInvitationToken(replacement, "team", "member", "person@example.com", "invite-2")).toBe(true);
  });
  it("rejects missing and forged tokens", () => {
    expect(verifyRegistrationInvitationToken(undefined, "team", "member", "person@example.com", "invite-1")).toBe(false);
    expect(verifyRegistrationInvitationToken(`${token}x`, "team", "member", "person@example.com", "invite-1")).toBe(false);
  });
});
