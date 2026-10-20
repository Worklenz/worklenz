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

  it.each(["cloud", " CLOUD "])("executes no SQL in %s mode", async mode => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = mode;
    const sql = jest.fn();

    await migration.up({ sql });

    expect(sql).not.toHaveBeenCalled();
  });

  it.each(["self_hosted", " SELF_HOSTED "])("applies the repair in %s mode", async mode => {
    process.env.WORKLENZ_DEPLOYMENT_MODE = mode;
    const sql = jest.fn();

    await migration.up({ sql });

    expect(sql).toHaveBeenCalledTimes(1);
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
