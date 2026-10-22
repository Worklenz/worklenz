import axios from "axios";
import { TeamsNotificationService } from "../services/teams-notification.service";

jest.mock("axios");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

const post = axios.post as jest.Mock;
const httpError = (status?: number, headers: Record<string, string> = {}) =>
  Object.assign(new Error(`status ${status}`), status ? { response: { status, headers, data: "err" } } : {});

describe("TeamsNotificationService.sendTeamsNotification", () => {
  let sleep: jest.SpyInstance;
  let keyCounter = 0;
  const nextKey = () => `webhook-${++keyCounter}`;

  beforeEach(() => {
    post.mockReset();
    sleep = jest.spyOn(TeamsNotificationService, "sleep").mockResolvedValue(undefined);
  });
  afterEach(() => sleep.mockRestore());

  it("retries 429 and honours Retry-After", async () => {
    post.mockRejectedValueOnce(httpError(429, { "retry-after": "3" })).mockResolvedValueOnce({ status: 202 });

    await TeamsNotificationService.sendTeamsNotification("https://x", {}, nextKey());

    expect(post).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("backs off exponentially on server errors and network failures", async () => {
    post.mockRejectedValueOnce(httpError(502)).mockRejectedValueOnce(httpError()).mockResolvedValueOnce({ status: 202 });

    await TeamsNotificationService.sendTeamsNotification("https://x", {}, nextKey());

    expect(post).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(500);
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it("gives up after three attempts", async () => {
    post.mockRejectedValue(httpError(500));

    await expect(TeamsNotificationService.sendTeamsNotification("https://x", {}, nextKey())).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("does not retry client errors such as an expired webhook", async () => {
    post.mockRejectedValue(httpError(400));

    await expect(TeamsNotificationService.sendTeamsNotification("https://x", {}, nextKey())).rejects.toThrow();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("spaces consecutive sends to the same webhook", async () => {
    post.mockResolvedValue({ status: 202 });
    const key = nextKey();

    await TeamsNotificationService.sendTeamsNotification("https://x", {}, key);
    await TeamsNotificationService.sendTeamsNotification("https://x", {}, key);

    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep.mock.calls[0][0]).toBeGreaterThan(0);
    expect(sleep.mock.calls[0][0]).toBeLessThanOrEqual(250);
  });

  it("does not delay sends to different webhooks", async () => {
    post.mockResolvedValue({ status: 202 });

    await TeamsNotificationService.sendTeamsNotification("https://x", {}, nextKey());
    await TeamsNotificationService.sendTeamsNotification("https://x", {}, nextKey());

    expect(sleep).not.toHaveBeenCalled();
  });
});
