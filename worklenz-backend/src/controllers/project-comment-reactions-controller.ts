import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";

export default class ProjectCommentReactionsController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async addReaction(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { comment_id, emoji } = req.body;
    const userId = req.user?.id;

    if (!comment_id || !emoji || !userId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing required fields"));
    }

    // Validate emoji (basic validation - only allow common emojis)
    const validEmojis = ['👍', '❤️', '😄', '😮', '😢', '🎉', '🚀', '👀', '🔥', '💯'];
    if (!validEmojis.includes(emoji)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid emoji"));
    }

    const q = `SELECT add_comment_reaction($1, $2, $3) AS reactions`;
    const result = await db.query(q, [comment_id, userId, emoji]);
    const [data] = result.rows;

    // Get project members and emit to each
    const membersQuery = `
      SELECT DISTINCT u.socket_id
      FROM project_members pm
      INNER JOIN team_members tm ON pm.team_member_id = tm.id
      INNER JOIN users u ON tm.user_id = u.id
      WHERE pm.project_id = (SELECT project_id FROM project_comments WHERE id = $1)
      AND u.socket_id IS NOT NULL
    `;
    const membersResult = await db.query(membersQuery, [comment_id]);
    
    const eventData = {
      comment_id,
      emoji,
      user_id: userId,
      user_name: req.user?.name,
      reactions: data.reactions
    };

    // Emit to all project members
    for (const member of membersResult.rows) {
      IO.emit(SocketEvents.PROJECT_COMMENT_REACTION_ADDED, member.socket_id, eventData);
    }

    return res.status(200).send(new ServerResponse(true, data.reactions));
  }

  @HandleExceptions()
  public static async removeReaction(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { comment_id, emoji } = req.body;
    const userId = req.user?.id;

    if (!comment_id || !emoji || !userId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing required fields"));
    }

    const q = `SELECT remove_comment_reaction($1, $2, $3) AS reactions`;
    const result = await db.query(q, [comment_id, userId, emoji]);
    const [data] = result.rows;

    // Get project members and emit to each
    const membersQuery = `
      SELECT DISTINCT u.socket_id
      FROM project_members pm
      INNER JOIN team_members tm ON pm.team_member_id = tm.id
      INNER JOIN users u ON tm.user_id = u.id
      WHERE pm.project_id = (SELECT project_id FROM project_comments WHERE id = $1)
      AND u.socket_id IS NOT NULL
    `;
    const membersResult = await db.query(membersQuery, [comment_id]);
    
    const eventData = {
      comment_id,
      emoji,
      user_id: userId,
      reactions: data.reactions
    };

    // Emit to all project members
    for (const member of membersResult.rows) {
      IO.emit(SocketEvents.PROJECT_COMMENT_REACTION_REMOVED, member.socket_id, eventData);
    }

    return res.status(200).send(new ServerResponse(true, data.reactions));
  }

  @HandleExceptions()
  public static async getReactions(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { comment_id } = req.params;

    if (!comment_id) {
      return res.status(400).send(new ServerResponse(false, null, "Comment ID is required"));
    }

    const q = `SELECT get_comment_reactions($1) AS reactions`;
    const result = await db.query(q, [comment_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.reactions));
  }

  @HandleExceptions()
  public static async editComment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { comment_id, content } = req.body;
    const userId = req.user?.id;

    if (!comment_id || !content || !userId) {
      return res.status(400).send(new ServerResponse(false, null, "Missing required fields"));
    }

    // Sanitize content
    const { sanitizeCommentContent } = await import("../shared/utils");
    const sanitizedContent = sanitizeCommentContent(content);

    try {
      const q = `SELECT edit_project_comment($1, $2, $3) AS result`;
      const result = await db.query(q, [comment_id, userId, sanitizedContent]);
      const [data] = result.rows;

      // Get project members and emit to each
      const membersQuery = `
        SELECT DISTINCT u.socket_id
        FROM project_members pm
        INNER JOIN team_members tm ON pm.team_member_id = tm.id
        INNER JOIN users u ON tm.user_id = u.id
        WHERE pm.project_id = (SELECT project_id FROM project_comments WHERE id = $1)
        AND u.socket_id IS NOT NULL
      `;
      const membersResult = await db.query(membersQuery, [comment_id]);
      
      const eventData = {
        comment_id,
        content: sanitizedContent,
        edited_by: userId,
        edited_by_name: req.user?.name,
        ...data.result
      };

      // Emit to all project members
      for (const member of membersResult.rows) {
        IO.emit(SocketEvents.PROJECT_COMMENT_EDITED, member.socket_id, eventData);
      }

      return res.status(200).send(new ServerResponse(true, data.result));
    } catch (error: any) {
      if (error.message.includes('Only the comment owner')) {
        return res.status(403).send(new ServerResponse(false, null, "You can only edit your own comments"));
      }
      throw error;
    }
  }

  @HandleExceptions()
  public static async getEditHistory(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { comment_id } = req.params;

    if (!comment_id) {
      return res.status(400).send(new ServerResponse(false, null, "Comment ID is required"));
    }

    const q = `SELECT get_comment_edit_history($1) AS history`;
    const result = await db.query(q, [comment_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.history));
  }
}
