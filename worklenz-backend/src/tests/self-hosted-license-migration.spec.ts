import path from "path";

interface MigrationBuilder {
  sql: (statement: string) => void;
}

interface Migration {
  up: (builder: MigrationBuilder) => Promise<void>;
}

const migration = require(path.resolve(
  __dirname,
  "../../database/pg-migrations/1790780400000_register_functions_self_hosted_license.js"
)) as Migration;

describe("self-hosted license migration deployment guard", () => {
  const originalMode = process.env.WORKLENZ_DEPLOYMENT_MODE;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
    else process.env.WORKLENZ_DEPLOYMENT_MODE = originalMode;
  });

  it.each(["cloud", " CLOUD "])("applies only shared duplicate prevention in %s mode", async mode => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = mode;
    const sql = jest.fn();

    await migration.up({ sql });

    expect(sql).toHaveBeenCalledTimes(1);
    const statements = sql.mock.calls.map(([statement]: [string]) => statement).join("\n");
    expect(statements).toContain("CREATE OR REPLACE FUNCTION create_team_member");
    expect(statements).toContain("CONTINUE WHEN EXISTS");
    expect(statements).not.toContain("CREATE OR REPLACE FUNCTION register_");
    expect(statements).not.toContain("UPDATE organizations");
    expect(statements).not.toContain("SELF_HOSTED");
  });

  it.each(["self_hosted", " SELF_HOSTED "])("applies the repair in %s mode", async mode => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = mode;
    const sql = jest.fn();

    await migration.up({ sql });

    expect(sql).toHaveBeenCalledTimes(3);
    expect(sql).toHaveBeenCalledWith(expect.stringContaining("CREATE OR REPLACE FUNCTION create_team_member"));
    expect(sql).toHaveBeenCalledWith(expect.stringContaining("CREATE OR REPLACE FUNCTION register_user"));
    expect(sql).toHaveBeenCalledWith(expect.stringContaining("UPDATE organizations o"));
  });

  it.each([undefined, "", "   ", "production", "self-hosted"])(
    "rejects mode %s before executing SQL",
    async mode => {
      if (mode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
      else process.env.WORKLENZ_DEPLOYMENT_MODE = mode;
      const sql = jest.fn();

      await expect(migration.up({ sql })).rejects.toThrow("Set WORKLENZ_DEPLOYMENT_MODE explicitly");
      expect(sql).not.toHaveBeenCalled();
    }
  );
});
