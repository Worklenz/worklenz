import { TeamsNotificationService } from "../services/teams-notification.service";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));

describe("TeamsNotificationService.validateWebhookUrl", () => {
  const valid = [
    "https://prod-12.westus.logic.azure.com:443/workflows/abc/triggers/manual/paths/invoke?sig=x",
    "https://default123.45.environment.api.powerplatform.com/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke",
    "https://contoso.webhook.office.com/webhookb2/abc",
    "https://outlook.office.com/webhook/abc",
    "https://prod-01.usgovvirginia.logic.azure.us/workflows/abc/triggers/manual/paths/invoke"
  ];
  const invalid: Array<[unknown, string]> = [
    [undefined, "Webhook URL is required"],
    ["", "Webhook URL is required"],
    ["not a url", "Webhook URL is not a valid URL"],
    ["http://contoso.webhook.office.com/webhookb2/abc", "Webhook URL must use https"],
    ["https://evil.example.com/hook", "Webhook URL must be a Microsoft Teams (Workflows) webhook URL"],
    ["https://logic.azure.com.evil.com/hook", "Webhook URL must be a Microsoft Teams (Workflows) webhook URL"],
    ["https://169.254.169.254/latest/meta-data", "Webhook URL must be a Microsoft Teams (Workflows) webhook URL"],
    ["https://notlogic.azure.com/x", "Webhook URL must be a Microsoft Teams (Workflows) webhook URL"]
  ];

  it.each(valid)("accepts %s", url => {
    expect(TeamsNotificationService.validateWebhookUrl(url)).toBeNull();
  });

  it.each(invalid)("rejects %s", (url, message) => {
    expect(TeamsNotificationService.validateWebhookUrl(url)).toBe(message);
  });
});
