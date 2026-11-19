import { authenticateClient } from "../middlewares/client-auth-middleware";
import ClientPortalAttachmentController from "../controllers/client-portal-attachment-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {
    verifyClientToken: jest.fn(),
    getClientPermissions: jest.fn().mockResolvedValue([]),
    hasOrganizationAccess: jest.fn().mockResolvedValue(true)
  }
}));

describe("client portal security", () => {
  describe("authenticateClient", () => {
    it("rejects authentication when clientToken is only provided in query params", async () => {
      const req = createMockRequest({
        query: { clientToken: "some-token" },
        headers: {}
      });
      const res = createMockResponse();
      const next = jest.fn();

      await authenticateClient(req as any, res as any, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("ClientPortalAttachmentController.uploadFile", () => {
    it("rejects uploads when fileType is missing", async () => {
      const req = {
        clientId: "client-1",
        organizationId: "org-1",
        body: {
          fileName: "test.exe",
          fileData: "dGVzdA=="
        }
      };
      const res = createMockResponse();

      await ClientPortalAttachmentController.uploadFile(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect((res as any).body?.message).toContain("File type not allowed");
    });

    it("rejects uploads with disallowed file types", async () => {
      const req = {
        clientId: "client-1",
        organizationId: "org-1",
        body: {
          fileName: "test.exe",
          fileType: "application/x-msdownload",
          fileData: "dGVzdA=="
        }
      };
      const res = createMockResponse();

      await ClientPortalAttachmentController.uploadFile(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect((res as any).body?.message).toContain("File type not allowed");
    });

    it("rejects data URL with disallowed embedded mime type", async () => {
      const req = {
        clientId: "client-1",
        organizationId: "org-1",
        body: {
          fileName: "test.svg",
          fileType: "image/png", // claimed type
          fileData: "data:image/svg+xml;base64,PHN2Zz4=" // actual payload type
        }
      };
      const res = createMockResponse();

      await ClientPortalAttachmentController.uploadFile(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect((res as any).body?.message).toContain("File type not allowed");
    });

    it("rejects data URL with parameters and disallowed mime type", async () => {
      const req = {
        clientId: "client-1",
        organizationId: "org-1",
        body: {
          fileName: "test.svg",
          fileType: "image/png",
          fileData: "data:image/svg+xml;charset=utf-8;base64,PHN2Zz4="
        }
      };
      const res = createMockResponse();

      await ClientPortalAttachmentController.uploadFile(req as any, res as any);

      expect(res.statusCode).toBe(400);
      expect((res as any).body?.message).toContain("File type not allowed");
    });
  });
});
