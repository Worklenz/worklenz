import { Server, Socket } from "socket.io";

export async function on_chat_typing(io: Server, socket: Socket, data: any) {
  try {
    const { chatId, isTyping } = data;
    
    if (!chatId) {
      socket.emit('error', { message: 'Chat ID is required' });
      return;
    }

    const userId = (socket as any).user?.id;
    const userName = (socket as any).user?.name || 'Unknown User';
    
    if (!userId) {
      socket.emit('error', { message: 'User not authenticated' });
      return;
    }

    // Emit typing indicator to all other users in the chat room
    socket.to(`chat_${chatId}`).emit('chat:typing', {
      chatId: chatId,
      senderId: userId,
      senderName: userName,
      isTyping: isTyping
    });

  } catch (error) {
    console.error('Error handling typing indicator:', error);
  }
}