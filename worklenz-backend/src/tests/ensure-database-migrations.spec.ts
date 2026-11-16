jest.mock("child_process", () => ({
  spawnSync: jest.fn(),
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
}));

import fs from "fs";
import { spawnSync } from "child_process";
import { ensureDatabaseMigrations } from "../db/ensure-database-migrations";

describe("ensureDatabaseMigrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SKIP_DB_MIGRATIONS;
  });

  it("skips migrations when they are explicitly disabled", async () => {
    process.env.SKIP_DB_MIGRATIONS = "true";

    await ensureDatabaseMigrations();

    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("runs the migration script when available and successful", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (spawnSync as jest.Mock).mockReturnValue({ status: 0, error: undefined });

    await ensureDatabaseMigrations();

    expect(spawnSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["up"]),
      expect.objectContaining({
        cwd: expect.any(String),
        stdio: "inherit",
      })
    );
  });

  it("throws when the migration process exits unsuccessfully", async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (spawnSync as jest.Mock).mockReturnValue({ status: 1, error: undefined });

    await expect(ensureDatabaseMigrations()).rejects.toThrow("Database migrations failed");
  });
});
