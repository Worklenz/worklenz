import { Server, Socket } from "socket.io";
import { log } from "../../util";

export async function on_chat_leave(io: Server, socket: Socket, data: any) {
  try {
    const { chatId } = data;
    
    if (!chatId) {
      socket.emit('error', { message: 'Chat ID is required' });
      return;
    }

    // Leave the chat room
    socket.leave(`chat_${chatId}`);
    
    // Log the leave
    const userId = (socket as any).user?.id;
    const userName = (socket as any).user?.name || 'Unknown User';
    
    log("CLIENT_PORTAL", `User ${userName} (${userId}) left chat ${chatId}`);
    
    // Notify others in the room (optional)
    socket.to(`chat_${chatId}`).emit('chat:user_left', {
      userId: userId,
      userName: userName,
      chatId: chatId
    });

    // Confirm leave to the user
    socket.emit('chat:left', {
      success: true,
      chatId: chatId,
      message: `Left chat ${chatId}`
    });

  } catch (error) {
    console.error('Error leaving chat:', error);
    socket.emit('chat:left', {
      success: false,
      error: 'Failed to leave chat'
    });
  }
}