import { Client } from "pg";

interface Migration {
  up(builder: { sql(statement: string): void }): void;
  down(builder: { sql(statement: string): void }): void;
}

const migration: Migration = require("../../database/pg-migrations/1793923200000_add_project_reference");
const integration = process.env.TEST_PROJECT_REFERENCE_DATABASE_URL ? describe : describe.skip;

// Use a disposable database: the migration creates functions and modifies projects.
integration("project reference migration", () => {
  let client: Client;
  let up: string;
  let down: string;
  const team = "00000000-0000-0000-0000-000000000001";
  const otherTeam = "00000000-0000-0000-0000-000000000002";

  beforeAll(async () => {
    const statements: string[] = [];
    migration.up({ sql: statement => statements.push(statement) });
    up = statements.join("\n");
    statements.length = 0;
    migration.down({ sql: statement => statements.push(statement) });
    down = statements.join("\n");
    client = new Client({ connectionString: process.env.TEST_PROJECT_REFERENCE_DATABASE_URL });
    await client.connect();
  });

  beforeEach(async () => {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE projects (id uuid PRIMARY KEY, team_id uuid NOT NULL, name text NOT NULL);
      CREATE FUNCTION create_project(body json) RETURNS json LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO projects (id, team_id, name)
          VALUES ((body->>'id')::uuid, (body->>'team_id')::uuid, body->>'name');
        RETURN json_build_object('id', body->>'id');
      END $$;
      CREATE FUNCTION update_project(body json) RETURNS json LANGUAGE plpgsql AS $$
      BEGIN
        UPDATE projects SET name = body->>'name'
          WHERE id = (body->>'id')::uuid AND team_id = (body->>'team_id')::uuid;
        RETURN json_build_object('id', body->>'id');
      END $$;
    `);
    await client.query(up);
  });
  afterEach(async () => { await client.query("ROLLBACK"); });
  afterAll(async () => { await client.end(); });

  const create = (id: string, teamId: string, reference?: string) => client.query(
    "SELECT create_project_with_reference($1)",
    [JSON.stringify({ id, team_id: teamId, name: "Project", project_reference: reference })]
  );

  it("preserves formatting, permits empty values and scopes uniqueness to a team", async () => {
    await create("10000000-0000-0000-0000-000000000001", team, " XX/NCPL/SG0001/0001/2027 ");
    await create("10000000-0000-0000-0000-000000000002", otherTeam, "xx/ncpl/sg0001/0001/2027");
    await create("10000000-0000-0000-0000-000000000003", team);
    await create("10000000-0000-0000-0000-000000000004", team, "  ");
    const result = await client.query("SELECT project_reference FROM projects ORDER BY id");
    expect(result.rows.map(row => row.project_reference)).toEqual([
      "XX/NCPL/SG0001/0001/2027", "xx/ncpl/sg0001/0001/2027", null, null,
    ]);
  });

  it("rolls back project creation and updates when a reference conflicts", async () => {
    const first = "10000000-0000-0000-0000-000000000001";
    const second = "10000000-0000-0000-0000-000000000002";
    await create(first, team, "ABC/01");
    await create(second, team, "DEF/02");
    await client.query("SAVEPOINT before_duplicate");
    await expect(create("10000000-0000-0000-0000-000000000003", team, "abc/01"))
      .rejects.toMatchObject({ code: "23505", constraint: "projects_team_reference_unique" });
    await client.query("ROLLBACK TO SAVEPOINT before_duplicate");
    expect((await client.query("SELECT count(*)::int AS count FROM projects")).rows[0].count).toBe(2);
    await expect(client.query("SELECT update_project_with_reference($1)", [JSON.stringify({
      id: second, team_id: team, name: "Changed", project_reference: "abc/01",
    })])).rejects.toMatchObject({ code: "23505" });
    await client.query("ROLLBACK TO SAVEPOINT before_duplicate");
    expect((await client.query("SELECT name, project_reference FROM projects WHERE id = $1", [second])).rows[0])
      .toEqual({ name: "Project", project_reference: "DEF/02" });
  });

  it("preserves an omitted reference, clears an empty one, and reverses the migration", async () => {
    const id = "10000000-0000-0000-0000-000000000001";
    await create(id, team, "A/001");
    await client.query("SELECT update_project_with_reference($1)", [JSON.stringify({ id, team_id: team, name: "New" })]);
    expect((await client.query("SELECT project_reference FROM projects WHERE id = $1", [id])).rows[0].project_reference).toBe("A/001");
    await client.query("SELECT update_project_with_reference($1)", [JSON.stringify({ id, team_id: team, name: "New", project_reference: "" })]);
    expect((await client.query("SELECT project_reference FROM projects WHERE id = $1", [id])).rows[0].project_reference).toBeNull();
    await client.query(down);
    expect((await client.query("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'project_reference'")).rows[0].count).toBe(0);
  });
});
