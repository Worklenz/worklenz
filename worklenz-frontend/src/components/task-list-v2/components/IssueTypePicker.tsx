import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, message } from '@/shared/antd-imports';

import { softwareIssuesApiService } from '@/api/software-issues/software-issues.api.service';
import { IssueTypeBadge, getIssueTypeLabel } from '@/components/projects/software/issue-type-badge';
import { useOptimisticTaskUpdate } from '@/hooks/useOptimisticTaskUpdate';
import { Task } from '@/types/task-management.types';
import { IssueType } from '@/types/project/softwareIssue.types';

interface IssueTypePickerProps {
  task: Task;
  projectId: string;
  disabled?: boolean;
}

/** Issue type badge that opens a Task / Story / Bug menu to change the type in place. */
export const IssueTypePicker: React.FC<IssueTypePickerProps> = memo(
  ({ task, projectId, disabled = false }) => {
    const { t } = useTranslation('project-view');
    const updateTaskOptimistically = useOptimisticTaskUpdate();
    const currentType: IssueType = task.issue_type ?? 'task';

    const items = useMemo(
      () =>
        ISSUE_TYPES.map(type => ({
          key: type,
          label: (
            <span className="flex items-center gap-2">
              <IssueTypeBadge type={type} showTooltip={false} />
              {getIssueTypeLabel(type, t)}
            </span>
          ),
        })),
      [t]
    );

    const handleChange = async (nextType: IssueType) => {
      if (nextType === currentType) return;
      const isSaved = await updateTaskOptimistically(task.id, 'issue_type', nextType, () =>
        softwareIssuesApiService.updateType(projectId, task.id, nextType)
      );
      if (!isSaved) {
        message.error(
          t('issueTypeSaveError', { defaultValue: 'Could not change the issue type. Please try again.' })
        );
      }
    };

    if (disabled) return <IssueTypeBadge type={currentType} />;

    return (
      <Dropdown
        trigger={['click']}
        menu={{
          items,
          selectable: true,
          selectedKeys: [currentType],
          onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            void handleChange(key as IssueType);
          },
        }}
      >
        <button
          type="button"
          className="flex-shrink-0 rounded cursor-pointer hover:opacity-80"
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          aria-label={t('changeIssueType', { defaultValue: 'Change issue type' })}
        >
          <IssueTypeBadge type={currentType} />
        </button>
      </Dropdown>
    );
  }
);

IssueTypePicker.displayName = 'IssueTypePicker';

const ISSUE_TYPES: IssueType[] = ['task', 'story', 'bug'];
