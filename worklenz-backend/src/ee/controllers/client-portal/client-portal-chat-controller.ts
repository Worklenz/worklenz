import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { IO } from "../../../shared/io";
import moment from "moment-timezone";

export default class ClientPortalChatController extends ClientPortalControllerBase {

  static async getChats(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 20 } = req.query;

      // Get chat conversations grouped by date
      const query = `
        WITH chat_summary AS (
          SELECT
            DATE(created_at) as chat_date,
            COUNT(*) as message_count,
            MAX(created_at) as last_message_at,
            MAX(CASE WHEN sender_type = 'team_member' THEN created_at END) as last_team_message_at,
            COUNT(CASE WHEN read_at IS NULL AND sender_type = 'team_member' THEN 1 END) as unread_count
          FROM client_portal_chat_messages
          WHERE client_id = $1 AND organization_team_id = $2
          GROUP BY DATE(created_at)
        ),
        last_messages AS (
          SELECT DISTINCT ON (DATE(created_at))
            DATE(created_at) as chat_date,
            message as last_message_text
          FROM client_portal_chat_messages
          WHERE client_id = $1 AND organization_team_id = $2
          ORDER BY DATE(created_at), created_at DESC
        )
        SELECT
          cs.chat_date,
          cs.message_count,
          cs.last_message_at,
          cs.last_team_message_at,
          cs.unread_count,
          lm.last_message_text
        FROM chat_summary cs
        LEFT JOIN last_messages lm ON cs.chat_date = lm.chat_date
        ORDER BY cs.chat_date DESC
        LIMIT $3 OFFSET $4
      `;

      const offset = (Number(page) - 1) * Number(limit);
      const result = await db.query(query, [
        clientId,
        organizationId,
        Number(limit),
        offset,
      ]);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT DATE(created_at)) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2
      `;
      const countResult = await db.query(countQuery, [
        clientId,
        organizationId,
      ]);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const chats = result.rows.map((row: any) => ({
        date: row.chat_date,
        messageCount: parseInt(row.message_count || "0"),
        lastMessageAt: row.last_message_at,
        lastTeamMessageAt: row.last_team_message_at,
        unreadCount: parseInt(row.unread_count || "0"),
        hasNewMessages: row.unread_count > 0,
        lastMessage: row.last_message_text || null,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            chats,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Chats retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching chats:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve chats"));
    }
  }

  static async createChat(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { clientEmail } = req;
      const { recipientType, recipientId, subject, message } = req.body;

      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Message content is required"));
      }

      if (!subject || subject.trim().length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Subject is required"));
      }

      // Get client user ID
      const clientUserQuery = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (clientUserQuery.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client user not found"));
      }

      const clientUserId = clientUserQuery.rows[0].id;

      // Create the first message with subject in the format "Subject: {subject}\n\n{message}"
      const fullMessage = `Subject: ${subject.trim()}\n\n${message.trim()}`;

      // Insert message
      // Extract date in database timezone for chatId generation
      const insertQuery = `
        INSERT INTO client_portal_chat_messages (
          client_id, organization_team_id, sender_type, sender_id,
          message, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, sender_type, sender_id, message, message_type, created_at,
          DATE(created_at AT TIME ZONE 'UTC') as chat_date
      `;

      const result = await db.query(insertQuery, [
        clientId,
        organizationId,
        "client",
        clientUserId,
        fullMessage,
        "text",
      ]);

      const newMessage = result.rows[0];

      // Get organization's timezone for timezone-aware date extraction
      let userTimezone = "UTC";
      try {
        const timezoneQuery = await db.query(
          `SELECT tz.name as timezone 
           FROM teams t 
           JOIN timezones tz ON t.timezone_id = tz.id 
           WHERE t.id = $1`,
          [organizationId]
        );
        userTimezone = timezoneQuery.rows[0]?.timezone || "UTC";
      } catch (err) {
        console.error("Error fetching organization timezone:", err);
      }
      
      // Generate proper chatId format: clientId-date using timezone-aware date extraction
      // Convert timestamp to organization's timezone and extract date to avoid UTC date shift issues
      const chatDate = moment.tz(newMessage.created_at, userTimezone).format('YYYY-MM-DD');
      const chatId = `${clientId}-${chatDate}`;

      // Emit socket events for real-time updates
      try {
        const io = IO.getInstance();
        if (io) {
          // Emit to organization team members
          io.emit(`client_portal:new_message`, {
            id: newMessage.id,
            clientId,
            organizationId,
            senderName: clientEmail || "Client",
            senderType: "client",
            message: newMessage.message,
            messageType: newMessage.message_type,
            createdAt: newMessage.created_at,
          });

          // Emit chat message event
          io.emit("chat:message_received", {
            clientId,
            organizationId,
            message: newMessage,
          });
        }
      } catch (socketError) {
        console.error("Error emitting socket events:", socketError);
        // Continue execution even if socket fails
      }

      return res.json(
        new ServerResponse(
          true,
          {
            chatId: chatId,
            message: "Chat created successfully",
          },
          "Chat created successfully"
        )
      );
    } catch (error) {
      console.error("Error creating chat:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create chat"));
    }
  }

  static async getChatDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params; // This would be the date in format YYYY-MM-DD
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 50 } = req.query;

      // Get messages for a specific date
      const query = `
        SELECT
          m.id,
          m.sender_type,
          m.sender_id,
          m.message,
          m.message_type,
          m.file_url,
          m.read_at,
          m.created_at,
          CASE
            WHEN m.sender_type = 'team_member' THEN u.name
            WHEN m.sender_type = 'client' THEN cu.name
          END as sender_name,
          CASE
            WHEN m.sender_type = 'team_member' THEN u.avatar_url
            ELSE NULL
          END as sender_avatar
        FROM client_portal_chat_messages m
        LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
        LEFT JOIN client_users cu ON m.sender_type = 'client' AND m.sender_id = cu.id
        WHERE m.client_id = $1
        AND m.organization_team_id = $2
        AND DATE(m.created_at) = $3
        ORDER BY m.created_at ASC
        LIMIT $4 OFFSET $5
      `;

      const offset = (Number(page) - 1) * Number(limit);
      const result = await db.query(query, [
        clientId,
        organizationId,
        id,
        Number(limit),
        offset,
      ]);

      // Get total count for the date
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2 AND DATE(created_at) = $3
      `;
      const countResult = await db.query(countQuery, [
        clientId,
        organizationId,
        id,
      ]);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const messages = result.rows.map((row: any) => ({
        id: row.id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderAvatar: row.sender_avatar,
        message: row.message,
        messageType: row.message_type,
        fileUrl: row.file_url,
        readAt: row.read_at,
        createdAt: row.created_at,
        isFromClient: row.sender_type === "client",
      }));

      // Mark messages as read (for client user)
      await db.query(
        "UPDATE client_portal_chat_messages SET read_at = NOW() WHERE client_id = $1 AND organization_team_id = $2 AND DATE(created_at) = $3 AND sender_type = 'team_member' AND read_at IS NULL",
        [clientId, organizationId, id]
      );

      return res.json(
        new ServerResponse(
          true,
          {
            date: id,
            messages,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Chat details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching chat details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve chat details")
        );
    }
  }

  static async sendMessage(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { clientEmail } = req;
      const { message, messageType = "text", fileUrl } = req.body;

      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Message content is required"));
      }

      // Get client user ID
      const clientUserQuery = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (clientUserQuery.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client user not found"));
      }

      const clientUserId = clientUserQuery.rows[0].id;

      // Insert message
      const insertQuery = `
        INSERT INTO client_portal_chat_messages (
          client_id, organization_team_id, sender_type, sender_id, 
          message, message_type, file_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, sender_type, sender_id, message, message_type, file_url, created_at
      `;

      const result = await db.query(insertQuery, [
        clientId,
        organizationId,
        "client",
        clientUserId,
        message.trim(),
        messageType,
        fileUrl || null,
      ]);

      const newMessage = result.rows[0];

      // Emit socket events for real-time updates
      try {
        const io = IO.getInstance();
        if (io) {
          // Emit to organization team members
          io.emit(`client_portal:new_message`, {
            id: newMessage.id,
            clientId,
            organizationId,
            senderName: clientEmail || "Client",
            senderType: "client",
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
          });

          // Emit chat message event
          io.emit("chat:message_received", {
            id: newMessage.id,
            chatId: `client_${clientId}`,
            senderId: clientUserId,
            senderName: clientEmail || "Client",
            senderType: "client",
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
            isMe: false,
          });
        }
      } catch (socketError) {
        console.error("Error emitting socket events:", socketError);
        // Don't fail the request if socket fails
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: newMessage.id,
            senderType: newMessage.sender_type,
            senderId: newMessage.sender_id,
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
            isFromClient: true,
          },
          "Message sent successfully"
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to send message"));
    }
  }

  static async getMessages(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 50, since } = req.query;

      // Get recent messages
      let query = `
        SELECT 
          m.id,
          m.sender_type,
          m.sender_id,
          m.message,
          m.message_type,
          m.file_url,
          m.read_at,
          m.created_at,
          CASE
            WHEN m.sender_type = 'team_member' THEN u.name
            WHEN m.sender_type = 'client' THEN cu.name
          END as sender_name,
          CASE 
            WHEN m.sender_type = 'team_member' THEN u.avatar_url
            ELSE NULL
          END as sender_avatar
        FROM client_portal_chat_messages m
        LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
        LEFT JOIN client_users cu ON m.sender_type = 'client' AND m.sender_id = cu.id
        WHERE m.client_id = $1 AND m.organization_team_id = $2
      `;

      const queryParams = [clientId, organizationId];
      let paramIndex = 3;

      // Add since filter if provided (for real-time updates)
      if (since) {
        query += ` AND m.created_at > $${paramIndex}`;
        queryParams.push(String(since));
        paramIndex++;
      }

      query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      const offset = (Number(page) - 1) * Number(limit);
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2
      `;
      const countParams = [clientId, organizationId];
      if (since) {
        countQuery += ` AND created_at > $3`;
        countParams.push(String(since));
      }
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const messages = result.rows.map((row: any) => ({
        id: row.id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderAvatar: row.sender_avatar,
        message: row.message,
        messageType: row.message_type,
        fileUrl: row.file_url,
        readAt: row.read_at,
        createdAt: row.created_at,
        isFromClient: row.sender_type === "client",
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            messages: messages.reverse(), // Reverse to show oldest first
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Messages retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve messages"));
    }
  }

}
