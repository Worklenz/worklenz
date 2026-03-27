import crypto from "crypto";
import express from "express";

import requirePPMPartner from "../middleware/require-ppm-partner";
import AdminClientsController from "../controllers/admin-clients-controller";
import AdminDashboardController from "../controllers/admin-dashboard-controller";
import AdminApprovalController from "../controllers/admin-approval-controller";
import { ServerResponse } from "../../models/server-response";

const adminApiRouter = express.Router();

// All admin routes require PPM partner role (isLoggedIn applied at mount in app.ts)
adminApiRouter.use(requirePPMPartner);

// CSRF protection for admin write routes (POST/PUT/DELETE)
// Uses double-submit pattern: GET /csrf-token mints a token stored in session,
// write requests must send it back via X-CSRF-Token header.
adminApiRouter.get("/csrf-token", (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");
  (req.session as any).adminCsrfToken = token;
  return res.status(200).json(new ServerResponse(true, { csrf_token: token }));
});

adminApiRouter.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }
  const headerToken = req.headers["x-csrf-token"] as string | undefined;
  const sessionToken = (req.session as any)?.adminCsrfToken as string | undefined;
  if (!headerToken || !sessionToken) {
    return res.status(403).json(new ServerResponse(false, null, "CSRF token missing"));
  }
  const hBuf = Buffer.from(headerToken);
  const sBuf = Buffer.from(sessionToken);
  if (hBuf.length !== sBuf.length || !crypto.timingSafeEqual(hBuf, sBuf)) {
    return res.status(403).json(new ServerResponse(false, null, "Invalid CSRF token"));
  }
  return next();
});

// Dashboard
adminApiRouter.get("/dashboard", AdminDashboardController.getStats);
adminApiRouter.get("/dashboard/clients", AdminDashboardController.getClientHealth);

// Cross-client pipeline (kanban)
adminApiRouter.get("/pipeline", AdminDashboardController.getPipeline);

// Approval queue
adminApiRouter.get("/approval-queue", AdminApprovalController.list);
adminApiRouter.get("/approval-queue/count", AdminApprovalController.count);
adminApiRouter.post("/approval-queue/:id/approve", AdminApprovalController.approve);
adminApiRouter.post("/approval-queue/:id/return", AdminApprovalController.returnToClient);
adminApiRouter.get("/feedback-reasons", AdminApprovalController.getFeedbackReasons);

// Client CRUD
adminApiRouter.get("/clients", AdminClientsController.list);
adminApiRouter.get("/clients/:id", AdminClientsController.getById);
adminApiRouter.post("/clients", AdminClientsController.create);

// Client users
adminApiRouter.get("/clients/:id/users", AdminClientsController.listUsers);
adminApiRouter.post("/clients/:id/users", AdminClientsController.addUser);
adminApiRouter.put("/clients/:id/users/:userId", AdminClientsController.updateUser);
adminApiRouter.delete("/clients/:id/users/:userId", AdminClientsController.removeUser);

// Client partners
adminApiRouter.get("/clients/:id/partners", AdminClientsController.listPartners);
adminApiRouter.post("/clients/:id/partners", AdminClientsController.addPartner);
adminApiRouter.delete("/clients/:id/partners/:partnerId", AdminClientsController.removePartner);

// Client ↔ project linking
adminApiRouter.get("/clients/:id/projects", AdminClientsController.listProjects);
adminApiRouter.post("/clients/:id/projects", AdminClientsController.linkProject);
adminApiRouter.delete("/clients/:id/projects/:projectId", AdminClientsController.unlinkProject);
adminApiRouter.put("/clients/:id/projects/:projectId/primary", AdminClientsController.setPrimaryProject);

export default adminApiRouter;
