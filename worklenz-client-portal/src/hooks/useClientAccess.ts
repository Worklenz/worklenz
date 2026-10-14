import { useGetMeQuery } from '@/store/api-v2';
import type { ClientCapabilities, ClientMe, ClientRole } from '@/types/v2';

const NO_CAPABILITIES: ClientCapabilities = {
  comment: false,
  upload: false,
  submitChangeRequest: false,
  approve: false,
  manageUsers: false,
};

export interface ClientAccess {
  me: ClientMe | undefined;
  isLoading: boolean;
  role: ClientRole | undefined;
  can: ClientCapabilities;
  invoicesVisible: boolean;
  adminsCanInvite: boolean;
  adminsCanRemove: boolean;
}

/**
 * Who the signed-in client is and what they may do. The role is resolved on the server on every
 * request; this is only for choosing what to render. Controls a role cannot use stay on screen with
 * a <LockedNote /> instead of disappearing.
 */
export const useClientAccess = (): ClientAccess => {
  const { data, isLoading } = useGetMeQuery();
  return {
    me: data,
    isLoading,
    role: data?.role,
    can: data?.capabilities ?? NO_CAPABILITIES,
    invoicesVisible: data?.invoicesVisible ?? false,
    adminsCanInvite: data?.adminsCanInvite ?? false,
    adminsCanRemove: data?.adminsCanRemove ?? false,
  };
};
