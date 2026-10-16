import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PortalTask } from '@/types/client-portal/v2';

type InternalStatus = PortalTask['status'];

export interface TaskStatusLabels {
  /** The status as the team knows it. */
  internal: Record<InternalStatus, string>;
  /** What the portal shows for it: To do becomes Not started. */
  client: Record<InternalStatus, string>;
}

/** Static keys on purpose: dynamic `t(`...${status}`)` keys cannot be extracted into the locale files. */
export const useTaskStatusLabels = (): TaskStatusLabels => {
  const { t } = useTranslation('client-portal-v2-projects');

  return useMemo(
    () => ({
      internal: {
        todo: t('tasks.status.todo', { defaultValue: 'To do' }),
        in_progress: t('tasks.status.inProgress', { defaultValue: 'In progress' }),
        done: t('tasks.status.done', { defaultValue: 'Done' }),
      },
      client: {
        todo: t('tasks.clientStatus.notStarted', { defaultValue: 'Not started' }),
        in_progress: t('tasks.clientStatus.inProgress', { defaultValue: 'In progress' }),
        done: t('tasks.clientStatus.done', { defaultValue: 'Done' }),
      },
    }),
    [t]
  );
};
