import axios from "axios";
import db from "../config/db";
import { sendTelemetryHeartbeat } from "../services/telemetry-heartbeat";

jest.mock("axios");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
const query = db.query as jest.Mock;
const post = axios.post as jest.Mock;

afterEach(() => { delete process.env.WORKLENZ_TELEMETRY_ENABLED; delete process.env.WORKLENZ_DEPLOYMENT_MODE; jest.clearAllMocks(); });

test("does not access the database or network without explicit opt-in", async () => {
  await sendTelemetryHeartbeat();
  expect(query).not.toHaveBeenCalled();
  expect(post).not.toHaveBeenCalled();
});

test("sends only a reserved heartbeat for self-hosted installations", async () => {
  process.env.WORKLENZ_TELEMETRY_ENABLED = "true";
  query.mockResolvedValueOnce({ rowCount: 1, rows: [{ installation_id: "ca9b8f6e-8ca4-42c8-a175-339c907107f1" }] });
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
