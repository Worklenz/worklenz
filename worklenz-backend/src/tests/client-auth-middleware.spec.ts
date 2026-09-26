jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {
    verifyClientToken: jest.fn(),
    getClientPermissions: jest.fn(),
    hasOrganizationAccess: jest.fn(),
  },
}));

import db from "../config/db";
import TokenService from "../services/token-service";
import {
  authenticateClient,
  requireClientPermission,
  AuthenticatedClientRequest,
} from "../middlewares/client-auth-middleware";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedDb = db as jest.Mocked<typeof db>;
const mockedTokenService = TokenService as jest.Mocked<typeof TokenService>;

describe("client-auth-middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("authenticateClient", () => {
    it("returns 401 if client token is missing", async () => {
      const req = createMockRequest({
        headers: {},
        query: {},
      });
      const res = createMockResponse();
      const next = jest.fn();

      await authenticateClient(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("Client token is required");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 if token is invalid or expired", async () => {
      const req = createMockRequest({
        headers: { "x-client-token": "invalid-token" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedTokenService.verifyClientToken.mockReturnValue(null as any);

      await authenticateClient(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("Invalid or expired client token");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 404 if client record does not exist in DB", async () => {
      const req = createMockRequest({
        headers: { "x-client-token": "valid-token" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedTokenService.verifyClientToken.mockReturnValue({
        clientId: "client-123",
        organizationId: "org-456",
        email: "client@test.com",
        permissions: [],
        type: "client",
      });

      mockedDb.query.mockResolvedValueOnce(createQueryResult([]));

      await authenticateClient(req, res, next);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain("Client not found");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 if client is inactive", async () => {
      const req = createMockRequest({
        headers: { "x-client-token": "valid-token" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedTokenService.verifyClientToken.mockReturnValue({
        clientId: "client-123",
        organizationId: "org-456",
        email: "client@test.com",
        permissions: [],
        type: "client",
      });

      mockedDb.query.mockResolvedValueOnce(
        createQueryResult([{ client_status: "inactive", portal_access_active: true }])
      );

      await authenticateClient(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Client account is deactivated");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 if portal access is explicitly disabled", async () => {
      const req = createMockRequest({
        headers: { "x-client-token": "valid-token" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedTokenService.verifyClientToken.mockReturnValue({
        clientId: "client-123",
        organizationId: "org-456",
        email: "client@test.com",
        permissions: [],
        type: "client",
      });

      mockedDb.query.mockResolvedValueOnce(
        createQueryResult([{ client_status: "active", portal_access_active: false }])
      );

      await authenticateClient(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Portal access is disabled");
      expect(next).not.toHaveBeenCalled();
    });

    it("successfully populates client data on request when valid", async () => {
      const req = createMockRequest({
        headers: { "x-client-token": "valid-token" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedTokenService.verifyClientToken.mockReturnValue({
        clientId: "client-123",
        organizationId: "org-456",
        email: "client@test.com",
        permissions: ["read:invoices", "read:projects"],
        type: "client",
      });

      mockedDb.query.mockResolvedValueOnce(
        createQueryResult([{ client_status: "active", portal_access_active: true }])
      );

      mockedTokenService.getClientPermissions.mockResolvedValueOnce([
        "read:invoices",
        "read:projects",
      ]);

      await authenticateClient(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.clientId).toBe("client-123");
      expect(req.organizationId).toBe("org-456");
      expect(req.clientEmail).toBe("client@test.com");
      expect(req.clientAccess.canViewInvoices).toBe(true);
      expect(req.clientAccess.canViewProjects).toBe(true);
      expect(req.clientAccess.canViewServices).toBe(false);
    });

    it("blocks state-changing request if origin is explicitly disallowed", async () => {
      const req = createMockRequest({
        method: "POST",
        headers: {
          origin: "https://malicious-site.com",
          "x-client-token": "valid-token",
        },
      });
      const res = createMockResponse();
      const next = jest.fn();

      await authenticateClient(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Request origin not allowed");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("requireClientPermission", () => {
    it("calls next if user has specified permission", () => {
      const req = createMockRequest() as AuthenticatedClientRequest;
      req.clientAccess = { canViewInvoices: true };
      const res = createMockResponse();
      const next = jest.fn();

      const middleware = requireClientPermission("canViewInvoices");
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("returns 403 if user lacks specified permission", () => {
      const req = createMockRequest() as AuthenticatedClientRequest;
      req.clientAccess = { canViewInvoices: false };
      const res = createMockResponse();
      const next = jest.fn();

      const middleware = requireClientPermission("canViewInvoices");
      middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Insufficient permissions");
      expect(next).not.toHaveBeenCalled();
    });
  });
});
