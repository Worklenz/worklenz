import express from "express";

import requireClientAuth from "../middleware/require-client-auth";
import validatePortalCSRF from "../middleware/portal-csrf";
import PortalAuthController from "../controllers/portal-auth-controller";
import PortalDeliverablesController from "../controllers/portal-deliverables-controller";
import PortalTasksController from "../controllers/portal-tasks-controller";
import PortalAttachmentsController from "../controllers/portal-attachments-controller";

const portalApiRouter = express.Router();

// Auth routes — no session required (these create the session)
portalApiRouter.post("/auth/magic-link", PortalAuthController.requestMagicLink);
portalApiRouter.post("/auth/validate", PortalAuthController.validateMagicLink);

// Authenticated routes — require client portal session
portalApiRouter.get("/auth/me", requireClientAuth, PortalAuthController.me);
portalApiRouter.post("/auth/logout", requireClientAuth, PortalAuthController.logout);

portalApiRouter.get("/branding", requireClientAuth, PortalDeliverablesController.getBranding);

// Legacy deliverables routes (Phase 1 — kept for backward compat)
portalApiRouter.get("/deliverables", requireClientAuth, PortalDeliverablesController.list);
portalApiRouter.get("/deliverables/:id", requireClientAuth, PortalDeliverablesController.getById);
portalApiRouter.post("/deliverables/:id/approve", requireClientAuth, validatePortalCSRF, PortalDeliverablesController.approve);
portalApiRouter.post("/deliverables/:id/reject", requireClientAuth, validatePortalCSRF, PortalDeliverablesController.reject);
portalApiRouter.post("/deliverables/:id/comment", requireClientAuth, validatePortalCSRF, PortalDeliverablesController.addComment);
portalApiRouter.get("/deliverables/:id/comments", requireClientAuth, PortalDeliverablesController.getComments);

// Phase 2: Portal tasks (portal board view + task creation)
portalApiRouter.get("/tasks", requireClientAuth, PortalTasksController.list);
portalApiRouter.post("/tasks", requireClientAuth, validatePortalCSRF, PortalTasksController.create);
portalApiRouter.get("/tasks/:id", requireClientAuth, PortalTasksController.getById);
portalApiRouter.post("/tasks/:id/comments", requireClientAuth, validatePortalCSRF, PortalTasksController.addComment);
portalApiRouter.get("/tasks/:id/comments", requireClientAuth, PortalTasksController.getComments);

// Phase 2: Portal attachments
portalApiRouter.post("/attachments/tasks", requireClientAuth, validatePortalCSRF, PortalAttachmentsController.upload);
portalApiRouter.get("/attachments/tasks/:taskId", requireClientAuth, PortalAttachmentsController.list);
portalApiRouter.get("/attachments/download", requireClientAuth, PortalAttachmentsController.download);

export default portalApiRouter;
