import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { NotificationsService } from "../services/notifications/notifications.service";
import { humanFileSize, log_error, megabytesToBytes, sanitizeCommentContent, sanitizePlainText } from "../shared/utils";
import { HTML_TAG_REGEXP, S3_URL } from "../shared/constants";
import { getBaseUrl } from "../cron_jobs/helpers";
import { ICommentEmailNotification } from "../interfaces/comment-email-notification";
import { sendTaskComment } from "../shared/email-notifications";
import { getRootDir, uploadBase64, getKey, getTaskAttachmentKey, createPresignedUrlWithClient } from "../shared/s3";
import { getFreePlanSettings, getUsedStorage } from "../shared/licensing-utils";
import { ExternalNotificationsService } from "../services/external-notifications.service";

interface ITaskAssignee {
  team_member_id: string;
  project_member_id: string;
  name: string;
  email_notifications_enabled: string;
  avatar_url: string;
  user_id: string;
  email: string;
  socket_id: string;
  team_id: string;
  user_name: string;
}

interface IMailConfig {
  message: string;
  receiverEmail: string;
  receiverName: string;
  content: string;
  commentId: string;
  projectId: string;
  taskId: string;
  teamName: string;
  projectName: string;
  taskName: string;
}

interface IMention {
  team_member_id: string;
  name: string;
}

async function getAssignees(taskId: string): Promise<Array<ITaskAssignee>> {
  const result1 = await db.query("SELECT get_task_assignees($1) AS assignees;", [taskId]);
  const [d] = result1.rows;
  return d.assignees || [];
}

export default class TaskCommentsController extends WorklenzControllerBase {

  private static replaceContent(messageContent: string, mentions: IMention[]) {
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
    if (!mentions || mentions.length === 0) return content;

    // Convert frontend mention format [0], [1], etc. to actual mention names
    let restoredContent = content;
    mentions.forEach((mention, index) => {
      // Replace [index] with @name
      const regex = new RegExp(`\\[${index}\\]`, "g");
      restoredContent = restoredContent.replace(regex, `@${mention.name}`);
    });

    return restoredContent;
  }

  private static async getUserDataByTeamMemberId(senderUserId: string, teamMemberId: string, projectId: string) {
    const q = `
      SELECT id,
             socket_id,
             users.name AS user_name,
             users.email,
             (SELECT email_notifications_enabled
              FROM notification_settings
              WHERE notification_settings.team_id = (SELECT team_id FROM team_members WHERE id = $2)
                AND notification_settings.user_id = users.id) AS email_notifications_enabled,
             (SELECT name FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = $2)) AS team,
             (SELECT name FROM projects WHERE id = $3) AS project,
             (SELECT color_code FROM projects WHERE id = $3) AS project_color
      FROM users
      WHERE id != $1
        AND id IN (SELECT user_id FROM team_members WHERE id = $2)
        AND users.is_deleted IS NOT TRUE;
    `;
    const result = await db.query(q, [senderUserId, teamMemberId, projectId]);
    const [data] = result.rows;
    return data;
  }

  private static async updateComment(commentId: string, messageId: string) {
    if (!commentId || !messageId) return;
    try {
      await db.query("UPDATE task_comments SET ses_message_id = $2 WHERE id = $1;", [commentId, messageId]);
    } catch (e) {
      log_error(e);
    }
  }

  private static async sendMail(config: IMailConfig) {
    const subject = config.message.replace(HTML_TAG_REGEXP, "");
    const taskUrl = `${getBaseUrl()}/worklenz/projects/${config.projectId}?tab=tasks-list&task=${config.taskId}&focus=comments`;
    const settingsUrl = `${getBaseUrl()}/worklenz/settings/notifications`;

    const data: ICommentEmailNotification = {
      greeting: `Hi ${config.receiverName}`,
      summary: subject,
      team: config.teamName,
      project_name: config.projectName,
      comment: config.content,
      task: config.taskName,
      settings_url: settingsUrl,
      task_url: taskUrl,
    };

    const messageId = await sendTaskComment(config.receiverEmail, data);
    if (messageId) {
      void TaskCommentsController.updateComment(config.commentId, messageId);
    }
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.user_id = req.user?.id;
    req.body.team_id = req.user?.team_id;
    const { mentions, attachments, task_id } = req.body;
    const url = `${S3_URL}/${getRootDir()}`;

    let commentContent = req.body.content || '';
    let restoredContentForEmail = commentContent; // Keep original for email restoration

    if (mentions.length > 0) {
      // Restore mention placeholders for email display (convert [0], [1] to actual names)
      restoredContentForEmail = this.restoreMentionPlaceholders(commentContent, mentions);
      restoredContentForEmail = sanitizeCommentContent(restoredContentForEmail);
      
      commentContent = this.replaceContent(commentContent, mentions);
      commentContent = sanitizeCommentContent(commentContent);
    } else {
      restoredContentForEmail = sanitizeCommentContent(commentContent);
    }

    req.body.content = commentContent;

    const q = `SELECT create_task_comment($1) AS comment;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    const response = data.comment;
    const commentId = response.id;

    // Bump the parent task's updated_at so the "Updated X ago" timestamp reflects the new comment
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [task_id]);

    if (attachments.length !== 0) {
      for (const attachment of attachments) {
        const q = `
          INSERT INTO task_comment_attachments (name, type, size, task_id, comment_id, team_id, project_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, name, type, task_id, comment_id, created_at,
          CONCAT($8::TEXT, '/', team_id, '/', project_id, '/', task_id, '/', comment_id, '/', id, '.', type) AS url;
        `;
        const result = await db.query(q, [
          attachment.file_name,
          attachment.file_name.split(".").pop(),
          attachment.size,
          task_id,
          commentId,
          req.user?.team_id,
          attachment.project_id,
          url
        ]);
        const [data] = result.rows;
        const s3Url = await uploadBase64(attachment.file, getTaskAttachmentKey(req.user?.team_id as string, attachment.project_id, task_id, commentId, data.id, data.type));
        if (!data?.id || !s3Url)
          return res.status(200).send(new ServerResponse(false, null, "Attachment upload failed"));
      }
    }

    const safeName = sanitizePlainText(req.user?.name || "Unknown User");
    const mentionMessage = `<b>${safeName}</b> has mentioned you in a comment on <b>${response.task_name}</b> (${response.team_name})`;
    const assignees = await getAssignees(req.body.task_id);
    const commentMessage = `<b>${safeName}</b> added a comment on <b>${response.task_name}</b> (${response.team_name})`;

    for (const member of assignees || []) {
      if (member.user_id && member.user_id === req.user?.id) continue;

      void NotificationsService.createNotification({
        userId: member.user_id,
        teamId: req.user?.team_id as string,
        socketId: member.socket_id,
        message: commentMessage,
        taskId: req.body.task_id,
        projectId: response.project_id
      });

      if (member.email_notifications_enabled)
        await this.sendMail({
          message: commentMessage,
          receiverEmail: member.email,
          receiverName: member.name,
          content: restoredContentForEmail,
          commentId: response.id,
          projectId: response.project_id,
          taskId: req.body.task_id,
          teamName: response.team_name,
          projectName: response.project_name,
          taskName: response.task_name
        });
    }

    const senderUserId = req.user?.id as string;

    for (const mention of mentions) {
      if (mention) {
        const member = await this.getUserDataByTeamMemberId(senderUserId, mention.team_member_id, response.project_id);
        if (member) {
          NotificationsService.sendNotification({
            team: member.team,
            receiver_socket_id: member.socket_id,
            message: mentionMessage,
            task_id: req.body.task_id,
            project_id: response.project_id,
            project: member.project,
            project_color: member.project_color,
            team_id: req.user?.team_id as string
          });

          if (member.email_notifications_enabled)
            await this.sendMail({
              message: mentionMessage,
              receiverEmail: member.email,
              receiverName: member.user_name,
              content: restoredContentForEmail,
              commentId: response.id,
              projectId: response.project_id,
              taskId: req.body.task_id,
              teamName: response.team_name,
              projectName: response.project_name,
              taskName: response.task_name
            });
        }
      }
    }

    const avatarQuery = `SELECT avatar_url FROM users WHERE id = $1`;
    const avatarResult = await db.query(avatarQuery, [req.user?.id]);
    const avatarUrl = avatarResult.rows[0]?.avatar_url || "";

    const commentQuery = `SELECT created_at FROM task_comments WHERE id = $1`;
    const commentResult = await db.query(commentQuery, [response.id]);
    const commentData = commentResult.rows[0];

    const attachmentsQuery = `SELECT id, name, type, size FROM task_comment_attachments WHERE comment_id = $1`;
    const attachmentsResult = await db.query(attachmentsQuery, [response.id]);
    const commentAttachments = attachmentsResult.rows.map((att: any) => ({
      id: att.id,
      name: att.name,
      type: att.type,
      size: att.size
    }));

    const commentdata = {
      attachments: commentAttachments,
      avatar_url: avatarUrl,
      content: req.body.content,
      created_at: commentData?.created_at || new Date().toISOString(),
      edit: false,
      id: response.id,
      member_name: req.user?.name || "",
      mentions: mentions || [],
      rawContent: req.body.content,
      reactions: {},
      team_member_id: req.user?.team_member_id || "",
      user_id: req.user?.id || ""
    };

    try {
      await ExternalNotificationsService.sendExternalNotifications(
        response.project_id,
        req.body.task_id,
        "comment_added",
        req.user?.name || "Unknown User"
      );
    } catch (notifError) {
      log_error("Error sending external notifications for comment:", notifError);
    }

    return res.status(200).send(new ServerResponse(true, commentdata));
  } // ← end of create()

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const commentId = req.params.id;

    let commentContent = req.body.content || '';
    const mentions: IMention[] = req.body.mentions || [];
    let restoredContentForEmail = commentContent; // Keep original for email restoration

    if (mentions.length > 0) {
      commentContent = this.replaceContent(commentContent, mentions);
      commentContent = sanitizeCommentContent(commentContent);
      // Restore from original (unsanitized) content for email
      restoredContentForEmail = sanitizeCommentContent(restoredContentForEmail);
    } else {
      restoredContentForEmail = sanitizeCommentContent(commentContent);
    }

    // ✅ UPDATE existing row — mark as edited
    const updateCommentQ = `
      UPDATE task_comments
      SET updated_at = NOW(),
          is_edited  = TRUE
      WHERE id = $1
        AND user_id = $2
      RETURNING id, task_id, user_id, team_member_id, created_at, updated_at;
    `;
    const updateResult = await db.query(updateCommentQ, [commentId, req.user?.id]);

    if ((updateResult.rowCount ?? 0) === 0) {
      return res.status(200).send(new ServerResponse(false, null, "Comment not found or you don't have permission to edit it"));
    }

    const updatedComment = updateResult.rows[0];

    // Bump the parent task's updated_at so the "Updated X ago" timestamp reflects the edit
    await db.query(`UPDATE tasks SET updated_at = NOW() WHERE id = $1;`, [updatedComment.task_id]);

    // ✅ Update content — check first to avoid ON CONFLICT issues
    const contentExistsResult = await db.query(
      `SELECT comment_id FROM task_comment_contents WHERE comment_id = $1;`,
      [commentId]
    );

    if ((contentExistsResult.rowCount ?? 0) > 0) {
      await db.query(
        `UPDATE task_comment_contents SET text_content = $1 WHERE comment_id = $2;`,
        [commentContent, commentId]
      );
    } else {
      await db.query(
        `INSERT INTO task_comment_contents (comment_id, text_content) VALUES ($1, $2);`,
        [commentId, commentContent]
      );
    }

    // ✅ Send email notifications for mentions
    if (mentions.length > 0) {
      // Get task details for email
      const taskDetailsQ = `
        SELECT id, name AS task_name, project_id, 
               (SELECT name FROM projects WHERE id = tasks.project_id) AS project_name,
               (SELECT name FROM teams WHERE id = (SELECT team_id FROM projects WHERE id = tasks.project_id)) AS team_name
        FROM tasks
        WHERE id = $1;
      `;
      const taskDetailsResult = await db.query(taskDetailsQ, [updatedComment.task_id]);
      const taskDetails = taskDetailsResult.rows[0];

      if (taskDetails) {
        const safeName = sanitizePlainText(req.user?.name || "Unknown User");
        const mentionMessage = `<b>${safeName}</b> has mentioned you in an updated comment on <b>${taskDetails.task_name}</b> (${taskDetails.team_name})`;
        const senderUserId = req.user?.id as string;

        for (const mention of mentions) {
          if (mention) {
            const member = await this.getUserDataByTeamMemberId(senderUserId, mention.team_member_id, taskDetails.project_id);
            if (member && member.email_notifications_enabled) {
              await this.sendMail({
                message: mentionMessage,
                receiverEmail: member.email,
                receiverName: member.user_name,
                content: restoredContentForEmail,
                commentId: commentId,
                projectId: taskDetails.project_id,
                taskId: updatedComment.task_id,
                teamName: taskDetails.team_name,
                projectName: taskDetails.project_name,
                taskName: taskDetails.task_name
              });
            }
          }
        }
      }
    }

    return res.status(200).send(new ServerResponse(true, {
      id: updatedComment.id,
      task_id: updatedComment.task_id,
      content: commentContent,
      is_edited: true,
      updated_at: updatedComment.updated_at,
    }));
  } // ← end of update()

  @HandleExceptions()
  public static async getByTaskId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const result = await TaskCommentsController.getTaskComments(req.params.id);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  private static async getTaskComments(taskId: string) {
    const url = `${S3_URL}/${getRootDir()}`;

    const q = `SELECT task_comments.id,
                    tc.text_content AS content,
                    task_comments.user_id,
                    task_comments.team_member_id,
                    task_comments.task_id,
                    task_comments.is_edited,
                    (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS member_name,
                    u.avatar_url,
                    task_comments.created_at,
                    task_comments.updated_at,
                    (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                      FROM (SELECT tmiv.name AS user_name,
                                  tmiv.email AS user_email
                            FROM task_comment_mentions tcm
                                    LEFT JOIN team_member_info_view tmiv ON tcm.informed_by = tmiv.team_member_id
                            WHERE tcm.comment_id = task_comments.id) rec) AS mentions,
                    (SELECT JSON_OBJECT_AGG(
                            reaction_type,
                            JSON_BUILD_OBJECT(
                                'count', count,
                                'reacted_members', reacted_members,
                                'reacted_member_ids', reacted_member_ids
                            )
                        )
                      FROM (
                          SELECT
                              tcr.reaction_type,
                              COUNT(*) as count,
                              COALESCE(JSON_AGG(tmiv.name), '[]'::JSON) as reacted_members,
                              COALESCE(JSON_AGG(tmiv.team_member_id), '[]'::JSON) as reacted_member_ids
                          FROM task_comment_reactions tcr
                          JOIN team_member_info_view tmiv ON tcr.team_member_id = tmiv.team_member_id
                          WHERE tcr.comment_id = task_comments.id
                          GROUP BY tcr.reaction_type
                      ) reactions
                    ) AS reactions,
                    (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                      FROM (SELECT id, created_at, name, size, type, (CONCAT('/', team_id, '/', project_id, '/', task_id, '/', comment_id, '/', id, '.', type)) AS url
                            FROM task_comment_attachments tca
                            WHERE tca.comment_id = task_comments.id) rec) AS attachments
              FROM task_comments
                      LEFT JOIN task_comment_contents tc ON task_comments.id = tc.comment_id
                      INNER JOIN team_members tm ON task_comments.team_member_id = tm.id
                      LEFT JOIN users u ON tm.user_id = u.id
              WHERE task_comments.task_id = $1
              ORDER BY task_comments.created_at;`;
    const result = await db.query(q, [taskId]);

    for (const comment of result.rows) {
      if (!comment.content) comment.content = "";
      comment.rawContent = comment.content;
      comment.content = comment.content.replace(/\n/g, "</br>");
      comment.edit = false;
      const { mentions } = comment;
      if (mentions.length > 0) {
        const placeHolders = comment.content.match(/{\d+}/g);
        if (placeHolders) {
          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
            const index = parseInt(placeHolder.match(/\d+/)[0]);
            if (index >= 0 && index < comment.mentions.length) {
              comment.rawContent = comment.rawContent.replace(placeHolder, `@${comment.mentions[index].user_name}`);
              comment.content = comment.content.replace(placeHolder, `<span class="mentions"> @${comment.mentions[index].user_name} </span>`);
            }
          });
        }
      }

      for (const attachment of comment.attachments) {
        attachment.size = humanFileSize(attachment.size);
        attachment.url = url + attachment.url;
      }
    }

    return result;
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE
               FROM task_comments
               WHERE id = $1
                 AND task_id = $2
                 AND user_id = $3;`;
    const result = await db.query(q, [req.params.id, req.params.taskId, req.user?.id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteAttachmentById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE
                FROM task_comment_attachments
                WHERE id = $1;`;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  private static async checkIfAlreadyExists(commentId: string, teamMemberId: string | undefined, reaction_type: string) {
    if (!teamMemberId) return null;
    try {
      const q = `SELECT reaction_type FROM task_comment_reactions WHERE comment_id = $1 AND team_member_id = $2`;
      const result = await db.query(q, [commentId, teamMemberId]);
      if (result.rows.length > 0) {
        return result.rows[0].reaction_type;
      }
      return null;
    } catch (error) {
      log_error(error);
      return null;
    }
  }

  private static async getTaskCommentData(commentId: string) {
    if (!commentId) return;
    try {
      const q = `SELECT tc.user_id,
                      t.project_id,
                      t.name AS task_name,
                      (SELECT team_id FROM projects p WHERE p.id = t.project_id) AS team_id,
                      (SELECT name FROM teams te WHERE id = (SELECT team_id FROM projects p WHERE p.id = t.project_id)) AS team_name,
                      (SELECT u.socket_id FROM users u WHERE u.id = tc.user_id) AS socket_id,
                      (SELECT name FROM team_member_info_view tmiv WHERE tmiv.team_member_id = tcr.team_member_id) AS reactor_name
                FROM task_comments tc
                        LEFT JOIN tasks t ON t.id = tc.task_id
                        LEFT JOIN task_comment_reactions tcr ON tc.id = tcr.comment_id
                WHERE tc.id = $1;`;
      const result = await db.query(q, [commentId]);
      const [data] = result.rows;
      return data;
    } catch (error) {
      log_error(error);
    }
  }

  @HandleExceptions()
  public static async updateReaction(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { reaction_type, task_id } = req.query;

    const validReactionTypes = ['like', 'love', 'celebrate', 'support', 'insightful', 'curious'];
    if (!validReactionTypes.includes(reaction_type as string)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid reaction type"));
    }

    const existingReaction = await this.checkIfAlreadyExists(id, req.user?.team_member_id, reaction_type as string);

    if (existingReaction === reaction_type) {
      const deleteQ = `DELETE FROM task_comment_reactions WHERE comment_id = $1 AND team_member_id = $2;`;
      await db.query(deleteQ, [id, req.user?.team_member_id]);
    } else if (existingReaction) {
      const updateQ = `UPDATE task_comment_reactions SET reaction_type = $1 WHERE comment_id = $2 AND team_member_id = $3;`;
      await db.query(updateQ, [reaction_type, id, req.user?.team_member_id]);

      const getTaskCommentData = await TaskCommentsController.getTaskCommentData(id);
      const safeReactorName = sanitizePlainText(getTaskCommentData.reactor_name || "Unknown User");
      const commentMessage = `<b>${safeReactorName}</b> reacted to your comment on <b>${getTaskCommentData.task_name}</b> (${getTaskCommentData.team_name})`;

      if (getTaskCommentData && getTaskCommentData.user_id !== req.user?.id) {
        void NotificationsService.createNotification({
          userId: getTaskCommentData.user_id,
          teamId: req.user?.team_id as string,
          socketId: getTaskCommentData.socket_id,
          message: commentMessage,
          taskId: req.body.task_id,
          projectId: getTaskCommentData.project_id
        });
      }
    } else {
      const q = `INSERT INTO task_comment_reactions (comment_id, user_id, team_member_id, reaction_type) VALUES ($1, $2, $3, $4);`;
      await db.query(q, [id, req.user?.id, req.user?.team_member_id, reaction_type]);

      const getTaskCommentData = await TaskCommentsController.getTaskCommentData(id);
      const safeReactorName = sanitizePlainText(getTaskCommentData.reactor_name || "Unknown User");
      const commentMessage = `<b>${safeReactorName}</b> reacted to your comment on <b>${getTaskCommentData.task_name}</b> (${getTaskCommentData.team_name})`;

      if (getTaskCommentData && getTaskCommentData.user_id !== req.user?.id) {
        void NotificationsService.createNotification({
          userId: getTaskCommentData.user_id,
          teamId: req.user?.team_id as string,
          socketId: getTaskCommentData.socket_id,
          message: commentMessage,
          taskId: req.body.task_id,
          projectId: getTaskCommentData.project_id
        });
      }
    }

    const result = await TaskCommentsController.getTaskComments(task_id as string);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async createAttachment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.user_id = req.user?.id;
    req.body.team_id = req.user?.team_id;
    const { attachments, task_id } = req.body;

    const q = `INSERT INTO task_comments (user_id, team_member_id, task_id)
                  VALUES ($1, (SELECT id
                              FROM team_members
                              WHERE user_id = $1
                                AND team_id = $2::UUID), $3)
                  RETURNING id;`;
    const result = await db.query(q, [req.user?.id, req.user?.team_id, task_id]);
    const [data] = result.rows;
    const commentId = data.id;
    const url = `${S3_URL}/${getRootDir()}`;

    for (const attachment of attachments) {
      if (req.user?.subscription_status === "free" && req.user?.owner_id) {
        const limits = await getFreePlanSettings();
        const usedStorage = await getUsedStorage(req.user?.owner_id);
        if ((parseInt(usedStorage) + attachment.size) > megabytesToBytes(parseInt(limits.free_tier_storage))) {
          return res.status(200).send(new ServerResponse(false, [], `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`));
        }
      }

      const q = `
        INSERT INTO task_comment_attachments (name, type, size, task_id, comment_id, team_id, project_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, name, type, task_id, comment_id, created_at,
        CONCAT($8::TEXT, '/', team_id, '/', project_id, '/', task_id, '/', comment_id, '/', id, '.', type) AS url;
      `;
      const result = await db.query(q, [
        attachment.file_name,
        attachment.size,
        attachment.file_name.split(".").pop(),
        task_id,
        commentId,
        req.user?.team_id,
        attachment.project_id,
        url
      ]);
      const [data] = result.rows;
      const s3Url = await uploadBase64(attachment.file, getTaskAttachmentKey(req.user?.team_id as string, attachment.project_id, task_id, commentId, data.id, data.type));
      if (!data?.id || !s3Url)
        return res.status(200).send(new ServerResponse(false, null, "Attachment upload failed"));
    }

    const assignees = await getAssignees(task_id);
    const safeName = sanitizePlainText(req.user?.name || "Unknown User");
    const commentMessage = `<b>${safeName}</b> added a new attachment as a comment on <b>${commentId.task_name}</b> (${commentId.team_name})`;

    for (const member of assignees || []) {
      if (member.user_id && member.user_id === req.user?.id) continue;

      void NotificationsService.createNotification({
        userId: member.user_id,
        teamId: req.user?.team_id as string,
        socketId: member.socket_id,
        message: commentMessage,
        taskId: task_id,
        projectId: commentId.project_id
      });

      if (member.email_notifications_enabled)
        await this.sendMail({
          message: commentMessage,
          receiverEmail: member.email,
          receiverName: member.name,
          content: req.body.content,
          commentId: commentId.id,
          projectId: commentId.project_id,
          taskId: task_id,
          teamName: commentId.team_name,
          projectName: commentId.project_name,
          taskName: commentId.task_name
        });
    }

    return res.status(200).send(new ServerResponse(true, []));
  }

  @HandleExceptions()
  public static async download(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT CONCAT($2::TEXT, '/', team_id, '/', project_id, '/', task_id, '/', comment_id, '/', id, '.', type) AS key
               FROM task_comment_attachments
               WHERE id = $1;`;
    const result = await db.query(q, [req.query.id, getRootDir()]);
    const [data] = result.rows;

    if (data?.key) {
      const url = await createPresignedUrlWithClient(data.key, req.query.file as string);
      return res.status(200).send(new ServerResponse(true, url));
    }

    return res.status(200).send(new ServerResponse(true, null));
  }

} 