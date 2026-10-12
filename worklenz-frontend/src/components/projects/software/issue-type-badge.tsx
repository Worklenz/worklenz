import { useTranslation } from 'react-i18next';
import { Tooltip, theme } from '@/shared/antd-imports';
import type { GlobalToken } from 'antd';

import { CreatableIssueType } from '@/types/project/softwareIssue.types';

interface IssueTypeBadgeProps {
  type: CreatableIssueType;
  showTooltip?: boolean;
}

/** Small colored letter badge identifying an issue type (T, S, B, s, E). */
export const IssueTypeBadge = ({ type, showTooltip = true }: IssueTypeBadgeProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const label = getIssueTypeLabel(type, t);

  const badge = (
    <span
      role="img"
      aria-label={label}
      className="inline-grid place-items-center w-5 h-5 rounded text-[10px] font-extrabold text-white flex-none"
      style={{ backgroundColor: getIssueTypeColor(type, token) }}
    >
      {ISSUE_TYPE_LETTERS[type]}
    </span>
  );

  return showTooltip ? <Tooltip title={label}>{badge}</Tooltip> : badge;
};

export const getIssueTypeLabel = (
  type: CreatableIssueType,
  t: (key: string, options: { defaultValue: string }) => string
): string => t(`issueType.${type}`, { defaultValue: ISSUE_TYPE_DEFAULT_LABELS[type] });

const getIssueTypeColor = (type: CreatableIssueType, token: GlobalToken): string => {
  switch (type) {
    case 'story':
      return token.colorSuccess;
    case 'bug':
      return token.colorError;
    case 'subtask':
      return token.cyan;
    case 'epic':
      return token.purple;
    default:
      return token.colorPrimary;
  }
};

const ISSUE_TYPE_LETTERS: Record<CreatableIssueType, string> = {
  task: 'T',
  story: 'S',
  bug: 'B',
  subtask: 's',
  epic: 'E',
};

const ISSUE_TYPE_DEFAULT_LABELS: Record<CreatableIssueType, string> = {
  task: 'Task',
  story: 'Story',
  bug: 'Bug',
  subtask: 'Subtask',
  epic: 'Epic',
};
