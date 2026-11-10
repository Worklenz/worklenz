import dotenv from "dotenv";
import { Pool } from "pg";
import { listPreviewUsers } from "../services/client-portal-v2/preview.service";
import { subjectProjectsSql } from "../services/client-portal-v2/scope";

dotenv.config();

const hasDatabase = Boolean(process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER);
const integration = hasDatabase ? describe : describe.skip;

/**
 * listPreviewUsers binds only the team id. subjectProjectsSql must keep the caller's
 * expressions (u.id, u.client_id, $1); hardcoding $2 and $3 makes PostgreSQL reject the query.
 */
integration("preview user query against PostgreSQL", () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
    });
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("accepts the preview-user query when only the team id is supplied", async () => {
    const result = await listPreviewUsers(
      { query: (text, params) => pool.query(text, params) },
      "00000000-0000-0000-0000-000000000000"
    );

    expect(result.users).toEqual([]);
    expect(result.has_client_users).toBe(false);
  });

  it("hides a project from the subject query only while archived_for_team is set", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const project = await client.query(
        `SELECT p.id, p.client_id, p.team_id, cc.id AS contact_id
           FROM projects p
           JOIN project_client_settings pcs ON pcs.project_id = p.id AND pcs.portal_enabled IS TRUE
           JOIN client_contacts cc ON cc.client_id = p.client_id AND cc.team_id = p.team_id AND cc.role = 'admin'
          LIMIT 1`
      );
      const row = project.rows[0];
      expect(row).toBeTruthy();

      const visible = subjectProjectsSql("$1", "$2", "$3");
      const params = [row.contact_id, row.client_id, row.team_id, row.id];
      await client.query(`UPDATE projects SET archived_for_team = FALSE WHERE id = $1`, [row.id]);
      const open = await client.query(`SELECT id FROM (${visible}) s WHERE s.id = $4`, params);
      await client.query(`UPDATE projects SET archived_for_team = TRUE WHERE id = $1`, [row.id]);
      const closed = await client.query(`SELECT id FROM (${visible}) s WHERE s.id = $4`, params);

      expect(open.rows.map(item => item.id)).toContain(row.id);
      expect(closed.rows).toEqual([]);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
