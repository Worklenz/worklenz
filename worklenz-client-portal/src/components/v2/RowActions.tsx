import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown, MoreOutlined } from '@/shared/antd-imports';

export interface RowAction {
  key: string;
  label: string;
  icon: ReactNode;
  disabled?: boolean;
}

interface RowActionsProps {
  /** Names the row for screen readers, e.g. the project or request title. */
  name: string;
  actions: RowAction[];
  onSelect: (key: string) => void;
}

/** The "⋮" button at the end of a table row. Clicks stay inside it, so they never trigger the row's own click. */
export const RowActions = ({ name, actions, onSelect }: RowActionsProps) => {
  const { t } = useTranslation();
  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: actions,
        onClick: ({ key, domEvent }) => {
          domEvent.stopPropagation();
          onSelect(key);
        },
      }}
    >
      <Button
        type="text"
        size="small"
        icon={<MoreOutlined />}
        onClick={event => event.stopPropagation()}
        aria-label={`${t('projects.actionsFor', { defaultValue: 'Actions for' })} ${name}`}
      />
    </Dropdown>
  );
};
