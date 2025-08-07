import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { NotificationsService } from "../services/notifications/notifications.service";
import { humanFileSize, log_error, megabytesToBytes } from "../shared/utils";
import { HTML_TAG_REGEXP, S3_URL } from "../shared/constants";
import { getBaseUrl } from "../cron_jobs/helpers";
import { ICommentEmailNotification } from "../interfaces/comment-email-notification";
import { sendTaskComment } from "../shared/email-notifications";
import { getRootDir, uploadBase64, getKey, getTaskAttachmentKey, createPresignedUrlWithClient } from "../shared/s3";
import { getFreePlanSettings, getUsedStorage } from "../shared/paddle-utils";

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

  private static async getUserDataByTeamMemberId(senderUserId: string, teamMemberId: string, projectId: string) {
    const q = `
      SELECT id,
             socket_id,
             users.name AS user_name,
             (SELECT email_notifications_enabled
              FROM notification_settings
              WHERE notification_settings.team_id = (SELECT team_id FROM team_members WHERE id = $2)
                AND notification_settings.user_id = users.id),
             (SELECT name FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = $2)) AS team,
             (SELECT name FROM projects WHERE id = $3) AS project,
             (SELECT color_code FROM projects WHERE id = $3) AS project_color
      FROM users
      WHERE id != $1
        AND id IN (SELECT user_id FROM team_members WHERE id = $2);
    `;
    const result = await db.query(q, [senderUserId, teamMemberId, projectId]);
    const [data] = result.rows;
    return data;
  }

  private static async updateComment(commentId: string, messageId: string) {
    if (!commentId || messageId) return;
    try {
      await db.query("UPDATE task_comments SET ses_message_id = $2 WHERE id = $1;", [commentId, messageId]);
    } catch (e) {
      log_error(e);
    }
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.user_id = req.user?.id;
    req.body.team_id = req.user?.team_id;
    const { mentions, attachments, task_id } = req.body;
    const url = `${S3_URL}/${getRootDir()}`;

    let commentContent = req.body.content;
    if (mentions.length > 0) {
      commentContent = this.replaceContent(commentContent, mentions);
    }

    req.body.content = commentContent;

    const q = `SELECT create_task_comment($1) AS comment;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    const response = data.comment;

    const commentId = response.id;

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

    const mentionMessage = `<b>${req.user?.name}</b> has mentioned you in a comment on <b>${response.task_name}</b> (${response.team_name})`;
    // const mentions = [...new Set(req.body.mentions || [])] as string[]; // remove duplicates

    const assignees = await getAssignees(req.body.task_id);

    const commentMessage = `<b>${req.user?.name}</b> added a comment on <b>${response.task_name}</b> (${response.team_name})`;
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
          content: req.body.content,
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
              content: req.body.content,
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

    // Get user avatar URL from database
    const avatarQuery = `SELECT avatar_url FROM users WHERE id = $1`;
    const avatarResult = await db.query(avatarQuery, [req.user?.id]);
    const avatarUrl = avatarResult.rows[0]?.avatar_url || "";

    // Get comment details including created_at
    const commentQuery = `SELECT created_at FROM task_comments WHERE id = $1`;
    const commentResult = await db.query(commentQuery, [response.id]);
    const commentData = commentResult.rows[0];

    // Get attachments if any
    const attachmentsQuery = `SELECT id, name, type, size FROM task_comment_attachments WHERE comment_id = $1`;
    const attachmentsResult = await db.query(attachmentsQuery, [response.id]);
    const commentAttachments = attachmentsResult.rows.map(att => ({
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
      reactions: {
        likes: {
          count: 0,
          liked_members: [],
          liked_member_ids: []
        }
      },
      team_member_id: req.user?.team_member_id || "",
      user_id: req.user?.id || ""
    };

    return res.status(200).send(new ServerResponse(true, commentdata));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.user_id = req.user?.id;
    req.body.team_id = req.user?.team_id;
    const { mentions, comment_id } = req.body;

    let commentContent = req.body.content;
    if (mentions.length > 0) {
      commentContent = await this.replaceContent(commentContent, mentions);
    }

    req.body.content = commentContent;

    const q = `SELECT create_task_comment($1) AS comment;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    const response = data.comment;

    const mentionMessage = `<b>${req.user?.name}</b> has mentioned you in a comment on <b>${response.task_name}</b> (${response.team_name})`;
    // const mentions = [...new Set(req.body.mentions || [])] as string[]; // remove duplicates

    const assignees = await getAssignees(req.body.task_id);

    const commentMessage = `<b>${req.user?.name}</b> added a comment on <b>${response.task_name}</b> (${response.team_name})`;
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
          content: req.body.content,
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
              content: req.body.content,
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

    return res.status(200).send(new ServerResponse(true, data.comment));
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
  public static async getByTaskId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const result = await TaskCommentsController.getTaskComments(req.params.id); // task id
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  private static async getTaskComments(taskId: string) {
    const url = `${S3_URL}/${getRootDir()}`;

    const q = `SELECT task_comments.id,
                    tc.text_content AS content,
                    task_comments.user_id,
                    task_comments.team_member_id,
                    (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS member_name,
                    u.avatar_url,
                    task_comments.created_at,
                    (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                      FROM (SELECT tmiv.name AS user_name,
                                  tmiv.email AS user_email
                            FROM task_comment_mentions tcm
                                    LEFT JOIN team_member_info_view tmiv ON tcm.informed_by = tmiv.team_member_id
                            WHERE tcm.comment_id = task_comments.id) rec) AS mentions,
                    (SELECT JSON_BUILD_OBJECT(
                            'likes',
                            JSON_BUILD_OBJECT(
                                'count', (SELECT COUNT(*)
                                          FROM task_comment_reactions tcr
                                          WHERE tcr.comment_id = task_comments.id
                                            AND reaction_type = 'like'),
                                'liked_members', COALESCE(
                                    (SELECT JSON_AGG(tmiv.name)
                                      FROM task_comment_reactions tcr
                                      JOIN team_member_info_view tmiv ON tcr.team_member_id = tmiv.team_member_id
                                      WHERE tcr.comment_id = task_comments.id
                                        AND tcr.reaction_type = 'like'),
                                    '[]'::JSON
                                ),
                               'liked_member_ids', COALESCE(
                                       (SELECT JSON_AGG(tmiv.team_member_id)
                                        FROM task_comment_reactions tcr
                                                 JOIN team_member_info_view tmiv ON tcr.team_member_id = tmiv.team_member_id
                                        WHERE tcr.comment_id = task_comments.id
                                          AND tcr.reaction_type = 'like'),
                                       '[]'::JSON
                                                )
                            )
                        )) AS reactions,
                    (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                      FROM (SELECT id, created_at, name, size, type, (CONCAT('/', team_id, '/', project_id, '/', task_id, '/', comment_id, '/', id, '.', type)) AS url
                            FROM task_comment_attachments tca
                            WHERE tca.comment_id = task_comments.id) rec)                                        AS attachments
              FROM task_comments
                      LEFT JOIN task_comment_contents tc ON task_comments.id = tc.comment_id
                      INNER JOIN team_members tm ON task_comments.team_member_id = tm.id
                      LEFT JOIN users u ON tm.user_id = u.id
              WHERE task_comments.task_id = $1
              ORDER BY task_comments.created_at;`;
    const result = await db.query(q, [taskId]); // task id

    for (const comment of result.rows) {
      if (!comment.content) comment.content = "";
      comment.rawContent = await comment.content;
      comment.content = await comment.content.replace(/\n/g, "</br>");
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
    if (!teamMemberId) return;
    try {
      const q = `SELECT EXISTS(SELECT 1 FROM task_comment_reactions WHERE comment_id = $1 AND team_member_id = $2 AND reaction_type = $3)`;
      const result = await db.query(q, [commentId, teamMemberId, reaction_type]);
      const [data] = result.rows;
      return data.exists;
    } catch (error) {
      log_error(error);
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

    const exists = await this.checkIfAlreadyExists(id, req.user?.team_member_id, reaction_type as string);

    if (exists) {
      const deleteQ = `DELETE FROM task_comment_reactions WHERE comment_id = $1 AND team_member_id = $2;`;
      await db.query(deleteQ, [id, req.user?.team_member_id]);
    } else {
      const q = `INSERT INTO task_comment_reactions (comment_id, user_id, team_member_id) VALUES ($1, $2, $3);`;
      await db.query(q, [id, req.user?.id, req.user?.team_member_id]);

      const getTaskCommentData = await TaskCommentsController.getTaskCommentData(id);
      const commentMessage = `<b>${getTaskCommentData.reactor_name}</b> liked your comment on <b>${getTaskCommentData.task_name}</b> (${getTaskCommentData.team_name})`;

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

    const commentMessage = `<b>${req.user?.name}</b> added a new attachment as a comment on <b>${commentId.task_name}</b> (${commentId.team_name})`;

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
