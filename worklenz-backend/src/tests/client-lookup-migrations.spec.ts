import fs from "fs";
import path from "path";

/**
 * 1792195200000_client-lifecycle-soft-delete patches the live create_project / update_project so that a project
 * is never attached to a deleted client. A migration written after it that redefines either function from an older
 * copy would silently undo that, so this fails when one does not keep the `deleted_at IS NULL` filter.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../database/pg-migrations");
const PATCH_MIGRATION = "1792195200000_client-lifecycle-soft-delete.js";
const PATCH_TIMESTAMP = Number(PATCH_MIGRATION.split("_")[0]);

const CLIENT_LOOKUP = /SELECT\s+id\s+FROM\s+clients\s+WHERE\s+LOWER\(name\)\s*=\s*LOWER\(_client_name\)[^;]*;/gi;
const DEFINES_PROJECT_FUNCTION = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(create|update)_project\s*\(\s*_body\s+json\s*\)/i;

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith(".js"))
  .sort();

describe("client lookups in create_project / update_project", () => {
  it("the patch migration rewrites the lookup to skip deleted clients", () => {
    const source = fs.readFileSync(path.join(MIGRATIONS_DIR, PATCH_MIGRATION), "utf8");
    expect(source).toContain("AND team_id = _team_id AND deleted_at IS NULL INTO _client_id;");
  });

  it("no later migration redefines them without the deleted-client filter", () => {
    const offenders: string[] = [];
    for (const file of migrationFiles) {
      if (Number(file.split("_")[0]) <= PATCH_TIMESTAMP) continue;
      const source = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      if (!DEFINES_PROJECT_FUNCTION.test(source)) continue;
      const lookups = source.match(CLIENT_LOOKUP) ?? [];
      if (lookups.length === 0 || lookups.some(lookup => !/deleted_at\s+IS\s+NULL/i.test(lookup))) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
