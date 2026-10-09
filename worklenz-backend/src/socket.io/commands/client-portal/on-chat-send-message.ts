import { Server, Socket } from "socket.io";
import db from "../../../config/db";
import { log_error } from "../../util";

export async function on_chat_send_message(io: Server, socket: Socket, data: any) {
  try {
    const { chatId, message, messageType = 'text', fileUrl } = data;
    
    // Get user info from socket (assuming socket has user data)
    const userId = (socket as any).user?.id;
    const userName = (socket as any).user?.name || 'Unknown User';
    
    if (!userId || !chatId || !message) {
      socket.emit('error', { message: 'Invalid message data' });
      return;
    }

    // Insert message into database
    const query = `
      INSERT INTO client_portal_chat_messages (
        chat_id, sender_id, sender_type, content, message_type, file_url, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING *
    `;

    const result = await db.query(query, [
      chatId,
      userId,
      'team_member', // This could be 'client' or 'team_member' based on auth
      message,
      messageType,
      fileUrl
    ]);

    const newMessage = result.rows[0];

    if (newMessage) {
      // Emit to all users in the chat room
      io.to(`chat_${chatId}`).emit('chat:message_received', {
        id: newMessage.id,
        chatId: chatId,
        senderId: userId,
        senderName: userName,
        senderType: 'team_member',
        message: message,
        messageType: messageType,
        fileUrl: fileUrl,
        createdAt: newMessage.created_at,
        isMe: false // Will be set to true by the client for the sender
      });

      // Also emit client portal event
      io.to(`chat_${chatId}`).emit('client_portal:new_message', {
        id: newMessage.id,
        chatId: chatId,
        senderName: userName,
        senderType: 'team_member',
        message: message,
        createdAt: newMessage.created_at
      });
    }
    
    // Send confirmation back to sender
    socket.emit('chat:message_sent', {
      success: true,
      messageId: newMessage.id,
      tempId: data.tempId // If client sends temp ID for optimistic updates
    });

  } catch (error) {
    log_error(error);
    socket.emit('chat:message_sent', {
      success: false,
      error: 'Failed to send message'
    });
  }
}