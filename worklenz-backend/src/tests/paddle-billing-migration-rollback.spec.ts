import path from "path";

interface Migration { down: (builder: { sql: (statement: string) => void }) => Promise<void> }

it("aborts a Billing rollback before dropping columns if session deserialization still references them", async () => {
  const migration = require(path.resolve(__dirname, "../../database/pg-migrations/1790800000000_add_paddle_billing_columns.js")) as Migration;
  const statements: string[] = [];
  await migration.down({ sql: statement => statements.push(statement) });
  const sql = statements.join("\n");
  const guard = sql.indexOf("IF position('lus.billing_provider' IN _def) > 0 THEN");
  expect(guard).toBeGreaterThan(-1);
  expect(sql.indexOf("RAISE EXCEPTION", guard)).toBeLessThan(sql.indexOf("EXECUTE _def"));
  expect(sql.indexOf("EXECUTE _def")).toBeLessThan(sql.indexOf("DROP COLUMN"));
});
