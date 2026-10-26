import { PoolClient } from "pg";

import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IProjectCommentEmailNotification } from "../interfaces/comment-email-notification";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { getBaseUrl } from "../cron_jobs/helpers";
import { sendProjectComment } from "../shared/email-notifications";
import { getOrganizationLogoUrl } from "../shared/email-templates";
import { NotificationsService } from "../services/notifications/notifications.service";
import {
  DocumentMentionRef,
  SectionDocument,
  TreeItem,
  applyParentMoves,
  canUpdateDocumentContent,
  emptyDocument,
  extractMentions,
  extractPlainText,
  memberIdsToNotify,
  readDocumentContent,
  syncDocumentMentions,
  validateDocumentContent,
  validateDocumentTree,
} from "../services/project-documents/project-document-content";
import { log_error, sanitizePlainText } from "../shared/utils";
import { isValidUuid } from "../shared/validation-helpers";
import WorklenzControllerBase from "./worklenz-controller-base";

interface DocumentRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: unknown;
  content_text: string;
  position: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  updated_by_name?: string | null;
}

interface MentionRow {
  mention_type: "member" | "task";
  user_id: string | null;
  task_id: string | null;
  member_name?: string | null;
  member_avatar_url?: string | null;
  task_name?: string | null;
  task_project_id?: string | null;
  task_key?: string | null;
  status_name?: string | null;
  status_color?: string | null;
}

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, char => `\\${char}`);

const snippetFor = (title: string, text: string, query: string): string => {
  const haystack = text || "";
  const index = haystack.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return title;
  const start = Math.max(0, index - 40);
  const slice = haystack.slice(start, start + 120).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}`;
};

const isActionError = (
  result: object
): result is { error: string; status: number } =>
  "error" in result &&
  typeof (result as { error?: unknown }).error === "string" &&
  typeof (result as { status?: unknown }).status === "number";

const normalizeTitle = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const title = value.trim();
  if (!title || title.length > 500) return null;
  return title;
};

export default class ProjectDocumentsController extends WorklenzControllerBase {
  private static async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private static async loadTree(client: PoolClient, projectId: string): Promise<TreeItem[]> {
    const result = await client.query(
      `SELECT id, parent_id
       FROM project_documents
       WHERE project_id = $1 AND deleted_at IS NULL`,
      [projectId]
    );
    return result.rows.map((row: { id: string; parent_id: string | null }) => ({
      id: row.id,
      parentId: row.parent_id,
    }));
  }

  private static async loadMentionRefs(client: PoolClient, documentId: string): Promise<DocumentMentionRef[]> {
    const result = await client.query(
      `SELECT mention_type, user_id, task_id
       FROM project_document_mentions
       WHERE document_id = $1`,
      [documentId]
    );
    const mentions: DocumentMentionRef[] = [];
    for (const row of result.rows as MentionRow[]) {
      if (row.mention_type === "member" && row.user_id) {
        mentions.push({ type: "member", id: row.user_id });
      } else if (row.mention_type === "task" && row.task_id) {
        mentions.push({ type: "task", id: row.task_id });
      }
    }
    return mentions;
  }

  /**
   * Checks mentions that are new to the page. A target that is on the project passes, a
   * target that exists elsewhere is rejected, and a target that no longer exists at all
   * (deleted user or task) is reported in `gone` so the caller can drop it instead of
   * failing the save or violating a foreign key.
   */
  private static async assertMentionTargets(
    client: PoolClient,
    projectId: string,
    mentions: DocumentMentionRef[]
  ): Promise<{ error: string | null; gone: Set<string> }> {
    const gone = new Set<string>();
    const memberIds = mentions.filter(mention => mention.type === "member").map(mention => mention.id);
    const taskIds = mentions.filter(mention => mention.type === "task").map(mention => mention.id);

    if (memberIds.length > 0) {
      const onProject = await client.query(
        `SELECT tm.user_id
         FROM project_members pm
         INNER JOIN team_members tm ON tm.id = pm.team_member_id
         WHERE pm.project_id = $1 AND tm.user_id = ANY($2::uuid[])`,
        [projectId, memberIds]
      );
      const found = new Set<string>(onProject.rows.map((row: { user_id: string }) => row.user_id));
      const missing = memberIds.filter(id => !found.has(id));
      if (missing.length > 0) {
        const existing = await client.query(`SELECT id FROM users WHERE id = ANY($1::uuid[])`, [missing]);
        const existingIds = new Set<string>(existing.rows.map((row: { id: string }) => row.id));
        if (missing.some(id => existingIds.has(id))) return { error: "A mentioned member is not on this project", gone };
        missing.forEach(id => gone.add(`member:${id}`));
      }
    }

    if (taskIds.length > 0) {
      const onProject = await client.query(
        `SELECT id FROM tasks WHERE project_id = $1 AND id = ANY($2::uuid[])`,
        [projectId, taskIds]
      );
      const found = new Set<string>(onProject.rows.map((row: { id: string }) => row.id));
      const missing = taskIds.filter(id => !found.has(id));
      if (missing.length > 0) {
        const existing = await client.query(`SELECT id FROM tasks WHERE id = ANY($1::uuid[])`, [missing]);
        const existingIds = new Set<string>(existing.rows.map((row: { id: string }) => row.id));
        if (missing.some(id => existingIds.has(id))) return { error: "A mentioned task is not in this project", gone };
        missing.forEach(id => gone.add(`task:${id}`));
      }
    }

    return { error: null, gone };
  }

  private static async replaceMentions(
    client: PoolClient,
    documentId: string,
    previous: DocumentMentionRef[],
    next: DocumentMentionRef[]
  ) {
    const diff = syncDocumentMentions(previous, next);

    if (diff.removedMemberIds.length > 0) {
      await client.query(
        `DELETE FROM project_document_mentions
         WHERE document_id = $1 AND mention_type = 'member' AND user_id = ANY($2::uuid[])`,
        [documentId, diff.removedMemberIds]
      );
    }
    if (diff.removedTaskIds.length > 0) {
      await client.query(
        `DELETE FROM project_document_mentions
         WHERE document_id = $1 AND mention_type = 'task' AND task_id = ANY($2::uuid[])`,
        [documentId, diff.removedTaskIds]
      );
    }
    for (const userId of diff.insertedMemberIds) {
      await client.query(
        `INSERT INTO project_document_mentions (document_id, mention_type, user_id)
         VALUES ($1, 'member', $2)`,
        [documentId, userId]
      );
    }
    for (const taskId of diff.insertedTaskIds) {
      await client.query(
        `INSERT INTO project_document_mentions (document_id, mention_type, task_id)
         VALUES ($1, 'task', $2)`,
        [documentId, taskId]
      );
    }

    return diff;
  }

  private static async resolveMentions(documentId: string, projectId: string, content: SectionDocument) {
    const result = await db.query(
      `SELECT m.mention_type,
              m.user_id,
              m.task_id,
              u.name AS member_name,
              u.avatar_url AS member_avatar_url,
              t.name AS task_name,
              t.project_id AS task_project_id,
              CASE WHEN t.id IS NULL THEN NULL ELSE CONCAT(p.key, '-', t.task_no) END AS task_key,
              ts.name AS status_name,
              ts.color_code AS status_color
       FROM project_document_mentions m
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN tasks t ON t.id = m.task_id
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN task_statuses ts ON ts.id = t.status_id
       WHERE m.document_id = $1`,
      [documentId]
    );

    const members: Record<string, { id: string; name: string | null; avatar_url: string | null; unavailable: boolean }> = {};
    const tasks: Record<string, {
      id: string;
      name: string | null;
      task_key: string | null;
      status_name: string | null;
      status_color: string | null;
      unavailable: boolean;
    }> = {};

    for (const row of result.rows as MentionRow[]) {
      if (row.mention_type === "member" && row.user_id) {
        members[row.user_id] = {
          id: row.user_id,
          name: row.member_name || null,
          avatar_url: row.member_avatar_url || null,
          unavailable: !row.member_name,
        };
      }
      if (row.mention_type === "task" && row.task_id) {
        const inProject = row.task_project_id === projectId && !!row.task_name;
        tasks[row.task_id] = {
          id: row.task_id,
          name: inProject ? row.task_name || null : null,
          task_key: inProject ? row.task_key || null : null,
          status_name: inProject ? row.status_name || null : null,
          status_color: inProject ? row.status_color || null : null,
          unavailable: !inProject,
        };
      }
    }

    for (const mention of extractMentions(content)) {
      if (mention.type === "member" && !members[mention.id]) {
        members[mention.id] = { id: mention.id, name: null, avatar_url: null, unavailable: true };
      }
      if (mention.type === "task" && !tasks[mention.id]) {
        tasks[mention.id] = {
          id: mention.id,
          name: null,
          task_key: null,
          status_name: null,
          status_color: null,
          unavailable: true,
        };
      }
    }

    return { members, tasks };
  }

  private static presentSummary(row: DocumentRow) {
    return {
      id: row.id,
      project_id: row.project_id,
      parent_id: row.parent_id,
      title: row.title,
      position: row.position,
      updated_at: toIso(row.updated_at),
      updated_by_name: row.updated_by_name || null,
    };
  }

  private static async presentDocument(row: DocumentRow) {
    const content = readDocumentContent(row.content);
    return {
      ...this.presentSummary(row),
      content,
      created_at: toIso(row.created_at),
      created_by: row.created_by,
      updated_by: row.updated_by,
      mentions: await this.resolveMentions(row.id, row.project_id, content),
    };
  }

  private static async getDocumentRow(documentId: string): Promise<DocumentRow | null> {
    const result = await db.query(
      `SELECT d.id, d.project_id, d.parent_id, d.title, d.content, d.content_text, d.position,
              d.created_by, d.updated_by, d.created_at, d.updated_at,
              u.name AS updated_by_name
       FROM project_documents d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.id = $1 AND d.deleted_at IS NULL`,
      [documentId]
    );
    return (result.rows[0] as DocumentRow | undefined) || null;
  }

  private static async notifyMentionedMembers(
    projectId: string,
    documentId: string,
    actorId: string,
    actorName: string,
    teamId: string,
    memberIds: string[]
  ) {
    if (memberIds.length === 0) return;

    try {
      const projectResult = await db.query(`SELECT name FROM projects WHERE id = $1`, [projectId]);
      const projectName = sanitizePlainText(projectResult.rows[0]?.name || "project");
      const safeActor = sanitizePlainText(actorName || "Someone");
      const message = `<b>${safeActor}</b> mentioned you in a document on <b>${projectName}</b>`;
      // Built from the sanitized parts directly; stripping tags from `message` with a
      // regex can leave a reassembled tag behind.
      const plainMessage = `${safeActor} mentioned you in a document on ${projectName}`;

      for (const userId of memberIds) {
        if (!userId || userId === actorId) continue;
        const memberResult = await db.query(
          `SELECT u.id, u.name, u.email, u.socket_id,
                  (SELECT email_notifications_enabled
                   FROM notification_settings
                   WHERE user_id = u.id AND team_id = $2) AS email_notifications_enabled
           FROM users u
           WHERE u.id = $1 AND u.is_deleted IS NOT TRUE`,
          [userId, teamId]
        );
        const member = memberResult.rows[0];
        if (!member) continue;

        await NotificationsService.createNotification({
          userId,
          teamId,
          socketId: member.socket_id,
          message,
          messageKey: "notifications.mentionedInProjectDocument",
          messageParams: { user: safeActor, project: projectName, documentId },
          notificationTypeKey: "PROJECT_DOCUMENT_MENTION",
          taskId: null,
          projectId,
        });

        if (member.email_notifications_enabled && member.email) {
          const email: IProjectCommentEmailNotification = {
            greeting: `Hi ${member.name || ""}`,
            summary: `${safeActor} mentioned you in a document on ${projectName}`,
            team: "",
            project_name: projectName,
            comment: plainMessage,
            settings_url: `${getBaseUrl()}/worklenz/settings/notifications`,
            project_url: `${getBaseUrl()}/worklenz/projects/${projectId}?tab=docs&doc=${documentId}`,
            logo_url: await getOrganizationLogoUrl(teamId),
          };
          await sendProjectComment(member.email, email);
        }
      }
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = String(req.query.project_id || "");
    const result = await db.query(
      `SELECT d.id, d.project_id, d.parent_id, d.title, d.position, d.updated_at, u.name AS updated_by_name
       FROM project_documents d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.project_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.position ASC, d.created_at ASC`,
      [projectId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows.map(row => this.presentSummary(row))));
  }

  @HandleExceptions()
  public static async favorites(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.id) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    const result = await db.query(
      `SELECT f.document_id
       FROM project_document_favorites f
       INNER JOIN project_documents d ON d.id = f.document_id
       WHERE f.user_id = $1 AND d.project_id = $2 AND d.deleted_at IS NULL`,
      [req.user.id, req.query.project_id]
    );
    return res.status(200).send(new ServerResponse(true, result.rows.map(row => row.document_id)));
  }

  @HandleExceptions()
  public static async setFavorite(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.id) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    const favorite = req.body?.favorite;
    if (typeof favorite !== "boolean") {
      return res.status(400).send(new ServerResponse(false, null, "Favorite must be a boolean"));
    }
    // Access middleware verifies the project and docs permission. Never accept a user ID
    // from the caller, and do not touch the shared document's autosave timestamp.
    if (favorite) {
      await db.query(
        `INSERT INTO project_document_favorites (user_id, document_id)
         SELECT $1, id FROM project_documents WHERE id = $2 AND deleted_at IS NULL
         ON CONFLICT (user_id, document_id) DO NOTHING`,
        [req.user.id, req.params.id]
      );
    } else {
      await db.query(
        `DELETE FROM project_document_favorites WHERE user_id = $1 AND document_id = $2`,
        [req.user.id, req.params.id]
      );
    }
    return res.status(200).send(new ServerResponse(true, { favorite }));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const row = await this.getDocumentRow(req.params.id);
    if (!row) {
      return res.status(404).send(new ServerResponse(false, null, "Document not found"));
    }
    return res.status(200).send(new ServerResponse(true, await this.presentDocument(row)));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id as string;
    const title = normalizeTitle(req.body?.title);
    const parentId = (req.body?.parent_id as string | null | undefined) ?? null;
    const userId = req.user?.id;

    if (!title) {
      return res.status(400).send(new ServerResponse(false, null, "A page title is required"));
    }
    if (parentId && !isValidUuid(parentId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid parent page"));
    }

    const created = await this.withTransaction(async client => {
      if (parentId) {
        const parent = await client.query(
          `SELECT id FROM project_documents
           WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
          [parentId, projectId]
        );
        if (!parent.rows[0]) {
          return { error: "Parent page was not found", status: 404 as const };
        }
      }

      const tree = await this.loadTree(client, projectId);
      const draftId = "00000000-0000-4000-8000-000000000001";
      const nextTree = validateDocumentTree([...tree, { id: draftId, parentId }]);
      if (!nextTree.ok) {
        return { error: nextTree.error, status: 400 as const };
      }

      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS position
         FROM project_documents
         WHERE project_id = $1 AND deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM $2`,
        [projectId, parentId]
      );

      const inserted = await client.query(
        `INSERT INTO project_documents
           (project_id, parent_id, title, content, content_text, position, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, '', $5, $6, $6)
         RETURNING id`,
        [projectId, parentId, title, JSON.stringify(emptyDocument()), positionResult.rows[0].position, userId]
      );
      return { id: inserted.rows[0].id as string };
    });

    if (isActionError(created)) {
      return res.status(created.status).send(new ServerResponse(false, null, created.error));
    }

    const row = await this.getDocumentRow(created.id);
    return res.status(200).send(new ServerResponse(true, row ? await this.presentDocument(row) : null));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const documentId = req.params.id;
    const expectedUpdatedAt = req.body?.expected_updated_at;
    const userId = req.user?.id as string;
    const hasTitle = Object.prototype.hasOwnProperty.call(req.body || {}, "title");
    const hasContent = Object.prototype.hasOwnProperty.call(req.body || {}, "content");
    const hasParent = Object.prototype.hasOwnProperty.call(req.body || {}, "parent_id");
    const hasPosition = Object.prototype.hasOwnProperty.call(req.body || {}, "position");

    if (typeof expectedUpdatedAt !== "string" || !expectedUpdatedAt) {
      return res.status(400).send(new ServerResponse(false, null, "expected_updated_at is required"));
    }

    const title = hasTitle ? normalizeTitle(req.body.title) : undefined;
    if (hasTitle && !title) {
      return res.status(400).send(new ServerResponse(false, null, "A page title is required"));
    }

    let content: SectionDocument | undefined;
    if (hasContent) {
      const validated = validateDocumentContent(req.body.content);
      if (!validated.ok) {
        return res.status(400).send(new ServerResponse(false, null, validated.error));
      }
      content = validated.content;
    }

    const parentId = hasParent ? ((req.body.parent_id as string | null) ?? null) : undefined;
    if (hasParent && parentId && !isValidUuid(parentId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid parent page"));
    }
    if (hasParent && parentId === documentId) {
      return res.status(400).send(new ServerResponse(false, null, "A page cannot be its own parent"));
    }

    const saved = await this.withTransaction(async client => {
      const currentResult = await client.query(
        `SELECT id, project_id, parent_id, title, content, updated_at
         FROM project_documents
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [documentId]
      );
      const current = currentResult.rows[0] as DocumentRow | undefined;
      if (!current) {
        return { error: "Document not found", status: 404 as const };
      }

      let expectedIso = "";
      try {
        expectedIso = toIso(expectedUpdatedAt);
      } catch {
        return { conflict: true as const, id: documentId };
      }
      if (toIso(current.updated_at) !== expectedIso) {
        return { conflict: true as const, id: documentId };
      }

      if (content && !canUpdateDocumentContent(current.content, content)) {
        return {
          error: "This page uses a newer document format. Refresh the application before editing.",
          status: 400 as const,
        };
      }

      const nextParent = parentId === undefined ? current.parent_id : parentId;
      if (hasParent) {
        const tree = await this.loadTree(client, current.project_id);
        const moved = applyParentMoves(tree, [{ id: documentId, parentId: nextParent }]);
        if (!moved.ok) {
          return { error: moved.error, status: 400 as const };
        }
      }

      let nextMentions = content ? extractMentions(content) : null;
      const previousMentions = nextMentions ? await this.loadMentionRefs(client, documentId) : [];
      if (nextMentions) {
        // Mentions already stored on the page stay as they are, even if the member left
        // the project or the task moved. Only mentions new to this save are validated.
        const known = new Set(previousMentions.map(mention => `${mention.type}:${mention.id}`));
        const added = nextMentions.filter(mention => !known.has(`${mention.type}:${mention.id}`));
        const { error: targetError, gone } = await this.assertMentionTargets(client, current.project_id, added);
        if (targetError) {
          return { error: targetError, status: 400 as const };
        }
        if (gone.size > 0) {
          nextMentions = nextMentions.filter(mention => !gone.has(`${mention.type}:${mention.id}`));
        }
      }
      const diff = nextMentions
        ? await this.replaceMentions(client, documentId, previousMentions, nextMentions)
        : null;

      const position = hasPosition && Number.isInteger(req.body.position) ? Number(req.body.position) : null;
      await client.query(
        `UPDATE project_documents
         SET title = COALESCE($2, title),
             content = COALESCE($3::jsonb, content),
             content_text = COALESCE($4, content_text),
             parent_id = $5,
             position = COALESCE($6, position),
             updated_by = $7,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [
          documentId,
          title ?? null,
          content ? JSON.stringify(content) : null,
          content ? extractPlainText(content) : null,
          nextParent,
          position,
          userId,
        ]
      );

      return {
        projectId: current.project_id,
        notifyIds: diff ? memberIdsToNotify(diff) : [],
      };
    });

    if (isActionError(saved)) {
      return res.status(saved.status).send(new ServerResponse(false, null, saved.error));
    }
    if ("conflict" in saved) {
      const latest = await this.getDocumentRow(documentId);
      return res.status(409).send(new ServerResponse(
        false,
        latest ? await this.presentDocument(latest) : null,
        "This page was updated by someone else"
      ));
    }

    if (saved.notifyIds.length > 0 && req.user?.team_id) {
      await this.notifyMentionedMembers(
        saved.projectId,
        documentId,
        userId,
        req.user?.name || "Someone",
        req.user.team_id,
        saved.notifyIds
      );
    }

    const row = await this.getDocumentRow(documentId);
    return res.status(200).send(new ServerResponse(true, row ? await this.presentDocument(row) : null));
  }

  @HandleExceptions()
  public static async duplicate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const documentId = req.params.id;
    const userId = req.user?.id;
    const requestedTitle = req.body?.title === undefined ? null : normalizeTitle(req.body.title);
    if (req.body?.title !== undefined && !requestedTitle) {
      return res.status(400).send(new ServerResponse(false, null, "A page title is required"));
    }

    const created = await this.withTransaction(async client => {
      const sourceResult = await client.query(
        `SELECT id, project_id, parent_id, title, content, content_text
         FROM project_documents
         WHERE id = $1 AND deleted_at IS NULL`,
        [documentId]
      );
      const source = sourceResult.rows[0] as DocumentRow | undefined;
      if (!source) return { error: "Document not found", status: 404 as const };

      const title = requestedTitle || `${source.title} copy`.slice(0, 500);
      const positionResult = await client.query(
        `SELECT COALESCE(MAX(position), -1) + 1 AS position
         FROM project_documents
         WHERE project_id = $1 AND deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM $2`,
        [source.project_id, source.parent_id]
      );
      const inserted = await client.query(
        `INSERT INTO project_documents
           (project_id, parent_id, title, content, content_text, position, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $7)
         RETURNING id`,
        [
          source.project_id,
          source.parent_id,
          title,
          JSON.stringify(source.content),
          source.content_text,
          positionResult.rows[0].position,
          userId,
        ]
      );
      const newId = inserted.rows[0].id as string;
      await client.query(
        `INSERT INTO project_document_mentions (document_id, mention_type, user_id, task_id)
         SELECT $2, mention_type, user_id, task_id
         FROM project_document_mentions
         WHERE document_id = $1`,
        [documentId, newId]
      );
      return { id: newId };
    });

    if (isActionError(created)) {
      return res.status(created.status).send(new ServerResponse(false, null, created.error));
    }

    const row = await this.getDocumentRow(created.id);
    return res.status(200).send(new ServerResponse(true, row ? await this.presentDocument(row) : null));
  }

  @HandleExceptions()
  public static async remove(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const documentId = req.params.id;
    const projectId = String(req.query.project_id || "");
    const userId = req.user?.id;

    const result = await db.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM project_documents
         WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
         UNION ALL
         SELECT child.id
         FROM project_documents child
         INNER JOIN subtree ON child.parent_id = subtree.id
         WHERE child.project_id = $2 AND child.deleted_at IS NULL
       )
       UPDATE project_documents
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP,
           updated_by = $3
       WHERE id IN (SELECT id FROM subtree)
       RETURNING id`,
      [documentId, projectId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Document not found"));
    }

    return res.status(200).send(new ServerResponse(true, {
      id: documentId,
      deleted_ids: result.rows.map((row: { id: string }) => row.id),
    }));
  }

  @HandleExceptions()
  public static async reorder(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id as string;
    const items = req.body?.items as Array<{ id?: string; parent_id?: string | null; position?: number }> | undefined;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).send(new ServerResponse(false, null, "Pages to reorder are required"));
    }

    const moves = items.map(item => ({
      id: item?.id || "",
      parentId: item?.parent_id ?? null,
      position: Number(item?.position),
    }));

    if (moves.some(item => !isValidUuid(item.id) || (item.parentId !== null && !isValidUuid(item.parentId)))) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid page id"));
    }

    const saved = await this.withTransaction(async client => {
      const tree = await this.loadTree(client, projectId);
      const known = new Set(tree.map(item => item.id));
      if (moves.length !== known.size || moves.some(item => !known.has(item.id))) {
        return { error: "Reorder must include every page in the project", status: 400 as const };
      }

      const moved = applyParentMoves(
        tree,
        moves.map(item => ({ id: item.id, parentId: item.parentId }))
      );
      if (!moved.ok) return { error: moved.error, status: 400 as const };

      const grouped = new Map<string, Array<{ id: string; position: number }>>();
      for (const item of moves) {
        const key = item.parentId || "";
        const list = grouped.get(key) || [];
        list.push({ id: item.id, position: Number.isFinite(item.position) ? item.position : 0 });
        grouped.set(key, list);
      }

      for (const [parentKey, siblings] of grouped) {
        siblings.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
        for (let index = 0; index < siblings.length; index += 1) {
          await client.query(
            `UPDATE project_documents
             SET parent_id = $2, position = $3
             WHERE id = $1 AND project_id = $4 AND deleted_at IS NULL`,
            [siblings[index].id, parentKey || null, index, projectId]
          );
        }
      }

      return { ok: true as const };
    });

    if (isActionError(saved)) {
      return res.status(saved.status).send(new ServerResponse(false, null, saved.error));
    }

    const result = await db.query(
      `SELECT d.id, d.project_id, d.parent_id, d.title, d.position, d.updated_at, u.name AS updated_by_name
       FROM project_documents d
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.project_id = $1 AND d.deleted_at IS NULL
       ORDER BY d.position ASC, d.created_at ASC`,
      [projectId]
    );
    return res.status(200).send(new ServerResponse(true, result.rows.map(row => this.presentSummary(row))));
  }

  @HandleExceptions()
  public static async search(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = String(req.query.project_id || "");
    const query = String(req.query.q || "").trim();
    if (query.length < 2) {
      return res.status(400).send(new ServerResponse(false, null, "Search must be at least 2 characters"));
    }

    const pattern = `%${escapeLike(query)}%`;
    const result = await db.query(
      `SELECT id, parent_id, title, content_text, updated_at
       FROM project_documents
       WHERE project_id = $1
         AND deleted_at IS NULL
         AND (title ILIKE $2 ESCAPE '\\' OR content_text ILIKE $2 ESCAPE '\\')
       ORDER BY updated_at DESC
       LIMIT 20`,
      [projectId, pattern]
    );

    const body = result.rows.map((row: { id: string; parent_id: string | null; title: string; content_text: string; updated_at: Date }) => ({
      id: row.id,
      parent_id: row.parent_id,
      title: row.title,
      snippet: snippetFor(row.title, row.content_text || "", query),
      updated_at: toIso(row.updated_at),
    }));

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async taskBacklinks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.taskId;
    const projectId = String(req.query.project_id || "");
    const result = await db.query(
      `SELECT d.id, d.title, d.project_id, d.updated_at
       FROM project_document_mentions m
       INNER JOIN project_documents d ON d.id = m.document_id
       WHERE m.task_id = $1
         AND m.mention_type = 'task'
         AND d.project_id = $2
         AND d.deleted_at IS NULL
       ORDER BY d.updated_at DESC`,
      [taskId, projectId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows.map((row: DocumentRow) => ({
      id: row.id,
      title: row.title,
      project_id: row.project_id,
      updated_at: toIso(row.updated_at),
    }))));
  }
}
