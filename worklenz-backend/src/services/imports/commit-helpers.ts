import { PoolClient } from "pg";
import axios from "axios";
import { getKey, uploadBuffer } from "../../shared/storage";
import {
  ImportedJiraAttachment,
  ImportedJiraComment,
  ImportedJiraWorklog,
  TaskAttachmentImportContext,
  TaskCommentImportContext,
} from "./types";
import {
  clampText,
  normalizeFileExtension,
  parseImportedArray,
  safeDate,
} from "./value-utils";

/** Imports Jira comments attached to a staged task's raw payload. Returns the number of comments inserted. */
export const importTaskComments = async (
  client: PoolClient,
  taskId: string,
  raw: unknown,
  ctx: TaskCommentImportContext,
): Promise<number> => {
  if (!ctx.creatorTeamMemberId) return 0;
  const comments = parseImportedArray<ImportedJiraComment>(
    raw,
    "__jira_comments",
  );
  let imported = 0;
  for (const comment of comments) {
    const body = (comment?.body || "").trim();
    if (!body) continue;
    const author = (comment?.author || "Unknown").trim();
    const createdSuffix = comment?.created ? ` (${comment.created})` : "";
    const content = clampText(
      `${author}${createdSuffix}: ${body}`.trim(),
      5000,
    );
    if (!content) continue;
    const createdAt = safeDate(comment?.created || null);
    const sourceAccountId = (comment?.authorAccountId || "").trim();
    const sourceEmail = (comment?.authorEmail || "").trim().toLowerCase();
    const mappedUserId =
      (sourceAccountId ? ctx.assigneeMap.get(sourceAccountId) : null) ||
      (sourceAccountId
        ? ctx.assigneeMap.get(sourceAccountId.toLowerCase())
        : null) ||
      (sourceEmail ? ctx.assigneeMap.get(sourceEmail) : null) ||
      null;
    const mappedTeamMemberId = mappedUserId
      ? ctx.teamMemberUserMap.get(mappedUserId) || null
      : null;
    const emailTeamMemberId = sourceEmail
      ? ctx.teamMemberEmailMap.get(sourceEmail) || null
      : null;

    let commentUserId = ctx.createdByUserId;
    let commentTeamMemberId = ctx.creatorTeamMemberId;

    if (mappedUserId && mappedTeamMemberId) {
      commentUserId = mappedUserId;
      commentTeamMemberId = mappedTeamMemberId;
    } else if (sourceEmail && emailTeamMemberId) {
      const resolvedUserId =
        ctx.teamMemberUserIdByEmailMap.get(sourceEmail) || null;
      if (resolvedUserId) {
        commentUserId = resolvedUserId;
        commentTeamMemberId = emailTeamMemberId;
      }
    }

    const result = await client.query(
      `INSERT INTO task_comments (user_id, team_member_id, task_id, created_at, updated_at)
           VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), COALESCE($4::timestamptz, NOW()))
           RETURNING id`,
      [commentUserId, commentTeamMemberId, taskId, createdAt],
    );
    const commentId = result.rows?.[0]?.id || null;
    if (!commentId) continue;
    await client.query(
      "INSERT INTO task_comment_contents (index, comment_id, text_content) VALUES ($1, $2, $3)",
      [0, commentId, content],
    );
    imported += 1;
  }
  return imported;
};

/** Imports Jira worklogs attached to a staged task's raw payload. Returns the number of worklogs inserted. */
export const importTaskWorklogs = async (
  client: PoolClient,
  taskId: string,
  raw: unknown,
  createdByUserId: string,
): Promise<number> => {
  const worklogs = parseImportedArray<ImportedJiraWorklog>(
    raw,
    "__jira_worklogs",
  );
  let imported = 0;
  for (const worklog of worklogs) {
    const seconds = Math.max(0, Number(worklog?.timeSpentSeconds || 0));
    if (!seconds) continue;
    const author = (worklog?.author || "Unknown").trim();
    const startedSuffix = worklog?.started ? ` (${worklog.started})` : "";
    const note = (worklog?.comment || "").trim();
    const description = clampText(
      `Imported from Jira by ${author}${startedSuffix}${note ? ` - ${note}` : ""}`.trim(),
      500,
    );
    const loggedAt = safeDate(worklog?.started || worklog?.created || null);
    await client.query(
      `INSERT INTO task_work_log (time_spent, description, task_id, user_id, created_at, updated_at, logged_by_timer)
           VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), COALESCE($5::timestamptz, NOW()), FALSE)`,
      [seconds, description || null, taskId, createdByUserId, loggedAt],
    );
    imported += 1;
  }
  return imported;
};

/** Downloads and imports Jira attachments referenced in a staged task's raw payload. */
export const importTaskAttachments = async (
  client: PoolClient,
  taskId: string,
  raw: unknown,
  ctx: TaskAttachmentImportContext,
): Promise<{ attachments: number; attachmentFailures: number }> => {
  let attachments = 0;
  let attachmentFailures = 0;
  if (!ctx.shouldImportAttachments || !ctx.targetTeamId) {
    return { attachments, attachmentFailures };
  }
  const items = parseImportedArray<ImportedJiraAttachment>(
    raw,
    "__jira_attachments",
  );
  for (const attachment of items) {
    const sourceUrl = (attachment?.url || "").trim();
    if (!sourceUrl) continue;
    const fileName = clampText(
      (attachment?.filename || "jira-attachment").trim() ||
        "jira-attachment",
      110,
    );
    const extension = normalizeFileExtension(
      fileName,
      attachment?.mimeType || null,
      sourceUrl,
    );
    const contentType = attachment?.mimeType || "application/octet-stream";
    try {
      const response = await axios.get<ArrayBuffer>(sourceUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: ctx.jiraAuthHeader
          ? { Authorization: ctx.jiraAuthHeader, Accept: "*/*" }
          : { Accept: "*/*" },
      });
      const buffer = Buffer.from(response.data);
      const sizeBytes =
        attachment?.size && attachment.size > 0
          ? attachment.size
          : buffer.length;
      const insert = await client.query(
        `INSERT INTO task_attachments (name, task_id, team_id, project_id, uploaded_by, size, type)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
        [
          fileName,
          taskId,
          ctx.targetTeamId,
          ctx.targetProjectId,
          ctx.createdByUserId,
          sizeBytes,
          extension,
        ],
      );
      const attachmentId = insert.rows?.[0]?.id || null;
      if (!attachmentId) {
        attachmentFailures += 1;
        continue;
      }
      const storageKey = getKey(
        ctx.targetTeamId,
        ctx.targetProjectId,
        attachmentId,
        extension,
      );
      const uploaded = await uploadBuffer(buffer, contentType, storageKey);
      if (!uploaded) {
        await client.query("DELETE FROM task_attachments WHERE id = $1", [
          attachmentId,
        ]);
        attachmentFailures += 1;
        continue;
      }
      attachments += 1;
    } catch (err) {
      attachmentFailures += 1;
    }
  }
  return { attachments, attachmentFailures };
};
