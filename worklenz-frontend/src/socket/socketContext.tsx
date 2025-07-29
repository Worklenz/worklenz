import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useTranslation } from 'react-i18next';

import { SOCKET_CONFIG } from './config';
import logger from '@/utils/errorLogger';
import { Modal, message } from '@/shared/antd-imports';
import { SocketEvents } from '@/shared/socket-events';
import { getUserSession } from '@/utils/session-helper';

// Global socket instance to prevent multiple connections in StrictMode
let globalSocketInstance: Socket | null = null;

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  modalContextHolder: React.ReactElement<any>;
}

const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('common');
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [modal, contextHolder] = Modal.useModal();
  const profile = getUserSession(); // Adjust based on your Redux structure
  const [messageApi, messageContextHolder] = message.useMessage(); // Add message API
  const hasShownConnectedMessage = useRef(false); // Add ref to track if message was shown
  const isInitialized = useRef(false); // Track if socket is already initialized
  const messageApiRef = useRef(messageApi);
  const tRef = useRef(t);

  // Update refs when values change
  useEffect(() => {
    messageApiRef.current = messageApi;
  }, [messageApi]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  // Initialize socket connection
  useEffect(() => {
    // Prevent duplicate initialization
    if (isInitialized.current) {
      return;
    }

    // Only create a new socket if one doesn't exist globally or locally
    if (!socketRef.current && !globalSocketInstance) {
      isInitialized.current = true;
      globalSocketInstance = io(SOCKET_CONFIG.url, {
        ...SOCKET_CONFIG.options,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      socketRef.current = globalSocketInstance;
    } else if (globalSocketInstance && !socketRef.current) {
      // Reuse existing global socket instance
      socketRef.current = globalSocketInstance;
      isInitialized.current = true;
    }

    const socket = socketRef.current;

    // Only proceed if socket exists
    if (!socket) return;

    // Set up event listeners before connecting
    socket.on('connect', () => {
      logger.info('Socket connected');
      setConnected(true);

      // Only show connected message once
      if (!hasShownConnectedMessage.current) {
        messageApiRef.current.success(tRef.current('connection-restored'));
        hasShownConnectedMessage.current = true;
      }
    });

    // Emit login event
    if (profile && profile.id) {
      socket.emit(SocketEvents.LOGIN.toString(), profile.id);
      socket.once(SocketEvents.LOGIN.toString(), () => {
        logger.info('Socket login success');
      });
    }

    socket.on('connect_error', error => {
      logger.error('Connection error', { error });
      setConnected(false);
      messageApiRef.current.error(tRef.current('connection-lost'));
      // Reset the connected message flag on error
      hasShownConnectedMessage.current = false;
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected');
      setConnected(false);
      messageApiRef.current.loading(tRef.current('reconnecting'));
      // Reset the connected message flag on disconnect
      hasShownConnectedMessage.current = false;

      // Emit logout event
      if (profile && profile.id) {
        socket.emit(SocketEvents.LOGOUT.toString(), profile.id);
      }
    });

    // Add team-related socket events
    socket.on(SocketEvents.INVITATIONS_UPDATE.toString(), (message: string) => {
      logger.info(message);
    });

    socket.on(
      SocketEvents.TEAM_MEMBER_REMOVED.toString(),
      (data: { teamId: string; message: string }) => {
        if (!data) return;

        if (profile && profile.team_id === data.teamId) {
          modal.confirm({
            title: 'You no longer have permissions to stay on this team!',
            content: data.message,
            closable: false,
            cancelButtonProps: { disabled: true },
            onOk: () => window.location.reload(),
          });
        }
      }
    );

    // Connect after setting up listeners
    socket.connect();

    // Cleanup function
    return () => {
      if (socket) {
        // Remove all listeners first
        socket.off('connect');
        socket.off('connect_error');
        socket.off('disconnect');
        socket.off(SocketEvents.INVITATIONS_UPDATE.toString());
        socket.off(SocketEvents.TEAM_MEMBER_REMOVED.toString());
        socket.removeAllListeners();

        // Then close the connection
        socket.close();
        socketRef.current = null;
        globalSocketInstance = null; // Clear global instance
        hasShownConnectedMessage.current = false; // Reset on unmount
        isInitialized.current = false; // Reset initialization flag
      }
    };
  }, []); // Remove dependencies to prevent re-initialization

  const value = {
    socket: socketRef.current,
    connected,
    modalContextHolder: contextHolder,
  };

  return (
    <SocketContext.Provider value={value}>
      {messageContextHolder}
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
