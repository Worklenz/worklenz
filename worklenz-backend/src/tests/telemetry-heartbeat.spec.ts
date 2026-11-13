import axios from "axios";
import db from "../config/db";
import { sendTelemetryHeartbeat } from "../services/telemetry-heartbeat";

jest.mock("axios");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
const query = db.query as jest.Mock;
const post = axios.post as jest.Mock;

afterEach(() => { delete process.env.WORKLENZ_TELEMETRY_ENABLED; delete process.env.WORKLENZ_DEPLOYMENT_MODE; jest.clearAllMocks(); });

test("does not access the database or network when disabled", async () => {
  process.env.WORKLENZ_TELEMETRY_ENABLED = "false";
  await sendTelemetryHeartbeat();
  expect(query).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("sends only a reserved heartbeat for self-hosted installations", async () => {
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ installation_id: "ca9b8f6e-8ca4-42c8-a175-339c907107f1", attempted_at: "2026-11-13 00:00:00+00" }] });
  await sendTelemetryHeartbeat();
  expect(post).toHaveBeenCalledWith("https://telemetry.worklenz.com/v1/heartbeat", {
    event: "installation_active", installation_id: "ca9b8f6e-8ca4-42c8-a175-339c907107f1", version: expect.any(String),
  }, { timeout: 5000, maxRedirects: 0 });
  query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
  await sendTelemetryHeartbeat();
  expect(post).toHaveBeenCalledTimes(1);
});

test("does not send from cloud deployments", async () => {
  process.env.WORKLENZ_TELEMETRY_ENABLED = "true";
  process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";
  await sendTelemetryHeartbeat();
  expect(query).not.toHaveBeenCalled();
});


test("does not send for an invalid setting", async () => {
  process.env.WORKLENZ_TELEMETRY_ENABLED = "invalid";
  await sendTelemetryHeartbeat();
  expect(query).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});


test("schedules a bounded retry after a network failure without failing startup", async () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ installation_id: "ca9b8f6e-8ca4-42c8-a175-339c907107f1", attempted_at: "2026-11-13 00:00:00+00" }] });
  query.mockResolvedValueOnce({ rowCount: 1, rows: [] });
  post.mockRejectedValueOnce(new Error("network unavailable"));
  await expect(sendTelemetryHeartbeat()).resolves.toBeUndefined();
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls[1][1]).toEqual(["ca9b8f6e-8ca4-42c8-a175-339c907107f1", "2026-11-13 00:00:00+00"]);
  expect(query.mock.calls[1][0]).toContain("last_attempt_at = $2::timestamptz");
  warn.mockRestore();
});
