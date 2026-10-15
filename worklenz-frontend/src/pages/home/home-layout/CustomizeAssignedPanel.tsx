import React from 'react';
import { Flex, Radio, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { HomeAssignedGroup } from '@/features/home-page/homePreferences.slice';

interface CustomizeAssignedPanelProps {
  /** The group the table opens on; null = whichever was used last. */
  assignedDefault: HomeAssignedGroup | null;
  onChange: (group: HomeAssignedGroup | null) => void;
}

const LAST_USED_VALUE = 'last';

/** Which list the task table opens on: assigned to me, assigned by me, or whichever was used last. */
export const CustomizeAssignedPanel: React.FC<CustomizeAssignedPanelProps> = ({ assignedDefault, onChange }) => {
  const { t } = useTranslation('home');
  const label = t('customize.assignedDefault', { defaultValue: 'Open the table on' });

  return (
    <div>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
        {label}
      </Typography.Text>
      <Radio.Group
        value={assignedDefault === null ? LAST_USED_VALUE : assignedDefault}
        onChange={event =>
          onChange(event.target.value === LAST_USED_VALUE ? null : (event.target.value as HomeAssignedGroup))
        }
        aria-label={label}
      >
        <Flex vertical gap={8}>
          <Radio value={LAST_USED_VALUE}>
            {t('customize.assignedLastUsed', { defaultValue: 'Whichever I used last' })}
          </Radio>
          <Radio value={0}>{t('tasks.assignedToMe', { defaultValue: 'Assigned to me' })}</Radio>
          <Radio value={1}>{t('tasks.assignedByMe', { defaultValue: 'Assigned by me' })}</Radio>
        </Flex>
      </Radio.Group>
    </div>
  );
};
