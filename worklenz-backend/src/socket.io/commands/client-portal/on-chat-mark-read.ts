import { Server, Socket } from "socket.io";
import db from "../../../config/db";
import { log_error } from "../../util";

export async function on_chat_mark_read(io: Server, socket: Socket, data: any) {
  try {
    const { messageId } = data;
    
    if (!messageId) {
      socket.emit('error', { message: 'Message ID is required' });
      return;
    }

    const userId = (socket as any).user?.id;
    const userName = (socket as any).user?.name || 'Unknown User';
    
    if (!userId) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    // Mark message as read in database (you may need to create this table)
    const query = `
      INSERT INTO client_portal_message_reads (message_id, user_id, read_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (message_id, user_id) 
      DO UPDATE SET read_at = NOW()
    `;

    await db.query(query, [messageId, userId]);

    // Get chat ID from message
    const chatQuery = `
      SELECT chat_id FROM client_portal_chat_messages WHERE id = $1
    `;
    const chatResult = await db.query(chatQuery, [messageId]);
    
    if (chatResult.rows.length > 0) {
      const chatId = chatResult.rows[0].chat_id;
      
      // Emit read receipt to all users in the chat room
      io.to(`chat_${chatId}`).emit('chat:message_read', {
        messageId: messageId,
        readBy: userId,
        readByName: userName,
        readAt: new Date().toISOString()
      });
    }

  } catch (error) {
    log_error(error);
    socket.emit('error', { message: 'Failed to mark message as read' });
  }
}