import fs from "fs";
import path from "path";

interface Migration {
  up: (builder: { sql: (statement: string) => void }) => Promise<void>;
  down: (builder: { sql: (statement: string) => void }) => Promise<void>;
}

const migrationPath = path.resolve(
  __dirname,
  "../../database/pg-migrations/1795471734830_notify_task_subscribers_on_status_change.js"
);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require(migrationPath) as Migration;
const freshInstallSql = fs.readFileSync(
  path.resolve(__dirname, "../../database/sql/4_functions.sql"),
  "utf8"
);

async function upSql() {
  const statements: string[] = [];
  await migration.up({sql: statement => statements.push(statement)});
  return statements.join("\n");
}

function functionSql(source: string, name: string) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("1795471734830_notify_task_subscribers_on_status_change", () => {
  it("requires current project membership before including a task subscriber", async () => {
    const sql = await upSql();

    for (const source of [sql, freshInstallSql]) {
      const recipientSql = functionSql(source, "get_task_notify_recipients");
      expect(recipientSql).toContain("INNER JOIN project_members pm");
      expect(recipientSql).toContain("pm.team_member_id = tm.id");
      expect(recipientSql).toContain("pm.project_id = (SELECT project_id FROM tasks WHERE id = _task_id)");
      expect(recipientSql).not.toContain("LEFT JOIN project_members pm");
    }
  });

  it("returns recipients only inside the actual status-transition branch", async () => {
    const sql = await upSql();

    for (const source of [sql, freshInstallSql]) {
      const handlerSql = functionSql(source, "handle_on_task_status_change");
      expect(handlerSql).toContain("SELECT get_task_notify_recipients(_task_id, NOT _is_new_status_done) INTO _members;");
      expect(handlerSql).toContain("'members', COALESCE(_members, '[]'::JSON)");
      expect(handlerSql).not.toContain("'members', COALESCE(get_task_notify_recipients(_task_id), '[]'::JSON)");
    }
  });

  it("excludes subscribers from the generic Done fanout so the completion listener owns that notification", async () => {
    const sql = await upSql();

    for (const source of [sql, freshInstallSql]) {
      const recipientSql = functionSql(source, "get_task_notify_recipients");
      const handlerSql = functionSql(source, "handle_on_task_status_change");
      expect(recipientSql).toContain("_include_subscribers boolean DEFAULT true");
      expect(recipientSql).toContain("NOT EXISTS(SELECT 1");
      expect(recipientSql).toContain("FROM task_subscribers subscriber_filter");
      expect(recipientSql).toContain("AND _include_subscribers");
      expect(handlerSql).toContain("SELECT get_task_notify_recipients(_task_id, NOT _is_new_status_done) INTO _members;");
    }
  });

  it("rolls back the function with its full signature", async () => {
    const statements: string[] = [];
    await migration.down({sql: statement => statements.push(statement)});

    expect(statements.join("\n")).toContain("DROP FUNCTION IF EXISTS get_task_notify_recipients(uuid, boolean);");
  });
});
