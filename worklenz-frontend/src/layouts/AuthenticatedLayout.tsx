import React from 'react';
import { Outlet } from 'react-router-dom';
import { SocketProvider } from '@/socket/socketContext';

export const AuthenticatedLayout = () => {
  return (
    <SocketProvider>
      <Outlet />
    </SocketProvider>
  );
};
