jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.unmock("../shared/email");

import { getEmailConfigurationErrors } from "../shared/email";

const emailConfigurationKeys = [
  "EMAIL_PROVIDER",
  "EMAIL_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
] as const;

const originalEnvironment = Object.fromEntries(
  emailConfigurationKeys.map(key => [key, process.env[key]]),
);

const setEnvironment = (values: Partial<Record<(typeof emailConfigurationKeys)[number], string>>): void => {
  for (const key of emailConfigurationKeys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
};

afterAll(() => setEnvironment(originalEnvironment));

describe("getEmailConfigurationErrors", () => {
  it("defaults an unset provider to SES", () => {
    setEnvironment({
      EMAIL_FROM: "Worklenz <noreply@example.com>",
      AWS_REGION: "us-east-1",
      AWS_ACCESS_KEY_ID: "key",
      AWS_SECRET_ACCESS_KEY: "secret",
    });

    expect(getEmailConfigurationErrors()).toEqual([]);
  });

  it("rejects an unsupported provider", () => {
    setEnvironment({ EMAIL_PROVIDER: "smpt" });

    expect(getEmailConfigurationErrors()).toContain(
      "EMAIL_PROVIDER must be either ses or smtp",
    );
  });

  it.each(["587smtp", "0", "65536", "-1"])(
    "rejects invalid SMTP port %s",
    SMTP_PORT => {
      setEnvironment({
        EMAIL_PROVIDER: "smtp",
        EMAIL_FROM: "Worklenz <noreply@example.com>",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT,
        SMTP_USER: "user",
        SMTP_PASSWORD: "password",
      });

      expect(getEmailConfigurationErrors()).toContain(
        "SMTP_PORT must be an integer from 1 to 65535",
      );
    },
  );
});
