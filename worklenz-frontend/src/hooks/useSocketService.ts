import { useEffect, useRef } from 'react';
import { SocketService } from '@services/socket/socket.service';
import { useSocket } from '@/socket/socketContext';

export const useSocketService = () => {
  const { socket } = useSocket();
  const socketService = useRef(SocketService.getInstance());

  useEffect(() => {
    if (socket) {
      socketService.current.init(socket);
    }
  }, [socket]);

  return socketService.current;
};
