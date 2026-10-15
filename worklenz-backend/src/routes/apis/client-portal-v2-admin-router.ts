import express from "express";

import PortalAccessController from "../../controllers/client-portal/v2/portal-access-controller";
import PortalOverviewController from "../../controllers/client-portal/v2/portal-overview-controller";
import PortalProjectsController from "../../controllers/client-portal/v2/portal-projects-controller";
import PortalWorkflowController from "../../controllers/client-portal/v2/portal-workflow-controller";
import safeControllerFunction from "../../shared/safe-controller-function";

/**
 * Client Portal v2 admin API, mounted at /api/v1/clients/portal/v2 behind login, CSRF and the
 * Owner/Admin guard (see clients-api-router.ts). Routes are grouped by module; literal segments
 * (counts, billable, export, ...) are declared before the :param routes they could be mistaken for.
 */
const router = express.Router();

// ── Roles, settings, counts ──
router.get("/counts", safeControllerFunction(PortalAccessController.counts));
router.get("/roles", safeControllerFunction(PortalAccessController.roles));
router.get("/staff", safeControllerFunction(PortalAccessController.staff));
router.get("/settings", safeControllerFunction(PortalAccessController.getSettings));
router.put("/settings", safeControllerFunction(PortalAccessController.saveSettings));

// ── Overview (widget data and each user's saved layout) ──
router.get("/overview", safeControllerFunction(PortalOverviewController.overview));
router.get("/overview/layout", safeControllerFunction(PortalOverviewController.getLayout));
router.put("/overview/layout", safeControllerFunction(PortalOverviewController.saveLayout));
router.delete("/overview/layout", safeControllerFunction(PortalOverviewController.resetLayout));

// ── Organizations and client users ──
router.get("/organizations", safeControllerFunction(PortalAccessController.organizations));
router.get("/organizations/:organizationId/overview", safeControllerFunction(PortalAccessController.organizationOverview));
router.get("/client-users", safeControllerFunction(PortalAccessController.users));
router.get("/client-users/:userId", safeControllerFunction(PortalAccessController.user));
router.put("/client-users/:userId", safeControllerFunction(PortalAccessController.updateUser));
router.put("/client-users/:userId/projects", safeControllerFunction(PortalAccessController.assignProjects));
router.post("/client-users/:userId/resend", safeControllerFunction(PortalAccessController.resend));
router.post("/client-users/:userId/deactivate", safeControllerFunction(PortalAccessController.deactivate));
router.post("/client-users/:userId/reactivate", safeControllerFunction(PortalAccessController.reactivate));
router.delete("/client-users/:userId", safeControllerFunction(PortalAccessController.remove));
router.post("/add-client", safeControllerFunction(PortalAccessController.addClient));

// ── Portal Projects ──
router.get("/projects", safeControllerFunction(PortalProjectsController.list));
router.get("/projects/:projectId", safeControllerFunction(PortalProjectsController.get));
router.put("/projects/:projectId/portal", safeControllerFunction(PortalProjectsController.setPortal));
router.get("/projects/:projectId/overview", safeControllerFunction(PortalProjectsController.overview));
router.put("/projects/:projectId/overview", safeControllerFunction(PortalProjectsController.saveOverview));
router.post("/projects/:projectId/updates", safeControllerFunction(PortalProjectsController.publishUpdate));
router.get("/projects/:projectId/access", safeControllerFunction(PortalProjectsController.access));
router.post("/projects/:projectId/access", safeControllerFunction(PortalProjectsController.assignUser));
router.delete("/projects/:projectId/access/:userId", safeControllerFunction(PortalProjectsController.removeUser));
router.post("/projects/:projectId/link-client", safeControllerFunction(PortalProjectsController.linkClient));

// ── Milestones, tasks, files ──
router.get("/projects/:projectId/milestones", safeControllerFunction(PortalProjectsController.milestones));
router.post("/projects/:projectId/milestones", safeControllerFunction(PortalProjectsController.createMilestone));
router.put("/milestones/:milestoneId", safeControllerFunction(PortalProjectsController.updateMilestone));
router.post("/milestones/:milestoneId/complete", safeControllerFunction(PortalProjectsController.completeMilestone));
router.delete("/milestones/:milestoneId", safeControllerFunction(PortalProjectsController.deleteMilestone));

router.get("/projects/:projectId/tasks", safeControllerFunction(PortalProjectsController.tasks));
router.put("/tasks/:taskId", safeControllerFunction(PortalProjectsController.updateTask));

router.get("/projects/:projectId/files", safeControllerFunction(PortalProjectsController.files));
router.post("/projects/:projectId/files/presign", safeControllerFunction(PortalProjectsController.presignFile));
router.post("/projects/:projectId/files/confirm", safeControllerFunction(PortalProjectsController.confirmFile));
router.put("/files/:fileId", safeControllerFunction(PortalProjectsController.updateFile));
router.get("/files/:fileId/versions", safeControllerFunction(PortalProjectsController.versions));
router.get("/files/:fileId/download", safeControllerFunction(PortalProjectsController.download));
router.post("/files/:fileId/versions/presign", safeControllerFunction(PortalProjectsController.presignVersion));
router.post("/files/:fileId/versions/confirm", safeControllerFunction(PortalProjectsController.confirmVersion));

// ── Approvals ──
router.get("/approvals", safeControllerFunction(PortalWorkflowController.approvals));
router.post("/approvals", safeControllerFunction(PortalWorkflowController.createApproval));
router.get("/approvals/:approvalId", safeControllerFunction(PortalWorkflowController.approval));
router.patch("/approvals/:approvalId", safeControllerFunction(PortalWorkflowController.updateApproval));
router.delete("/approvals/:approvalId", safeControllerFunction(PortalWorkflowController.deleteApproval));
router.post("/approvals/:approvalId/send", safeControllerFunction(PortalWorkflowController.sendApproval));
router.post("/approvals/:approvalId/cancel", safeControllerFunction(PortalWorkflowController.cancelApproval));
router.post("/approvals/:approvalId/resubmit", safeControllerFunction(PortalWorkflowController.resubmitApproval));
router.get("/projects/:projectId/approval-options", safeControllerFunction(PortalWorkflowController.approvalOptions));

// ── Change requests ── (billable before :changeRequestId)
router.get("/change-requests", safeControllerFunction(PortalWorkflowController.changeRequests));
router.get("/change-requests/billable", safeControllerFunction(PortalWorkflowController.billable));
router.get("/change-requests/:changeRequestId", safeControllerFunction(PortalWorkflowController.changeRequest));
router.put("/change-requests/:changeRequestId", safeControllerFunction(PortalWorkflowController.updateChangeRequest));
router.post("/change-requests/:changeRequestId/actions", safeControllerFunction(PortalWorkflowController.action));
router.post("/change-requests/:changeRequestId/convert", safeControllerFunction(PortalWorkflowController.convert));
router.get("/projects/:projectId/linkable-tasks", safeControllerFunction(PortalWorkflowController.linkableTasks));

// ── Discussions ──
router.get("/threads", safeControllerFunction(PortalWorkflowController.threads));
router.post("/threads", safeControllerFunction(PortalWorkflowController.startThread));
router.get("/threads/:threadId", safeControllerFunction(PortalWorkflowController.thread));
router.post("/threads/:threadId/messages", safeControllerFunction(PortalWorkflowController.postMessage));
router.get("/projects/:projectId/thread-options", safeControllerFunction(PortalWorkflowController.threadOptions));

// ── Audit log ── (export before any :param)
router.get("/audit/export", safeControllerFunction(PortalWorkflowController.auditExport));

// ── Retired v1 modules: a read-only copy of their data before the later drop migration ──
router.get("/legacy-export/:module", safeControllerFunction(PortalWorkflowController.legacyExport));
router.get("/audit", safeControllerFunction(PortalWorkflowController.audit));

// ── Preview as client ──
router.get("/preview/users", safeControllerFunction(PortalWorkflowController.previewUsers));
router.get("/preview/:contactId", safeControllerFunction(PortalWorkflowController.preview));
router.get("/preview/:contactId/projects/:projectId", safeControllerFunction(PortalWorkflowController.previewProject));

export default router;
