jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}));

jest.mock("@aws-sdk/client-ses", () => ({
  SESClient: jest.fn().mockImplementation(() => ({ send: (...args: unknown[]) => mockSend(...args) })),
  SendEmailCommand: jest.fn().mockImplementation(input => ({ input })),
  SendRawEmailCommand: jest.fn(),
}));

import { sendEmailEnhanced } from "../shared/email";

const mockSend = jest.fn().mockResolvedValue({ MessageId: "message-id" });
const originalFrom = process.env.EMAIL_FROM;
const originalProvider = process.env.EMAIL_PROVIDER;
const originalRegion = process.env.AWS_REGION;

afterAll(() => {
  for (const [key, value] of Object.entries({ EMAIL_FROM: originalFrom, EMAIL_PROVIDER: originalProvider, AWS_REGION: originalRegion })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

it.each([
  ["Équipe Worklenz <sender@example.com>", "=?UTF-8?B?w4lxdWlwZSBXb3JrbGVueg==?= <sender@example.com>"],
  ['"Worklenz Team" <sender@example.com>', '"Worklenz Team" <sender@example.com>'],
  ["sender@example.com", "sender@example.com"],
])("sends the SES source for %s", async (from, expectedSource) => {
  process.env.EMAIL_PROVIDER = "ses";
  process.env.AWS_REGION = "us-east-1";
  process.env.EMAIL_FROM = from;

  const result = await sendEmailEnhanced({ to: ["recipient@example.com"], subject: "Subject", html: "<p>Body</p>" });

  expect(result.success).toBe(true);
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ Source: expectedSource }) }));
});
