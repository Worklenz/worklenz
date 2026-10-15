import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from '@/shared/antd-imports';
import type { PortalVisibility } from '@/types/client-portal/v2';

export type SharedItemKind = 'task' | 'file' | 'milestone';

/**
 * The toast after a visibility switch. Withdrawing an item says it is gone from the portal
 * immediately; sharing one says it is now visible.
 */
export const useVisibilityToast = () => {
  const { t } = useTranslation('client-portal-v2');

  return useCallback(
    (kind: SharedItemKind, name: string, next: PortalVisibility) => {
      if (next === 'internal') {
        message.success(
          t('visibilityToast.withdrawn', {
            name,
            defaultValue: '“{{name}}” is now Internal Only. Client access is removed immediately.',
          })
        );
        return;
      }

      if (kind === 'file') {
        message.success(
          t('visibilityToast.sharedFile', {
            name,
            defaultValue: '“{{name}}” is now shared with the client. Client users on the project are notified.',
          })
        );
      } else if (kind === 'milestone') {
        message.success(
          t('visibilityToast.sharedMilestone', {
            name,
            defaultValue: '“{{name}}” is now visible to the client.',
          })
        );
      } else {
        message.success(
          t('visibilityToast.sharedTask', {
            name,
            defaultValue: '“{{name}}” is now visible to the client.',
          })
        );
      }
    },
    [t]
  );
};
