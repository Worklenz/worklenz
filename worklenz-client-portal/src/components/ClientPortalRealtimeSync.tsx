import { useClientPortalRealtimeSync } from '@/hooks/useClientPortalRealtimeSync';

/** Mounts the Client Portal realtime listener inside SocketProvider. */
export const ClientPortalRealtimeSync = () => {
  useClientPortalRealtimeSync();
  return null;
};
