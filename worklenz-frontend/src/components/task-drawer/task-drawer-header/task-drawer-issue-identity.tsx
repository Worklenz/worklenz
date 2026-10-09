import { useTranslation } from 'react-i18next';
import { Flex, Typography } from '@/shared/antd-imports';

import { IssueTypeBadge } from '@/components/projects/software/issue-type-badge';
import { IssueType } from '@/types/project/softwareIssue.types';

interface TaskDrawerIssueIdentityProps {
  taskKey?: string | null;
  issueType?: IssueType;
  isSubTask: boolean;
}

/** Issue type badge and issue key shown at the start of the software issue drawer header. */
export const TaskDrawerIssueIdentity = ({
  taskKey,
  issueType = 'task',
  isSubTask,
}: TaskDrawerIssueIdentityProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');

  return (
    <Flex align="center" gap={8} style={{ minWidth: 0 }}>
      <IssueTypeBadge type={isSubTask ? 'subtask' : issueType} />
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
