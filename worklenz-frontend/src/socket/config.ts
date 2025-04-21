export const SOCKET_CONFIG = {
  url: import.meta.env.VITE_SOCKET_URL || 'ws://localhost:3000',
  options: {
    transports: ['websocket'],
    path: '/socket',
    upgrade: true,
  },
};
