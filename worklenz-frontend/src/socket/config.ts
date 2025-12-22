import config from '@/config/env';

export const SOCKET_CONFIG = {
  url: config.socketUrl,
  options: {
    transports: ['websocket', 'polling'],
    path: '/socket',
    upgrade: true,
  },
};
