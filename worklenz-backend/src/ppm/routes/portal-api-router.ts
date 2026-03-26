import express from "express";

import requireClientAuth from "../middleware/require-client-auth";
import PortalAuthController from "../controllers/portal-auth-controller";
import PortalDeliverablesController from "../controllers/portal-deliverables-controller";

const portalApiRouter = express.Router();

// Auth routes — no session required (these create the session)
portalApiRouter.post("/auth/magic-link", PortalAuthController.requestMagicLink);
portalApiRouter.post("/auth/validate", PortalAuthController.validateMagicLink);

// Authenticated routes — require client portal session
portalApiRouter.get("/auth/me", requireClientAuth, PortalAuthController.me);
portalApiRouter.post("/auth/logout", requireClientAuth, PortalAuthController.logout);

portalApiRouter.get("/branding", requireClientAuth, PortalDeliverablesController.getBranding);

portalApiRouter.get("/deliverables", requireClientAuth, PortalDeliverablesController.list);
portalApiRouter.get("/deliverables/:id", requireClientAuth, PortalDeliverablesController.getById);
portalApiRouter.post("/deliverables/:id/approve", requireClientAuth, PortalDeliverablesController.approve);
portalApiRouter.post("/deliverables/:id/reject", requireClientAuth, PortalDeliverablesController.reject);
portalApiRouter.post("/deliverables/:id/comment", requireClientAuth, PortalDeliverablesController.addComment);
portalApiRouter.get("/deliverables/:id/comments", requireClientAuth, PortalDeliverablesController.getComments);

export default portalApiRouter;
