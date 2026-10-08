import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';

export const NO_EPIC_VALUE = '__no_epic__';

/** Select options for picking an Epic; archived Epics only appear when already assigned. */
export const useEpicSelectOptions = (currentEpicId: string | null) => {
  const { t } = useTranslation('task-list-table');
  const epics = useAppSelector(state => state.epicsReducer.epics);

  return useMemo(() => {
    const selectableEpics = epics.filter(epic => !epic.is_archived || epic.id === currentEpicId);
    return [
      {
        value: NO_EPIC_VALUE,
        disabled: false,
        label: (
          <Typography.Text type="secondary" className="text-xs">
            {t('noEpic', { defaultValue: 'No epic' })}
          </Typography.Text>
        ),
      },
      ...selectableEpics.map(epic => ({
        value: epic.id,
        disabled: epic.is_archived,
        label: (
          <EpicOptionLabel
            color={epic.color_code}
            name={
              epic.is_archived
                ? t('epicArchivedSuffix', { defaultValue: '{{name}} (archived)', name: epic.name })
                : epic.name
            }
          />
        ),
      })),
    ];
  }, [currentEpicId, epics, t]);
};

const EpicOptionLabel = ({ color, name }: { color: string; name: string }) => (
  <span className="flex items-center gap-2 min-w-0">
    <span
      aria-hidden="true"
      className="inline-block w-2 h-2 rounded-sm flex-none"
      style={{ backgroundColor: color }}
    />
    <span className="truncate text-xs">{name}</span>
  </span>
);
