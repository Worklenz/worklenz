import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import io, { Socket } from 'socket.io-client';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getClientPortalSocketUrl } from '@/shared/client-portal-socket';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
});

/**
 * Connects to the Worklenz Socket.IO server with the client JWT once the user is authenticated.
 * The join-room + RTK invalidate listener lives in useClientPortalRealtimeSync.
 */
export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useAppSelector(state => state.auth.token);
  const isAuthenticated = useAppSelector(state => state.auth.isAuthenticated);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.close();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const next = io(getClientPortalSocketUrl(), {
      path: '/socket',
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { token, type: 'client' },
    });

    socketRef.current = next;
    setSocket(next);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    next.on('connect', onConnect);
    next.on('disconnect', onDisconnect);
    next.on('connect_error', () => setConnected(false));
    next.connect();

    return () => {
      next.off('connect', onConnect);
      next.off('disconnect', onDisconnect);
      next.off('connect_error');
      next.removeAllListeners();
      next.close();
      if (socketRef.current === next) {
        socketRef.current = null;
      }
      setSocket(null);
      setConnected(false);
    };
  }, [isAuthenticated, token]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
