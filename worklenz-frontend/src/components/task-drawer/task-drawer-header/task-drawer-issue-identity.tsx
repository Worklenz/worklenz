import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dropdown, Flex, Typography, message } from '@/shared/antd-imports';

import { softwareIssuesApiService } from '@/api/software-issues/software-issues.api.service';
import { IssueTypeBadge, getIssueTypeLabel } from '@/components/projects/software/issue-type-badge';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useOptimisticTaskUpdate } from '@/hooks/useOptimisticTaskUpdate';
import { setTaskIssueType } from '@/features/task-drawer/task-drawer.slice';
import { updateEnhancedKanbanTaskIssueType } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { IssueType } from '@/types/project/softwareIssue.types';

interface TaskDrawerIssueIdentityProps {
  taskId?: string | null;
  projectId?: string | null;
  taskKey?: string | null;
  issueType?: IssueType;
  isSubTask: boolean;
  disabled?: boolean;
}

const ISSUE_TYPES: IssueType[] = ['task', 'story', 'bug'];

/** Issue type badge and issue key shown at the start of the software issue drawer header. */
export const TaskDrawerIssueIdentity = ({
  taskId,
  projectId,
  taskKey,
  issueType = 'task',
  isSubTask,
  disabled = false,
}: TaskDrawerIssueIdentityProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const { t: tProjectView } = useTranslation('project-view');
  const dispatch = useAppDispatch();
  const updateTaskOptimistically = useOptimisticTaskUpdate();
  const currentType: IssueType = issueType ?? 'task';

  const items = useMemo(
    () =>
      ISSUE_TYPES.map(type => ({
        key: type,
        label: (
          <span className="flex items-center gap-2">
            <IssueTypeBadge type={type} showTooltip={false} />
            {getIssueTypeLabel(type, tProjectView)}
          </span>
        ),
      })),
    [tProjectView]
  );

  const handleChange = async (nextType: IssueType) => {
    if (!taskId || !projectId || nextType === currentType) return;

    dispatch(setTaskIssueType({ id: taskId, issue_type: nextType }));
    dispatch(updateEnhancedKanbanTaskIssueType({ taskId, issueType: nextType }));

    const isSaved = await updateTaskOptimistically(taskId, 'issue_type', nextType, () =>
      softwareIssuesApiService.updateType(projectId, taskId, nextType)
    );

    if (!isSaved) {
      dispatch(setTaskIssueType({ id: taskId, issue_type: currentType }));
      dispatch(updateEnhancedKanbanTaskIssueType({ taskId, issueType: currentType }));
      message.error(
        tProjectView('issueTypeSaveError', {
          defaultValue: 'Could not change the issue type. Please try again.',
        })
      );
    }
  };

  const typeBadge = isSubTask ? (
    <IssueTypeBadge type="subtask" />
  ) : disabled || !taskId || !projectId ? (
    <IssueTypeBadge type={currentType} />
  ) : (
    <Dropdown
      trigger={['click']}
      menu={{
        items,
        selectable: true,
        selectedKeys: [currentType],
        onClick: ({ key }) => {
          void handleChange(key as IssueType);
        },
      }}
    >
      <button
        type="button"
        className="flex-shrink-0 rounded cursor-pointer hover:opacity-80"
        aria-label={tProjectView('changeIssueType', { defaultValue: 'Change issue type' })}
      >
        <IssueTypeBadge type={currentType} />
      </button>
    </Dropdown>
  );

  return (
    <Flex align="center" gap={8} style={{ minWidth: 0 }}>
      {typeBadge}
      {taskKey && (
        <Typography.Text
          type="secondary"
          strong
          copyable={{
            text: taskKey,
            tooltips: [
              t('issueHeader.copyKey', { defaultValue: 'Copy issue key' }),
              t('issueHeader.keyCopied', { defaultValue: 'Copied' }),
            ],
          }}
          style={{ fontSize: 12, whiteSpace: 'nowrap' }}
        >
          {taskKey}
        </Typography.Text>
      )}
    </Flex>
  );
};
