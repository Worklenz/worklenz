import db from "../../../config/db";
import { withTransaction } from "../../../services/client-contacts-service";
import { PortalError, badRequest } from "../../../services/client-portal-v2/errors";
import {
  confirmFileVersion,
  confirmPortalFile,
  getFileDownloadUrl,
  listFileVersions,
  listPortalFiles,
  presignFileVersion,
  presignPortalFile,
  updatePortalFile,
} from "../../../services/client-portal-v2/files.service";
import {
  completeMilestone,
  createMilestone,
  deleteMilestone,
  listMilestones,
  updateMilestone,
} from "../../../services/client-portal-v2/milestones.service";
import {
  assignContactToProject,
  linkProjectToClient,
  removeContactFromProject,
} from "../../../services/client-portal-v2/project-core";
import {
  getPortalProject,
  getProjectAccess,
  getProjectOverview,
  listPortalProjects,
  publishProjectUpdate,
  setProjectPortal,
  updateProjectOverview,
} from "../../../services/client-portal-v2/projects.service";
import { listPortalTasks, updatePortalTask } from "../../../services/client-portal-v2/tasks.service";
import { getProjectAccessForRequest } from "../../../shared/project-access";
import { TEAM_ROLE_NAMES } from "../../../shared/team-permissions";
import { asNumber, asString, bodyOf, ok, portalHandler, staffContext, uuidParam } from "./portal-http";

/**
 * Client Portal v2 admin: Portal Projects (list, switch, Overview, Client Access) and the
 * Milestones, Tasks and Files tabs of a project workspace.
 */
export default class PortalProjectsController {
  /** GET /portal/v2/projects - every workspace project with its portal switch, plus the stat row. */
  static list = portalHandler("Failed to load the projects", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listPortalProjects(teamId, {
        search: asString(req.query.search),
        organization_id: asString(req.query.organization_id),
        portal: asString(req.query.portal),
        has_client: asString(req.query.has_client),
        status: asString(req.query.status),
        phase: asString(req.query.phase),
        sort: asString(req.query.sort),
        order: asString(req.query.order),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  /** GET /portal/v2/projects/:projectId */
  static get = portalHandler("Failed to load the project", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getPortalProject(db, teamId, uuidParam(req, "projectId")));
  });

  /** PUT /portal/v2/projects/:projectId/portal  body: { enabled } */
  static setPortal = portalHandler("Failed to change the Client Portal", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const { enabled } = bodyOf(req);
    if (typeof enabled !== "boolean") throw badRequest("enabled must be true or false", "INVALID_BODY");
    const result = await setProjectPortal({ teamId, projectId: uuidParam(req, "projectId"), enabled, actor });
    ok(
      res,
      result,
      enabled
        ? "Client Portal is on. Assigned users can see client-visible items only."
        : "Client access was revoked immediately."
    );
  });

  /** GET /portal/v2/projects/:projectId/overview */
  static overview = portalHandler("Failed to load the project overview", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getProjectOverview(db, teamId, uuidParam(req, "projectId")));
  });

  /** PUT /portal/v2/projects/:projectId/overview - client-facing fields; they appear on the client's next page load. */
  static saveOverview = portalHandler("Failed to save the project overview", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await updateProjectOverview({ teamId, projectId: uuidParam(req, "projectId"), patch: bodyOf(req) }),
      "Saved. The client sees this on their next page load."
    );
  });

  /** POST /portal/v2/projects/:projectId/updates  body: { body } */
  static publishUpdate = portalHandler("Failed to publish the update", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    ok(
      res,
      await publishProjectUpdate({
        teamId,
        projectId: uuidParam(req, "projectId"),
        authorUserId: userId,
        authorName: actor.name,
        body: asString(bodyOf(req).body) ?? "",
      }),
      "Update published",
      201
    );
  });

  /** GET /portal/v2/projects/:projectId/access */
  static access = portalHandler("Failed to load the client access", async (req, res) => {
    const { teamId } = staffContext(req);
    const projectId = uuidParam(req, "projectId");
    const view = await getProjectAccess(db, teamId, projectId);

    // Assignment lists stay Owner/Admin-only; other eligible viewers get assigned users only.
    const access = await getProjectAccessForRequest(req, projectId);
    const canManageAssignments =
      access.teamRole === TEAM_ROLE_NAMES.OWNER || access.teamRole === TEAM_ROLE_NAMES.ADMIN;
    ok(res, canManageAssignments ? view : { ...view, assignable: [] });
  });

  /** POST /portal/v2/projects/:projectId/access  body: { user_id } */
  static assignUser = portalHandler("Failed to assign the user", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const projectId = uuidParam(req, "projectId");
    const userId = asString(bodyOf(req).user_id);
    if (!userId) throw badRequest("user_id is required", "MISSING_FIELDS");
    await withTransaction(tx => assignContactToProject(tx, { teamId, contactId: userId, projectId, actor }));
    ok(res, await getProjectAccess(db, teamId, projectId), "Assigned");
  });

  /** DELETE /portal/v2/projects/:projectId/access/:userId - takes effect on the client's next request. */
  static removeUser = portalHandler("Failed to remove the access", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const projectId = uuidParam(req, "projectId");
    await withTransaction(tx =>
      removeContactFromProject(tx, { teamId, contactId: uuidParam(req, "userId"), projectId, actor })
    );
    ok(res, await getProjectAccess(db, teamId, projectId), "Access removed. It applies on the client's next request.");
  });

  /** POST /portal/v2/projects/:projectId/link-client  body: { organization_id } */
  static linkClient = portalHandler("Failed to link the client", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const projectId = uuidParam(req, "projectId");
    const clientId = asString(bodyOf(req).organization_id);
    if (!clientId) throw badRequest("organization_id is required", "MISSING_FIELDS");
    await withTransaction(tx => linkProjectToClient(tx, { teamId, projectId, clientId, actor }));
    ok(res, await getPortalProject(db, teamId, projectId), "Linked");
  });

  // ─── Milestones ───────────────────────────────────────────────────────────

  static milestones = portalHandler("Failed to load the milestones", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await listMilestones(db, teamId, uuidParam(req, "projectId")));
  });

  static createMilestone = portalHandler("Failed to create the milestone", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    ok(
      res,
      await createMilestone({ teamId, projectId: uuidParam(req, "projectId"), userId, actor, body: bodyOf(req) }),
      "Milestone added",
      201
    );
  });

  static updateMilestone = portalHandler("Failed to update the milestone", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(res, await updateMilestone({ teamId, milestoneId: uuidParam(req, "milestoneId"), actor, body: bodyOf(req) }));
  });

  static completeMilestone = portalHandler("Failed to complete the milestone", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await completeMilestone({
        teamId,
        milestoneId: uuidParam(req, "milestoneId"),
        completionNote: asString(bodyOf(req).completion_note),
      }),
      "Milestone completed"
    );
  });

  static deleteMilestone = portalHandler("Failed to delete the milestone", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    await deleteMilestone({ teamId, milestoneId: uuidParam(req, "milestoneId"), actor });
    ok(res, null, "Milestone deleted");
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────

  static tasks = portalHandler("Failed to load the tasks", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listPortalTasks(teamId, uuidParam(req, "projectId"), {
        visibility: asString(req.query.visibility),
        search: asString(req.query.search),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  /** PUT /portal/v2/tasks/:taskId - visibility, client wording and attached files. */
  static updateTask = portalHandler("Failed to update the task", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    const body = bodyOf(req);
    const task = await updatePortalTask({
      teamId,
      taskId: uuidParam(req, "taskId"),
      actor,
      userId,
      patch: {
        visibility: asString(body.visibility),
        client_title: asString(body.client_title),
        client_description: asString(body.client_description),
        attached_file_ids: Array.isArray(body.attached_file_ids)
          ? body.attached_file_ids.filter((id: unknown) => typeof id === "string")
          : undefined,
      },
    });
    ok(
      res,
      task,
      body.visibility === "internal" ? "Client access was removed immediately." : "Saved"
    );
  });

  // ─── Files ────────────────────────────────────────────────────────────────

  static files = portalHandler("Failed to load the files", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await listPortalFiles(db, teamId, uuidParam(req, "projectId"), asString(req.query.category)));
  });

  static presignFile = portalHandler("Failed to start the upload", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    ok(
      res,
      await presignPortalFile({
        teamId,
        projectId: uuidParam(req, "projectId"),
        uploader: { side: "team", userId, name: actor.name },
        body: bodyOf(req),
      })
    );
  });

  static confirmFile = portalHandler("Failed to finish the upload", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    const fileId = asString(bodyOf(req).file_id);
    if (!fileId) throw badRequest("file_id is required", "MISSING_FIELDS");
    ok(
      res,
      await confirmPortalFile({
        teamId,
        projectId: uuidParam(req, "projectId"),
        fileId,
        uploader: { side: "team", userId, name: actor.name },
        actor,
      })
    );
  });

  static updateFile = portalHandler("Failed to update the file", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const body = bodyOf(req);
    ok(
      res,
      await updatePortalFile({
        teamId,
        fileId: uuidParam(req, "fileId"),
        actor,
        patch: { category: asString(body.category), visibility: asString(body.visibility) },
      }),
      body.visibility === "internal" ? "Client access was removed immediately." : "Saved"
    );
  });

  static versions = portalHandler("Failed to load the versions", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await listFileVersions(db, teamId, uuidParam(req, "fileId")));
  });

  static presignVersion = portalHandler("Failed to start the upload", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    ok(
      res,
      await presignFileVersion({
        teamId,
        fileId: uuidParam(req, "fileId"),
        uploader: { side: "team", userId, name: actor.name },
        body: bodyOf(req),
      })
    );
  });

  static confirmVersion = portalHandler("Failed to finish the upload", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const versionId = asString(bodyOf(req).version_id);
    if (!versionId) throw badRequest("version_id is required", "MISSING_FIELDS");
    ok(res, await confirmFileVersion({ teamId, fileId: uuidParam(req, "fileId"), versionId, actor }));
  });

  static download = portalHandler("Failed to create the download link", async (req, res) => {
    const { teamId } = staffContext(req);
    const version = asNumber(req.query.version);
    if (req.query.version !== undefined && (version === undefined || !Number.isInteger(version) || version < 1)) {
      throw new PortalError(400, "Invalid version", "INVALID_VERSION");
    }
    ok(res, await getFileDownloadUrl({ teamId, fileId: uuidParam(req, "fileId"), version }));
  });
}
