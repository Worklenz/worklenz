jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/email", () => ({ __esModule: true, sendEmail: jest.fn(), sendEmailEnhanced: jest.fn(), EmailRequest: jest.fn() }));
jest.mock("../cron_jobs/helpers", () => ({ __esModule: true, getClientPortalBaseUrl: () => "https://portal.test" }));

import { listPreviewUsers } from "../services/client-portal-v2/preview.service";
import { subjectProjectsSql } from "../services/client-portal-v2/scope";
import { createQueryResult } from "./utils/db-mock";

describe("preview users", () => {
  it("uses the client project access gate and retains active and invited users", async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes("AS has_client_users")) return createQueryResult([{ has_client_users: true }]);
      return createQueryResult([
        { id: "active", name: "Active", email: "active@example.com", client_id: "client", organization_name: "Client", role: "admin", status_key: "active" },
        { id: "invited", name: "Invited", email: "invited@example.com", client_id: "client", organization_name: "Client", role: "member", status_key: "invited" },
      ]);
    });

    const result = await listPreviewUsers({ query }, "team");

    expect(result.users.map(user => [user.id, user.status])).toEqual([["active", "active"], ["invited", "invited"]]);
    expect(result.has_client_users).toBe(true);
    const selection = query.mock.calls.find(([sql]) => sql.includes("ORDER BY u.organization_name"));
    const gate = subjectProjectsSql("u.id", "u.client_id", "$1");
    expect(gate).toContain("p.client_id = u.client_id");
    expect(gate).toContain("p.team_id = $1");
    expect(gate).toContain("adm.id = u.id");
    expect(gate).not.toMatch(/\$2|\$3/);
    expect(selection?.[0]).toContain(`EXISTS (${gate})`);
    expect(selection?.[1]).toEqual(["team"]);
  });
});
