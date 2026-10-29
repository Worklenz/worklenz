import ClientPortalSettingsController from "../controllers/client-portal/client-portal-settings-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { teamCanUseFeature } from "../shared/entitlements/gates";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../shared/entitlements/gates", () => ({
  teamCanUseFeature: jest.fn(),
}));

describe("ClientPortalSettingsController.updateSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (teamCanUseFeature as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ id: "settings-1", organization_team_id: "team-123" }],
    });
  });

  it("rejects an invalid contact phone format with 400 Bad Request", async () => {
    const req = createMockRequest({
      body: {
        contact_phone: "+94 11 234 5678 99999", // Exceeds valid length for LK
      },
    });
    const res = createMockResponse();

    await ClientPortalSettingsController.updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toBe("Invalid contact phone number format");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rejects non-numeric gibberish as contact phone with 400 Bad Request", async () => {
    const req = createMockRequest({
      body: {
        contact_phone: "abc-invalid-phone",
      },
    });
    const res = createMockResponse();

    await ClientPortalSettingsController.updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toBe("Invalid contact phone number format");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("rejects non-string numeric contact phone with 400 Bad Request", async () => {
    const req = createMockRequest({
      body: {
        contact_phone: 94112345678, // non-string number
      },
    });
    const res = createMockResponse();

    await ClientPortalSettingsController.updateSettings(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toBe("Invalid contact phone number format");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("accepts a valid international contact phone number", async () => {
    const req = createMockRequest({
      body: {
        company_name: "Acme Corp",
        contact_phone: "+94 11 234 5678",
      },
    });
    const res = createMockResponse();

    await ClientPortalSettingsController.updateSettings(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(db.query).toHaveBeenCalled();
    expect(res.body.done).toBe(true);
  });

  it("accepts empty or null contact phone number", async () => {
    const req = createMockRequest({
      body: {
        contact_phone: "",
      },
    });
    const res = createMockResponse();

    await ClientPortalSettingsController.updateSettings(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(db.query).toHaveBeenCalled();
    expect(res.body.done).toBe(true);
  });
});
