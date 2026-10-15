const mockTxQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));
jest.mock("../services/client-portal-v2/notify.service", () => ({
  __esModule: true,
  notifyStaff: jest.fn(),
  notifyClientUsers: jest.fn(),
  getStaffRecipients: jest.fn(async () => []),
}));
jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {
    getInvitationByToken: jest.fn(),
    getClientUserOrganizations: jest.fn(),
    getClientPermissions: jest.fn(),
    generateClientToken: jest.fn(),
    updateOrganizationAccess: jest.fn(),
    toTokenOrganizations: jest.fn((organizations: unknown[]) => organizations),
  },
}));

import db from "../config/db";
import { EmailRequest, sendEmailEnhanced } from "../shared/email";
import {
  MAX_ATTEMPTS,
  MAX_CODES_PER_ADDRESS_PER_HOUR,
  MAX_CODES_PER_HOUR,
  RESEND_COOLDOWN_SECONDS,
  hashCode,
  maskEmail,
  requestSignInCode,
  verifySignInCode,
} from "../services/client-portal-v2/sign-in.service";
import TokenService from "../services/token-service";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db.pool as any).connect as jest.Mock;
const mockedSend = sendEmailEnhanced as jest.Mock;
const mockedEmailRequest = EmailRequest as unknown as jest.Mock;
const tokens = TokenService as unknown as Record<string, jest.Mock>;

type Handler = [RegExp, any];

const route = (mock: jest.Mock, handlers: Handler[]) =>
  mock.mockImplementation(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(String(sql)));
    if (!match) return createQueryResult([]);
    return typeof match[1] === "function" ? match[1]() : match[1];
  });

const sqlOf = (mock: jest.Mock) => mock.mock.calls.map(([sql]) => String(sql));
const ran = (mock: jest.Mock, pattern: RegExp) => sqlOf(mock).some(sql => pattern.test(sql));

const EMAIL = "alex@brandbase.com";
const TARGET = { contact_id: "cc-1", team_id: "team-1", client_id: "client-1", name: "Alex Morgan", team_name: "Ceydigital" };

const RECENT = /FROM client_login_codes\s+WHERE email = \$1\s*$/;
const TARGETS = /FROM client_contacts cc/;

/** What the throttle query reports: codes in the last hour (all IPs, this IP), and seconds since the newest from this IP. */
const recent = (lastHour: number, secondsSinceLast: number | null, lastHourFromIp = lastHour) =>
  createQueryResult([{ last_hour: lastHour, last_hour_ip: lastHourFromIp, seconds_since_last: secondsSinceLast }]);

const sentCode = (): string => {
  const subject = String(mockedEmailRequest.mock.calls[0][1]);
  return subject.split(" ")[0];
};

const storedHash = (): string => {
  const insert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_login_codes/.test(String(sql)));
  return (insert![1] as unknown[])[1] as string;
};

beforeEach(() => {
  mockedQuery.mockReset();
  mockTxQuery.mockReset();
  mockRelease.mockReset();
  mockedConnect.mockReset();
  mockedSend.mockReset();
  mockedEmailRequest.mockReset();
  Object.values(tokens).forEach(fn => fn.mockReset());
  mockedConnect.mockResolvedValue({ query: mockTxQuery, release: mockRelease });
  mockedSend.mockResolvedValue({ success: true });
  mockedQuery.mockResolvedValue(createQueryResult([]));
  mockTxQuery.mockResolvedValue(createQueryResult([]));
});

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("alex@brandbase.com")).toBe("a***@brandbase.com");
  });
});

describe("requestSignInCode: typed address", () => {
  it("emails a 6-digit code to an address that has access, and stores only a hash of it", async () => {
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([TARGET])]]);

    const result = await requestSignInCode({ email: "  Alex@Brandbase.com " });

    const code = sentCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(mockedEmailRequest.mock.calls[0][0]).toEqual([EMAIL]);
    expect(storedHash()).toBe(hashCode(EMAIL, code));
    expect(storedHash()).not.toContain(code);
    expect(result).toMatchObject({ email: EMAIL, masked_email: "a***@brandbase.com", expires_in_seconds: 600 });
  });

  it("uses a fixed email template: the team name the workspace owner chose never appears in it", async () => {
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([{ ...TARGET, team_name: "Evil <b>Bank</b> Support" }])]]);
    await requestSignInCode({ email: EMAIL, inviteToken: undefined });
    await new Promise(resolve => setImmediate(resolve));
    const html = String(mockedEmailRequest.mock.calls[0][2]);
    expect(html).toContain("your Worklenz client portal");
    expect(html).not.toContain("Evil");
    expect(html).not.toContain("Ceydigital");
  });

  it("retires the codes already on their way when it issues a new one", async () => {
    route(mockTxQuery, [[RECENT, recent(1, 300)], [TARGETS, createQueryResult([TARGET])]]);
    await requestSignInCode({ email: EMAIL });
    expect(ran(mockTxQuery, /UPDATE client_login_codes SET consumed_at = NOW\(\)/)).toBe(true);
  });

  it("answers an address without access exactly like one with access, sends nothing, and stores an unusable code", async () => {
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([])]]);

    const result = await requestSignInCode({ email: "nobody@example.com" });

    expect(mockedSend).not.toHaveBeenCalled();
    expect(storedHash()).toBe("-");
    expect(result).toMatchObject({ email: "nobody@example.com", expires_in_seconds: 600 });
  });

  it("does not reveal a failed email send for a typed address", async () => {
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([TARGET])]]);
    mockedSend.mockResolvedValue({ success: false, error: new Error("ses down") });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(requestSignInCode({ email: EMAIL })).resolves.toMatchObject({ email: EMAIL });
  });

  it.each(["", "not-an-email", "a@b"])("rejects %p before touching the database", async value => {
    await expect(requestSignInCode({ email: value })).rejects.toMatchObject({ status: 400, code: "INVALID_EMAIL" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("keeps the code already sent when asked again inside the cooldown", async () => {
    route(mockTxQuery, [[RECENT, recent(1, 10)], [TARGETS, createQueryResult([TARGET])]]);

    const result = await requestSignInCode({ email: EMAIL });

    expect(result.resend_after_seconds).toBe(RESEND_COOLDOWN_SECONDS - 10);
    expect(mockedSend).not.toHaveBeenCalled();
    expect(ran(mockTxQuery, /INSERT INTO client_login_codes/)).toBe(false);
  });

  it("stops after too many codes in an hour from one IP, for any address", async () => {
    route(mockTxQuery, [[RECENT, recent(MAX_CODES_PER_HOUR, 3000)]]);
    await expect(requestSignInCode({ email: EMAIL, ip: "203.0.113.9" })).rejects.toMatchObject({ status: 429, code: "TOO_MANY_CODES" });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("does not let other IPs use up this IP's budget, only the higher per-address ceiling", async () => {
    // 20 codes asked by other IPs, none by this one: the caller is still served.
    route(mockTxQuery, [[RECENT, recent(20, 3000, 0)], [TARGETS, createQueryResult([TARGET])]]);
    await expect(requestSignInCode({ email: EMAIL, ip: "198.51.100.7" })).resolves.toMatchObject({ email: EMAIL });
    expect(ran(mockTxQuery, /INSERT INTO client_login_codes/)).toBe(true);

    route(mockTxQuery, [[RECENT, recent(MAX_CODES_PER_ADDRESS_PER_HOUR, 3000, 0)]]);
    await expect(requestSignInCode({ email: EMAIL, ip: "198.51.100.7" })).rejects.toMatchObject({ code: "TOO_MANY_CODES" });
  });

  it("counts the budget and cooldown per IP and takes an advisory lock per address", async () => {
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([TARGET])]]);
    await requestSignInCode({ email: EMAIL, ip: "203.0.113.9" });
    const throttle = mockTxQuery.mock.calls.find(([sql]) => RECENT.test(String(sql)))!;
    expect(throttle[1]).toEqual([EMAIL, "203.0.113.9"]);
    expect(ran(mockTxQuery, /pg_advisory_xact_lock/)).toBe(true);
  });

  it("answers a known address without waiting for the email, so timing does not give it away", async () => {
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([TARGET])]]);
    let release: (value: { success: boolean }) => void = () => undefined;
    mockedSend.mockReturnValue(new Promise(resolve => (release = resolve)));
    await expect(requestSignInCode({ email: EMAIL })).resolves.toMatchObject({ email: EMAIL });
    release({ success: true });
  });
});

describe("requestSignInCode: invitation link", () => {
  it("sends the code to the address the link carries", async () => {
    tokens.getInvitationByToken.mockResolvedValue({ id: "inv-1", email: "Alex@Brandbase.com", company_name: "Brandbase" });
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([TARGET])]]);

    const result = await requestSignInCode({ inviteToken: "wli_abc" });

    expect(mockedEmailRequest.mock.calls[0][0]).toEqual([EMAIL]);
    expect(result).toMatchObject({ email: EMAIL, organization_name: "Brandbase" });
    const insert = mockTxQuery.mock.calls.find(([sql]) => /INSERT INTO client_login_codes/.test(String(sql)))!;
    expect((insert[1] as unknown[])[2]).toBe("inv-1");
  });

  it("says so when the link has expired or was replaced", async () => {
    tokens.getInvitationByToken.mockResolvedValue(null);
    await expect(requestSignInCode({ inviteToken: "wli_old" })).rejects.toMatchObject({ status: 404, code: "LINK_INVALID" });
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it("says so when the person no longer has access, instead of pretending a code was sent", async () => {
    tokens.getInvitationByToken.mockResolvedValue({ id: "inv-1", email: EMAIL });
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([])]]);
    await expect(requestSignInCode({ inviteToken: "wli_abc" })).rejects.toMatchObject({ status: 403, code: "ACCESS_UNAVAILABLE" });
  });

  it("reports a failed email send to the person holding the link", async () => {
    tokens.getInvitationByToken.mockResolvedValue({ id: "inv-1", email: EMAIL });
    route(mockTxQuery, [[RECENT, recent(0, null)], [TARGETS, createQueryResult([TARGET])]]);
    mockedSend.mockResolvedValue({ success: false, error: new Error("ses down") });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(requestSignInCode({ inviteToken: "wli_abc" })).rejects.toMatchObject({ status: 502, code: "EMAIL_FAILED" });
  });
});

describe("verifySignInCode", () => {
  const CODE = "482913";
  const ACTIVE = /SELECT id\s+FROM client_login_codes/;
  const CLAIM = /SET attempts = attempts \+ 1\s+WHERE id = \$1/;
  const activeRow = () => createQueryResult([{ id: "code-1" }]);
  /** The atomic claim answers with the stored hash and the attempt number it just took. */
  const claimRow = (overrides: Record<string, unknown> = {}) =>
    createQueryResult([{ code_hash: hashCode(EMAIL, CODE), attempts: 1, ...overrides }]);

  it.each(["", "12345", "1234567", "12345a"])("rejects the malformed code %p without a lookup", async value => {
    await expect(verifySignInCode({ email: EMAIL, code: value })).rejects.toMatchObject({ status: 400, code: "INVALID_CODE" });
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("rejects when there is no live code for the address", async () => {
    route(mockedQuery, [[/FROM client_login_codes/, createQueryResult([])]]);
    await expect(verifySignInCode({ email: EMAIL, code: CODE })).rejects.toMatchObject({ code: "INVALID_CODE" });
  });

  it("counts a wrong code and keeps the real one usable", async () => {
    route(mockedQuery, [[ACTIVE, activeRow()], [CLAIM, claimRow({ attempts: 2 })]]);

    await expect(verifySignInCode({ email: EMAIL, code: "000000" })).rejects.toMatchObject({ code: "INVALID_CODE" });

    const claim = mockedQuery.mock.calls.find(([sql]) => CLAIM.test(String(sql)))!;
    expect(claim[1]).toEqual(["code-1", MAX_ATTEMPTS]);
    expect(ran(mockedQuery, /SET consumed_at = NOW\(\) WHERE id = \$1/)).toBe(false);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("retires the code on the last allowed wrong guess", async () => {
    route(mockedQuery, [[ACTIVE, activeRow()], [CLAIM, claimRow({ attempts: MAX_ATTEMPTS })]]);
    await expect(verifySignInCode({ email: EMAIL, code: "000000" })).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(ran(mockedQuery, /SET consumed_at = NOW\(\) WHERE id = \$1 AND consumed_at IS NULL/)).toBe(true);
  });

  it("does not even compare once the attempts are used up (the claim matches no row)", async () => {
    route(mockedQuery, [[ACTIVE, activeRow()], [CLAIM, createQueryResult([])]]);
    await expect(verifySignInCode({ email: EMAIL, code: CODE })).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(ran(mockedQuery, /SET consumed_at = NOW\(\) WHERE id = \$1/)).toBe(false);
  });

  it("never compares more than MAX_ATTEMPTS guesses when requests race", async () => {
    // The database serialises the claim: only the first MAX_ATTEMPTS concurrent claims get a row.
    let claims = 0;
    let granted = 0;
    mockedQuery.mockImplementation(async (sql: string) => {
      if (ACTIVE.test(String(sql))) return activeRow();
      if (CLAIM.test(String(sql))) {
        claims += 1;
        if (claims > MAX_ATTEMPTS) return createQueryResult([]);
        granted += 1;
        return claimRow({ attempts: granted });
      }
      return createQueryResult([]);
    });
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () => verifySignInCode({ email: EMAIL, code: "000000" }))
    );
    expect(results.every(r => r.status === "rejected")).toBe(true);
    expect(claims).toBe(50);
    expect(granted).toBe(MAX_ATTEMPTS);
  });

  it("rejects a code that another request consumed first", async () => {
    route(mockedQuery, [
      [ACTIVE, activeRow()],
      [CLAIM, claimRow()],
      [/SET consumed_at = NOW\(\) WHERE id = \$1 AND consumed_at IS NULL/, createQueryResult([])],
    ]);
    await expect(verifySignInCode({ email: EMAIL, code: CODE })).rejects.toMatchObject({ code: "INVALID_CODE" });
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  describe("with the right code", () => {
    const ORG = { id: "o-1", name: "Ceydigital", teamId: "team-1", clientId: "client-1", isDefault: true };

    const arrange = ({ login = null as null | Record<string, unknown>, targets = [TARGET] as unknown[] } = {}) => {
      route(mockedQuery, [
        [ACTIVE, activeRow()],
        [CLAIM, claimRow()],
        [/SET consumed_at = NOW\(\) WHERE id = \$1 AND consumed_at IS NULL/, createQueryResult([{ id: "code-1" }])],
        [/SELECT name, company_name FROM clients/, createQueryResult([{ name: "Brandbase", company_name: "Brandbase Ltd" }])],
      ]);
      route(mockTxQuery, [
        [TARGETS, createQueryResult(targets as any[])],
        [/FROM client_users WHERE LOWER\(email\)/, createQueryResult(login ? [login] : [])],
        [/INSERT INTO client_users/, createQueryResult([{ id: "login-new", name: "Alex Morgan", role: "member", status: "active" }])],
      ]);
      tokens.getClientUserOrganizations.mockResolvedValue([ORG]);
      tokens.getClientPermissions.mockResolvedValue(["read:projects"]);
      tokens.generateClientToken.mockReturnValue("signed.jwt.token");
    };

    it("creates the login on first sign-in, activates the company user, accepts the invitation and returns a session", async () => {
      arrange();

      const session = await verifySignInCode({ email: " Alex@Brandbase.com ", code: ` ${CODE} ` });

      expect(ran(mockTxQuery, /INSERT INTO client_users/)).toBe(true);
      expect(ran(mockTxQuery, /UPDATE client_contacts\s+SET client_user_id = \$1/)).toBe(true);
      expect(ran(mockTxQuery, /UPDATE client_invitations\s+SET status = 'accepted'/)).toBe(true);
      expect(ran(mockTxQuery, /COMMIT/)).toBe(true);
      expect(tokens.generateClientToken).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "client-1", organizationId: "team-1", clientUserId: "login-new", email: EMAIL, type: "client" })
      );
      expect(session).toMatchObject({
        token: "signed.jwt.token",
        user: { id: "login-new", email: EMAIL, clientId: "client-1", organizationId: "team-1", clientName: "Brandbase" },
      });
      expect(session.expiresAt).toEqual(expect.any(String));
    });

    it("reuses an existing login instead of creating a second one", async () => {
      arrange({ login: { id: "login-1", name: "Alex", role: "member", status: "active" } });
      const session = await verifySignInCode({ email: EMAIL, code: CODE });
      expect(ran(mockTxQuery, /INSERT INTO client_users/)).toBe(false);
      expect(session.user.id).toBe("login-1");
    });

    it("refuses a login that was switched off at company level, and rolls back", async () => {
      arrange({ login: { id: "login-1", name: "Alex", role: "member", status: "inactive" } });
      await expect(verifySignInCode({ email: EMAIL, code: CODE })).rejects.toMatchObject({ code: "INVALID_CODE" });
      expect(ran(mockTxQuery, /ROLLBACK/)).toBe(true);
      expect(tokens.generateClientToken).not.toHaveBeenCalled();
    });

    it("refuses when access was removed after the code was sent", async () => {
      arrange({ targets: [] });
      await expect(verifySignInCode({ email: EMAIL, code: CODE })).rejects.toMatchObject({ code: "INVALID_CODE" });
      expect(tokens.generateClientToken).not.toHaveBeenCalled();
    });

    it("only puts organisations the person can still use into the session", async () => {
      arrange();
      tokens.getClientUserOrganizations.mockResolvedValue([
        { ...ORG, id: "o-2", teamId: "team-2", clientId: "client-disabled", isDefault: true },
        { ...ORG, isDefault: false },
      ]);

      const session = await verifySignInCode({ email: EMAIL, code: CODE });

      expect(session.user.organizations.map(org => org.clientId)).toEqual(["client-1"]);
      expect(session.user.clientId).toBe("client-1");
    });
  });
});
