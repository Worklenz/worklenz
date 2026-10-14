import db from "../../../config/db";
import {
  cancelApproval,
  createApproval,
  deleteApproval,
  getApproval,
  getApprovalOptions,
  listApprovals,
  resubmitApproval,
  sendApproval,
  updateApproval,
} from "../../../services/client-portal-v2/approvals.service";
import { exportAuditCsv, listAuditEvents } from "../../../services/client-portal-v2/audit-log.service";
import {
  LEGACY_MODULES,
  exportLegacyModuleJson,
  exportLegacyTableCsv,
  isLegacyModule,
  legacyTableNames,
} from "../../../services/client-portal-v2/legacy-export.service";
import {
  ChangeRequestAction,
  applyChangeRequestAction,
  convertChangeRequestToWork,
  getChangeRequest,
  listBillableChangeRequests,
  listChangeRequests,
  listLinkableTasks,
  updateChangeRequest,
} from "../../../services/client-portal-v2/change-requests.service";
import {
  getContextOptions,
  getMentionOptions,
  getMemberMentionOptions,
  getThread,
  listThreads,
  markThreadRead,
  postStaffMessage,
  startThread,
} from "../../../services/client-portal-v2/discussions.service";
import { badRequest } from "../../../services/client-portal-v2/errors";
import { getPreview, getPreviewProject, listPreviewUsers } from "../../../services/client-portal-v2/preview.service";
import { asNumber, asString, bodyOf, ok, portalHandler, staffContext, uuidParam } from "./portal-http";

/**
 * Client Portal v2 admin: Approvals, Change Requests, Discussions, the Audit Log and Preview.
 */
export default class PortalWorkflowController {
  // ─── Approvals ────────────────────────────────────────────────────────────

  static approvals = portalHandler("Failed to load the approvals", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listApprovals(teamId, {
        status: asString(req.query.status),
        organization_id: asString(req.query.organization_id),
        search: asString(req.query.search),
        sort: asString(req.query.sort),
        order: asString(req.query.order),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  static approval =portalHandler("Failed to load the approval", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getApproval(db, teamId, uuidParam(req, "approvalId")));
  });

  /** GET /portal/v2/projects/:projectId/approval-options - Client Visible items and eligible approvers. */
  static approvalOptions = portalHandler("Failed to load the approval options", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getApprovalOptions(db, teamId, uuidParam(req, "projectId")));
  });

  static createApproval = portalHandler("Failed to create the approval", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    const approval = await createApproval({ teamId, userId, actor, body: bodyOf(req) as any });
    ok(res, approval, approval.status === "draft" ? "Draft saved" : "Approval sent", 201);
  });

  static sendApproval = portalHandler("Failed to send the approval", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(res, await sendApproval({ teamId, approvalId: uuidParam(req, "approvalId"), actor }), "Sent to the client");
  });

  static updateApproval = portalHandler("Failed to update the approval", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(
      res,
      await updateApproval({ teamId, approvalId: uuidParam(req, "approvalId"), actor, body: bodyOf(req) as any }),
      "Request updated"
    );
  });

  static deleteApproval = portalHandler("Failed to delete the approval", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    await deleteApproval({ teamId, approvalId: uuidParam(req, "approvalId"), actor });
    ok(res, null, "Request deleted");
  });

  static cancelApproval = portalHandler("Failed to cancel the approval", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(res, await cancelApproval({ teamId, approvalId: uuidParam(req, "approvalId"), actor }), "Request cancelled");
  });

  static resubmitApproval = portalHandler("Failed to resubmit the approval", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(
      res,
      await resubmitApproval({
        teamId,
        approvalId: uuidParam(req, "approvalId"),
        actor,
        description: asString(bodyOf(req).description),
      }),
      "Resubmitted as a new revision. The approver was notified by email and in the portal."
    );
  });

  // ─── Change requests ──────────────────────────────────────────────────────

  static changeRequests = portalHandler("Failed to load the change requests", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listChangeRequests(teamId, {
        status: asString(req.query.status),
        organization_id: asString(req.query.organization_id),
        priority: asString(req.query.priority),
        search: asString(req.query.search),
        sort: asString(req.query.sort),
        order: asString(req.query.order),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  /** GET /portal/v2/change-requests/billable - requests a quote or invoice can start from. */
  static billable = portalHandler("Failed to load the billable change requests", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listBillableChangeRequests(teamId, {
        organization_id: asString(req.query.organization_id),
        search: asString(req.query.search),
      })
    );
  });

  static changeRequest = portalHandler("Failed to load the change request", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getChangeRequest(db, teamId, uuidParam(req, "changeRequestId")));
  });

  /** POST /portal/v2/change-requests/:changeRequestId/actions - one explicit status action. */
  static action = portalHandler("Failed to update the change request", async (req, res) => {
    const { teamId, userId, memberId, actor } = staffContext(req);
    const body = bodyOf(req);
    if (typeof body.action !== "string") throw badRequest("action is required", "MISSING_FIELDS");
    ok(
      res,
      await applyChangeRequestAction({
        teamId,
        id: uuidParam(req, "changeRequestId"),
        userId,
        actorMemberId: memberId,
        actor,
        body: body as ChangeRequestAction,
      }),
      "Updated"
    );
  });

  static updateChangeRequest = portalHandler("Failed to save the change request", async (req, res) => {
    const { teamId } = staffContext(req);
    const body = bodyOf(req);
    ok(
      res,
      await updateChangeRequest({
        teamId,
        id: uuidParam(req, "changeRequestId"),
        patch: {
          assignee_id: body.assignee_id === null ? null : asString(body.assignee_id),
          estimate: body.estimate === undefined ? undefined : body.estimate,
          internal_assessment: asString(body.internal_assessment),
        },
      }),
      "Saved"
    );
  });

  static convert = portalHandler("Failed to convert the change request to work", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    const body = bodyOf(req);
    if (body.mode !== "create" && body.mode !== "link") throw badRequest("mode must be create or link", "MISSING_FIELDS");
    ok(
      res,
      await convertChangeRequestToWork({ teamId, id: uuidParam(req, "changeRequestId"), userId, actor, body: body as any }),
      "Converted to work. The request is now in progress."
    );
  });

  static linkableTasks = portalHandler("Failed to load the tasks", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await listLinkableTasks(db, teamId, uuidParam(req, "projectId")));
  });

  // ─── Discussions ──────────────────────────────────────────────────────────

  static threads = portalHandler("Failed to load the discussions", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    ok(
      res,
      await listThreads(teamId, userId, {
        project_id: asString(req.query.project_id),
        unread: asString(req.query.unread),
        context_type: asString(req.query.context_type),
        search: asString(req.query.search),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  /** GET /portal/v2/threads/:threadId - the full thread; opening it clears this user's unread flag. */
  static thread = portalHandler("Failed to load the discussion", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    const threadId = uuidParam(req, "threadId");
    await markThreadRead(db, teamId, userId, threadId);
    ok(res, await getThread(db, teamId, userId, threadId));
  });

  static startThread = portalHandler("Failed to start the discussion", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    ok(res, await startThread({ teamId, userId, actor, body: bodyOf(req) as any }), "Discussion started", 201);
  });

  static postMessage = portalHandler("Failed to send the message", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    ok(
      res,
      await postStaffMessage({ teamId, userId, actor, threadId: uuidParam(req, "threadId"), body: bodyOf(req) as any }),
      null,
      201
    );
  });

  /** GET /portal/v2/projects/:projectId/thread-options - what a thread can be about, and who can be mentioned. */
  static threadOptions = portalHandler("Failed to load the discussion options", async (req, res) => {
    const { teamId } = staffContext(req);
    const projectId = uuidParam(req, "projectId");
    const [context, mentions, members] = await Promise.all([
      getContextOptions(db, teamId, projectId),
      getMentionOptions(db, teamId, projectId),
      getMemberMentionOptions(db, teamId, projectId),
    ]);
    ok(res, { context, mentions, members });
  });

  // ─── Audit log ────────────────────────────────────────────────────────────

  static audit = portalHandler("Failed to load the audit log", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listAuditEvents(teamId, {
        search: asString(req.query.search),
        type: asString(req.query.type),
        side: asString(req.query.side),
        organization_id: asString(req.query.organization_id),
        date_from: asString(req.query.date_from),
        date_to: asString(req.query.date_to),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  /** GET /portal/v2/audit/export - the current filtered view as CSV. */
  static auditExport = portalHandler("Failed to export the audit log", async (req, res) => {
    const { teamId } = staffContext(req);
    const csv = await exportAuditCsv(teamId, {
      search: asString(req.query.search),
      type: asString(req.query.type),
      side: asString(req.query.side),
      organization_id: asString(req.query.organization_id),
      date_from: asString(req.query.date_from),
      date_to: asString(req.query.date_to),
    });
    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="client-portal-audit-log.csv"',
        "Cache-Control": "no-store",
      })
      .send(csv);
  });

  // ─── Legacy export ────────────────────────────────────────────────────────

  /**
   * GET /portal/v2/legacy-export/:module  (requests | services | tickets | chats)
   * JSON of every table in the module, or, with ?format=csv&table=<name>, one table as CSV. The v1
   * tables are kept after cutover; this saves a copy before the later migration that drops them.
   */
  static legacyExport = portalHandler("Failed to export the legacy data", async (req, res) => {
    const { teamId } = staffContext(req);
    const module = String(req.params.module ?? "");
    if (!isLegacyModule(module)) {
      throw badRequest(`Unknown module. Choose one of: ${LEGACY_MODULES.join(", ")}`, "UNKNOWN_MODULE");
    }

    if (asString(req.query.format) === "csv") {
      const table = asString(req.query.table) ?? legacyTableNames(module)[0];
      const csv = await exportLegacyTableCsv(teamId, module, table);
      res
        .status(200)
        .set({
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="client-portal-${module}-${table}.csv"`,
          "Cache-Control": "no-store",
        })
        .send(csv);
      return;
    }

    res
      .status(200)
      .set({
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="client-portal-${module}.json"`,
        "Cache-Control": "no-store",
      })
      .send(JSON.stringify(await exportLegacyModuleJson(teamId, module)));
  });

  // ─── Preview ──────────────────────────────────────────────────────────────

  static previewUsers = portalHandler("Failed to load the preview users", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await listPreviewUsers(db, teamId));
  });

  static preview = portalHandler("Failed to load the preview", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getPreview(db, teamId, uuidParam(req, "contactId")));
  });

  static previewProject = portalHandler("Failed to load the preview", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getPreviewProject(db, teamId, uuidParam(req, "contactId"), uuidParam(req, "projectId")));
  });
}
