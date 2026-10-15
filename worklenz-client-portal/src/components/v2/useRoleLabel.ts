import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClientRole } from '@/types/v2';

const ROLE_LABELS: Record<ClientRole, string> = {
  admin: 'Client Admin',
  member: 'Client Member',
  viewer: 'Client Viewer',
};

/** "Client Admin" / "Client Member" / "Client Viewer", translated. */
export const useRoleLabel = (): ((role: ClientRole | undefined) => string) => {
  const { t } = useTranslation();
  return useCallback(
    (role: ClientRole | undefined) => (role ? t(`status.role.${role}`, { defaultValue: ROLE_LABELS[role] }) : ''),
    [t]
  );
};
