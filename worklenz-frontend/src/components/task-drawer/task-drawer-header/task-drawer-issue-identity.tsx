import { useMemo } from 'react';
import { useStore } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Dropdown, Flex, Typography, message } from '@/shared/antd-imports';

import { IssueTypeBadge, getIssueTypeLabel } from '@/components/projects/software/issue-type-badge';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { saveIssueTypeForTask } from '@/lib/project/issue-type-update';
import type { RootState } from '@/app/store';
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
  const store = useStore<RootState>();
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

    const isSaved = await saveIssueTypeForTask({
      taskId,
      projectId,
      nextType,
      previousType: currentType,
      dispatch,
      store,
    });

    if (!isSaved) {
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
