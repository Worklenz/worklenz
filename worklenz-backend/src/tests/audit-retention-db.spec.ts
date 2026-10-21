import { Pool } from "pg";
import db from "../config/db";
import { getAuditRetentionPool } from "../config/audit-retention-db";

jest.mock("pg", () => ({ Pool: jest.fn(() => ({ on: jest.fn() })) }));
jest.mock("../config/db", () => ({
  __esModule: true,
  default: { pool: { connect: jest.fn() } },
}));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

afterEach(() => {
  delete process.env.AUDIT_RETENTION_DB_USER;
  delete process.env.AUDIT_RETENTION_DB_PASSWORD;
});

describe("audit retention database connection", () => {
  it("keeps the existing connection when no worker login is configured", () => {
    delete process.env.AUDIT_RETENTION_DB_USER;
    expect(getAuditRetentionPool()).toBe(db.pool);
    expect(Pool).not.toHaveBeenCalled();
  });

  it("uses a separate reusable pool for the dedicated worker login", () => {
    process.env.AUDIT_RETENTION_DB_USER = "retention-test";
    process.env.AUDIT_RETENTION_DB_PASSWORD = "test-password";
    const pool = getAuditRetentionPool();
    expect(pool).not.toBe(db.pool);
    expect(Pool).toHaveBeenCalledWith(
      expect.objectContaining({
        user: "retention-test",
        password: "test-password",
        max: 1,
      }),
    );
    expect(getAuditRetentionPool()).toBe(pool);
    expect(Pool).toHaveBeenCalledTimes(1);
  });
});
