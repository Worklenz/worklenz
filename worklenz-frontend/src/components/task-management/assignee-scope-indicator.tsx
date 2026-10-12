import React from 'react';
import { Tag, Tooltip, theme, InfoCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import useIsAssigneeTaskScopeActive from '@/hooks/useIsAssigneeTaskScopeActive';

/**
 * TVR-16: subtle banner so restricted members do not read filtered
 * counts / progress as a product bug.
 */
export const AssigneeScopeIndicator: React.FC = () => {
  const { t } = useTranslation('task-list-filters');
  const { token } = theme.useToken();
  const isActive = useIsAssigneeTaskScopeActive();

  if (!isActive) {
    return null;
  }

  const label = t('showingYourTasksOnly', {
    defaultValue: 'Showing your tasks only',
  });
  const tooltip = t('showingYourTasksOnlyTooltip', {
    defaultValue:
      'This project only shows tasks assigned to you. Counts and progress reflect that subset.',
  });

  return (
    <Tooltip title={tooltip}>
      <Tag
        icon={<InfoCircleOutlined aria-hidden />}
        color="processing"
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: '20px',
          borderRadius: token.borderRadius,
          cursor: 'default',
        }}
        tabIndex={0}
        aria-label={label}
      >
        {label}
      </Tag>
    </Tooltip>
  );
};

export default AssigneeScopeIndicator;
