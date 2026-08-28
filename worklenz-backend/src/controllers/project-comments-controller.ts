import { randomUUID } from "crypto";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor, slugify, sanitizeCommentContent, megabytesToBytes } from "../shared/utils";
import { HTML_TAG_REGEXP } from "../shared/constants";
import { IProjectCommentEmailNotification } from "../interfaces/comment-email-notification";
import { sendProjectComment } from "../shared/email-notifications";
import { NotificationsService } from "../services/notifications/notifications.service";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";
import { getBaseUrl } from "../cron_jobs/helpers";
import { syncProjectCommentLinks, deleteCommentLinks } from "../shared/url-extractor";
import { isValidUuid } from "../shared/validation-helpers";
import { uploadBase64, getProjectCommentAttachmentKey, getPublicUrl } from "../shared/storage";
import { getFreePlanSettings, getUsedStorage } from "../ee/shared/paddle-utils";

const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv"
];

interface IMailConfig {
  message: string;
  receiverEmail: string;
  receiverName: string;
  content: string;
  projectId: string;
  teamName: string;
  projectName: string;
}

interface IMention {
  id: string;
  name: string;
}

export default class ProjectCommentsController extends WorklenzControllerBase {

  private static replaceContent(messageContent: string, mentions: { id: string; name: string }[]) {
    const mentionNames = mentions.map(mention => mention.name);

    const replacedContent = mentionNames.reduce(
      (content, mentionName, index) => {
        const regex = new RegExp(`@${mentionName}`, "g");
        return content.replace(regex, `{${index}}`);
      },
      messageContent
    );

    return replacedContent;
  }

  private static restoreMentionPlaceholders(content: string, mentions: IMention[]): string {
    if (!mentions || mentions.length === 0) return sanitizeCommentContent(content);

    let restoredContent = content;
    mentions.forEach((mention, index) => {
      restoredContent = restoredContent
        .replace(new RegExp(`\\{${index}\\}`, "g"), `@${mention.name}`)
        .replace(new RegExp(`\\[${index}\\]`, "g"), `@${mention.name}`);
    });

    return sanitizeCommentContent(restoredContent);
  }

  // Plain-text snippet for list previews and socket payloads: substitutes
  // {index} mention placeholders, strips tags, collapses whitespace.
  private static toPlainPreview(content: string, mentions?: Array<{ user_name?: string; name?: string }>, maxLength = 120): string {
    let text = content || "";
    (mentions || []).forEach((mention, index) => {
      const name = mention?.user_name || mention?.name;
      if (!name) return;
      text = text.replace(new RegExp(`\\{${index}\\}`, "g"), `@${name}`);
    });
    text = text.replace(/<br\s*\/?>/gi, " ").replace(HTML_TAG_REGEXP, "").replace(/\s+/g, " ").trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  private static async sendMail(config: IMailConfig) {
    const subject = config.message.replace(HTML_TAG_REGEXP, "");

    const data: IProjectCommentEmailNotification = {
      greeting: `Hi ${config.receiverName}`,
      summary: subject,
      team: config.teamName,
      project_name: config.projectName,
      comment: config.content,
      settings_url: `${getBaseUrl()}/worklenz/settings/notifications`,
      project_url: `${getBaseUrl()}/worklenz/projects/${config.projectId}`
    };

    await sendProjectComment(config.receiverEmail, data);
  }

  @HandleExceptions()
  public static async uploadAttachment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, fileData, fileName, fileType } = req.body;
    const teamId = req.user?.team_id;

    if (!fileData || !fileName || !project_id) {
      return res.status(400).send(new ServerResponse(false, null, "File data, filename and project are required"));
    }

    const fileSizeBytes = Math.floor((fileData.length * 3) / 4);
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit, matching client-portal chat uploads
    if (fileSizeBytes > maxSizeBytes) {
      return res.status(400).send(new ServerResponse(false, null, "File size exceeds 10MB limit"));
    }

    if (fileType && !ALLOWED_ATTACHMENT_TYPES.includes(fileType)) {
      return res.status(400).send(new ServerResponse(false, null, "File type not allowed"));
    }

    if (req.user?.subscription_status === "free" && req.user?.owner_id) {
      const limits = await getFreePlanSettings();
      const usedStorage = await getUsedStorage(req.user.owner_id);
      if ((parseInt(usedStorage) + fileSizeBytes) > megabytesToBytes(parseInt(limits.free_tier_storage))) {
        return res.status(200).send(new ServerResponse(false, null, `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`));
      }
    }

    const attachmentId = randomUUID();
    const ext = fileName.includes(".") ? fileName.split(".").pop() : "bin";
    const key = getProjectCommentAttachmentKey(teamId as string, project_id, attachmentId, ext);
    const url = await uploadBase64(fileData, key);

    if (!url) {
      return res.status(500).send(new ServerResponse(false, null, "Attachment upload failed"));
    }

    return res.status(200).send(new ServerResponse(true, {
      name: fileName,
      url,
      key,
      type: fileType || null,
      size: fileSizeBytes,
    }));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const mentions: IMention[] = req.body.mentions || [];
    const projectId = req.body.project_id;
    const teamId = req.user?.team_id;

    // Sanitize content to prevent XSS attacks
    let commentContent = sanitizeCommentContent(req.body.content || '');
    let emailCommentContent = commentContent;

    // Process mentions after sanitization to ensure safe HTML
    if (mentions.length > 0) {
      commentContent = await this.replaceContent(commentContent, mentions);
      // Re-sanitize after mention processing to ensure no XSS was introduced
      commentContent = sanitizeCommentContent(commentContent);
      emailCommentContent = this.restoreMentionPlaceholders(commentContent, mentions);
    }

    const replyToId: string | null = req.body.reply_to_id || null;
    if (replyToId) {
      if (!isValidUuid(replyToId))
        return res.status(400).send(new ServerResponse(false, null, "Invalid reply reference"));
      const parent = await db.query(
        `SELECT id FROM project_comments WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [replyToId, projectId]
      );
      if (!parent.rowCount)
        return res.status(400).send(new ServerResponse(false, null, "Invalid reply reference"));
    }

    const body = {
      project_id: projectId,
      created_by: userId,
      content: commentContent,
      mentions,
      team_id: teamId,
      reply_to_id: replyToId
    };

    const q = `SELECT create_project_comment($1) AS comment`;
    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;

    // Attachments are uploaded beforehand (POST /project-comments/attachment/upload);
    // this just persists the metadata against the comment that was just created.
    // Only the storage `key` is persisted (see getPublicUrl) so the URL stays
    // reconstructible if the storage bucket/provider ever changes.
    const attachments: { name: string; key: string; type?: string; size?: number }[] = req.body.attachments || [];
    const savedAttachments = [];
    for (const attachment of attachments) {
      if (!attachment?.key || !attachment?.name) continue;
      const attachmentResult = await db.query(
        `INSERT INTO project_comment_attachments (name, type, size, key, comment_id, project_id, team_id, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, type, size, key, created_at`,
        [attachment.name, attachment.type || null, attachment.size || null, attachment.key, data.comment.id, projectId, teamId, userId]
      );
      const { key: savedKey, ...saved } = attachmentResult.rows[0];
      savedAttachments.push({ ...saved, url: getPublicUrl(savedKey) });
    }
    data.comment.attachments = savedAttachments;

    // Extract and sync links from comment content
    if (teamId && userId) {
      void syncProjectCommentLinks(projectId, data.comment.id, teamId, commentContent, userId);
    }

    const projectMembers = await this.getMembersList(projectId);

    const commentMessage = `<b>${req.user?.name}</b> added a comment on <b>${data.comment.project_name}</b> (${data.comment.team_name})`;
    const mentionedUserIds = new Set((mentions || []).map(mention => mention.id).filter(Boolean));

    // Enriched payload so the Inbox list can update previews/badges in place.
    // Object is truthy, so older `if (isNew)` consumers keep working.
    const newCommentPayload = {
      project_id: projectId,
      comment_id: data.comment.id,
      created_at: data.comment.created_at,
      author_id: userId,
      author_name: req.user?.name,
      preview: this.toPlainPreview(emailCommentContent)
    };

    for (const member of projectMembers || []) {
      if (member.id && member.id === req.user?.id) continue;
      NotificationsService.createNotification({
        userId: member.id,
        teamId: req.user?.team_id as string,
        socketId: member.socket_id,
        message: commentMessage,
        taskId: null,
        projectId
      });
      if (member.id !== req.user?.id && member.socket_id) {
        IO.emit(SocketEvents.NEW_PROJECT_COMMENT_RECEIVED, member.socket_id, newCommentPayload);
      }
      if (member.email_notifications_enabled && !mentionedUserIds.has(member.id))
        await this.sendMail({
          message: commentMessage,
          receiverEmail: member.email,
          receiverName: member.name,
          content: emailCommentContent,
          projectId,
          teamName: data.comment.team_name,
          projectName: data.comment.project_name
        });
    }

    const mentionMessage = `<b>${req.user?.name}</b> has mentioned you in a comment on <b>${data.comment.project_name}</b> (${data.comment.team_name})`;
    const rdMentions = [...new Set(req.body.mentions || [])] as IMention[]; // remove duplicates

    for (const mention of rdMentions) {
      if (mention) {
        const member = await this.getUserDataByUserId(mention.id, projectId, teamId as string);
        if (!member) continue;

        NotificationsService.sendNotification({
          team: data.comment.team_name,
          receiver_socket_id: member.socket_id,
          message: mentionMessage,
          task_id: "",
          project_id: projectId,
          project: data.comment.project_name,
          project_color: member.project_color,
          team_id: req.user?.team_id as string
        });
        if (member.email_notifications_enabled)
          await this.sendMail({
            message: mentionMessage,
            receiverEmail: member.email,
            receiverName: member.name,
            content: emailCommentContent,
            projectId,
            teamName: data.comment.team_name,
            projectName: data.comment.project_name
          });
      }
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getUserDataByUserId(informedBy: string, projectId: string, team_id: string) {
    const q = `
              SELECT id,
                  name,
                  email,
                  socket_id,
                  (SELECT email_notifications_enabled
                  FROM notification_settings
                  WHERE notification_settings.team_id = $3
                    AND notification_settings.user_id = $1),
                  (SELECT color_code FROM projects WHERE id = $2) AS project_color
              FROM users
              WHERE id = $1
                AND users.is_deleted IS NOT TRUE;
    `;
    const result = await db.query(q, [informedBy, projectId, team_id]);
    const [data] = result.rows;
    return data;
  }

  private static async getMembersList(projectId: string) {
    const q = `
            SELECT
                tm.user_id AS id,
                (SELECT name
                FROM team_member_info_view
                WHERE team_member_info_view.team_member_id = tm.id),
                (SELECT email
                FROM team_member_info_view
                WHERE team_member_info_view.team_member_id = tm.id) AS email,
                (SELECT socket_id FROM users WHERE users.id = tm.user_id) AS socket_id,
                (SELECT email_notifications_enabled
                  FROM notification_settings
                  WHERE team_id = tm.team_id
                    AND notification_settings.user_id = tm.user_id) AS email_notifications_enabled
            FROM project_members
                INNER JOIN team_members tm ON project_members.team_member_id = tm.id
                LEFT JOIN users u ON tm.user_id = u.id
            WHERE project_id = $1 AND tm.user_id IS NOT NULL
              AND u.is_deleted IS NOT TRUE
            ORDER BY name
    `;
    const result = await db.query(q, [projectId]);
    const members = result.rows;
    return members;
  }

  @HandleExceptions()
  public static async getMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const members = await this.getMembersList(req.params.id as string);
    return res.status(200).send(new ServerResponse(true, members || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const limit = req.query.isLimit;

    // Optimized query using JOINs instead of subqueries for creator details
    const q = `
      SELECT
        pc.id,
        pc.content AS content,
        (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
        FROM (SELECT u.name  AS user_name,
                     u.email AS user_email
              FROM project_comment_mentions pcm
                    LEFT JOIN users u ON pcm.informed_by = u.id
              WHERE pcm.comment_id = pc.id) rec) AS mentions,
        u.id AS user_id,
        u.name AS created_by,
        u.avatar_url,
        pc.created_at,
        pc.updated_at,
        pc.edited,
        pc.edit_count,
        pc.last_edited_at::TEXT AS last_edited_at,
        (SELECT name FROM users WHERE id = pc.last_edited_by) AS last_edited_by_name,
        get_comment_reactions(pc.id) AS reactions,
        (pc.deleted_at IS NOT NULL) AS is_deleted,
        pc.reply_to_id,
        (CASE WHEN pc.reply_to_id IS NOT NULL THEN
          (SELECT JSON_BUILD_OBJECT(
                    'id', p2.id,
                    'author_name', (SELECT name FROM users WHERE id = p2.created_by),
                    'content_snippet', LEFT(p2.content, 150),
                    'is_deleted', p2.deleted_at IS NOT NULL,
                    'mentions', (SELECT COALESCE(JSON_AGG(rec2), '[]'::JSON)
                                FROM (SELECT u2.name AS user_name
                                      FROM project_comment_mentions pcm2
                                            LEFT JOIN users u2 ON pcm2.informed_by = u2.id
                                      WHERE pcm2.comment_id = p2.id) rec2)
                  )
          FROM project_comments p2
          WHERE p2.id = pc.reply_to_id)
        END) AS reply_to,
        pc.pinned_at,
        pc.pinned_by,
        (SELECT name FROM users WHERE id = pc.pinned_by) AS pinned_by_name,
        (SELECT COALESCE(JSON_AGG(rec3 ORDER BY rec3.created_at), '[]'::JSON)
        FROM (SELECT id, name, type, size, key, created_at
              FROM project_comment_attachments
              WHERE comment_id = pc.id) rec3) AS attachments
      FROM project_comments pc
      LEFT JOIN users u ON pc.created_by = u.id
      WHERE pc.project_id = $1 ORDER BY pc.created_at
    `;
    const result = await db.query(q, [req.params.id]);

    const data = result.rows;

    for (const comment of data) {
      // Deleted messages surface only as a placeholder — never their content.
      if (comment.is_deleted) {
        comment.content = "";
        comment.mentions = [];
        comment.reactions = [];
        comment.reply_to = null;
        comment.attachments = [];
        comment.color_code = getColor(comment.created_by);
        continue;
      }

      if (comment.reply_to) {
        comment.reply_to.content_snippet = comment.reply_to.is_deleted
          ? ""
          : this.toPlainPreview(comment.reply_to.content_snippet, comment.reply_to.mentions, 150);
        delete comment.reply_to.mentions;
      }

      if (comment.attachments?.length) {
        comment.attachments = comment.attachments.map((attachment: { key: string; [k: string]: unknown }) => {
          const { key, ...rest } = attachment;
          return { ...rest, url: getPublicUrl(key) };
        });
      }

      const { mentions } = comment;
      // Process mentions if present
      if (mentions.length > 0) {
        const placeHolders = comment.content.match(/{\d+}/g);
        if (placeHolders) {
          // Replace newlines with <br>
          comment.content = comment.content.replace(/\n/g, "</br>");

          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
            const index = parseInt(placeHolder.match(/\d+/)[0]);
            if (index >= 0 && index < comment.mentions.length) {
              // Determine mention color - default to primary blue equivalent if not handled by CSS class
              comment.content = comment.content.replace(placeHolder, `<span class='mentions'>@${comment.mentions[index].user_name}</span>`);
            }
          });
        }
      } else {
        // Even without mentions, we should handle newlines
        comment.content = comment.content.replace(/\n/g, "</br>");
      }

      const color_code = getColor(comment.created_by);
      comment.color_code = color_code;
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getCountByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT COUNT(*) AS total FROM project_comments WHERE project_id = $1`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, parseInt(data.total)));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const commentId = req.params.id;
    const userId = req.user?.id;

    // Soft delete (owner only) so other members see a "message deleted"
    // placeholder; reactions and edit history are retained for audit.
    const q = `
      UPDATE project_comments
      SET deleted_at = NOW(), deleted_by = $2, pinned_at = NULL, pinned_by = NULL
      WHERE id = $1 AND created_by = $2 AND deleted_at IS NULL
      RETURNING id, project_id
    `;
    const result = await db.query(q, [commentId, userId]);
    const [data] = result.rows;

    if (!data)
      return res.status(200).send(new ServerResponse(false, null, "Comment not found"));

    // Delete associated links when comment is deleted
    void deleteCommentLinks(commentId);

    const members = await this.getMembersList(data.project_id);
    for (const member of members || []) {
      if (member.socket_id) {
        IO.emit(SocketEvents.PROJECT_COMMENT_DELETED, member.socket_id, {
          comment_id: data.id,
          project_id: data.project_id
        });
      }
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getInboxConversations(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    // One row per member project that has at least one non-deleted message:
    // latest message preview + unread count (windowed to 90 days, matching
    // the Business-plan history gate).
    const q = `
      SELECT p.id,
             p.name,
             p.color_code,
             lm.comment_id AS last_comment_id,
             lm.content AS last_content,
             lm.mentions AS last_mentions,
             lm.created_at AS last_at,
             lm.author_id,
             lm.author_name,
             COALESCE(uc.cnt, 0)::INT AS unread_count
      FROM projects p
      JOIN LATERAL (
        SELECT pc.id AS comment_id,
               pc.content,
               pc.created_at,
               pc.created_by AS author_id,
               (SELECT name FROM users WHERE id = pc.created_by) AS author_name,
               (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                FROM (SELECT u2.name AS user_name
                      FROM project_comment_mentions pcm
                            LEFT JOIN users u2 ON pcm.informed_by = u2.id
                      WHERE pcm.comment_id = pc.id) rec) AS mentions
        FROM project_comments pc
        WHERE pc.project_id = p.id AND pc.deleted_at IS NULL
        ORDER BY pc.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM project_comments pc
        WHERE pc.project_id = p.id
          AND pc.deleted_at IS NULL
          AND pc.created_by <> $2
          AND pc.created_at > GREATEST(
            COALESCE((SELECT last_read_at FROM project_comment_reads r
                      WHERE r.user_id = $2 AND r.project_id = p.id), '-infinity'::TIMESTAMPTZ),
            NOW() - INTERVAL '90 days')
      ) uc ON TRUE
      WHERE p.team_id = $1 AND is_member_of_project(p.id, $2, $1)
      ORDER BY lm.created_at DESC
    `;
    const result = await db.query(q, [teamId, userId]);

    for (const row of result.rows) {
      row.last_preview = this.toPlainPreview(row.last_content || "", row.last_mentions);
      delete row.last_content;
      delete row.last_mentions;
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async markAsRead(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO project_comment_reads (user_id, project_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, project_id) DO UPDATE SET last_read_at = NOW(), updated_at = NOW()
      RETURNING project_id, last_read_at
    `;
    const result = await db.query(q, [req.user?.id, req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async setPinned(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const commentId = req.params.id;
    const userId = req.user?.id;
    const pinned = !!req.body.pinned;
    const projectId = req.body.project_id;

    const q = `
      UPDATE project_comments
      SET pinned_at = CASE WHEN $3 THEN NOW() END,
          pinned_by = CASE WHEN $3 THEN $2::UUID END
      WHERE id = $1 AND project_id = $4 AND deleted_at IS NULL
      RETURNING id, project_id, pinned_at, pinned_by,
        (SELECT name FROM users WHERE id = project_comments.pinned_by) AS pinned_by_name
    `;
    const result = await db.query(q, [commentId, userId, pinned, projectId]);
    const [data] = result.rows;

    if (!data)
      return res.status(200).send(new ServerResponse(false, null, "Comment not found"));

    const payload = {
      comment_id: data.id,
      project_id: data.project_id,
      pinned: !!data.pinned_at,
      pinned_at: data.pinned_at,
      pinned_by: data.pinned_by,
      pinned_by_name: data.pinned_by_name
    };

    const members = await this.getMembersList(data.project_id);
    for (const member of members || []) {
      if (member.socket_id) {
        IO.emit(SocketEvents.PROJECT_COMMENT_PIN_CHANGED, member.socket_id, payload);
      }
    }

    return res.status(200).send(new ServerResponse(true, payload));
  }

  @HandleExceptions()
  public static async getPinnedByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT pc.id,
             pc.content,
             (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
              FROM (SELECT u2.name AS user_name
                    FROM project_comment_mentions pcm
                          LEFT JOIN users u2 ON pcm.informed_by = u2.id
                    WHERE pcm.comment_id = pc.id) rec) AS mentions,
             u.id AS user_id,
             u.name AS created_by,
             u.avatar_url,
             pc.created_at,
             pc.pinned_at,
             pc.pinned_by,
             (SELECT name FROM users WHERE id = pc.pinned_by) AS pinned_by_name
      FROM project_comments pc
      LEFT JOIN users u ON pc.created_by = u.id
      WHERE pc.project_id = $1 AND pc.pinned_at IS NOT NULL AND pc.deleted_at IS NULL
      ORDER BY pc.pinned_at DESC
    `;
    const result = await db.query(q, [req.params.id]);

    for (const row of result.rows) {
      row.content_preview = this.toPlainPreview(row.content || "", row.mentions, 200);
      row.color_code = getColor(row.created_by);
      delete row.content;
      delete row.mentions;
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

}
