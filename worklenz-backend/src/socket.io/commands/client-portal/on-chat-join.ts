import { Server, Socket } from "socket.io";
import { log } from "../../util";

export async function on_chat_join(io: Server, socket: Socket, data: any) {
  try {
    const { chatId } = data;
    
    if (!chatId) {
      socket.emit('error', { message: 'Chat ID is required' });
      return;
    }

    // Join the chat room
    socket.join(`chat_${chatId}`);
    
    // Log the join
    const userId = (socket as any).user?.id;
    const userName = (socket as any).user?.name || 'Unknown User';
    
    log("CLIENT_PORTAL", `User ${userName} (${userId}) joined chat ${chatId}`);
    
    // Notify others in the room (optional)
    socket.to(`chat_${chatId}`).emit('chat:user_joined', {
      userId: userId,
      userName: userName,
      chatId: chatId
    });

    // Confirm join to the user
    socket.emit('chat:joined', {
      success: true,
      chatId: chatId,
      message: `Joined chat ${chatId}`
    });

  } catch (error) {
    console.error('Error joining chat:', error);
    socket.emit('chat:joined', {
      success: false,
      error: 'Failed to join chat'
    });
  }
}