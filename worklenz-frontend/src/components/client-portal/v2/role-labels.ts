import type { ClientRole } from '@/types/client-portal/v2';

/** i18n key and English fallback for each role's name, in the shared `client-portal-v2` namespace. */
export const ROLE_LABEL_COPY: Record<ClientRole, { key: string; defaultValue: string }> = {
  admin: { key: 'roleAdmin', defaultValue: 'Client Admin' },
  member: { key: 'roleMember', defaultValue: 'Client Member' },
  viewer: { key: 'roleViewer', defaultValue: 'Client Viewer' },
};
