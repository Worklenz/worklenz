import { useTranslation } from 'react-i18next';
import { Avatar, Tooltip, Typography, theme } from '@/shared/antd-imports';

import { useAppSelector } from '@/hooks/useAppSelector';
import { IssueTypeBadge } from '@/components/projects/software/issue-type-badge';
import { IReleaseWorkItem } from '@/types/project/projectRelease.types';

interface WorkItemSummaryProps {
  item: IReleaseWorkItem;
  /** Renders the title as a button that opens the work item. */
  onOpen?: (item: IReleaseWorkItem) => void;
}

export const WorkItemSummary = ({ item, onOpen }: WorkItemSummaryProps) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  const issueType = item.parent_task_id ? 'subtask' : item.issue_type;

  return (
    <span className="flex items-center gap-2 min-w-0">
      <IssueTypeBadge type={issueType} />
      <span
        className="text-[11px] font-bold whitespace-nowrap"
        style={{ color: token.colorTextSecondary }}
      >
        {item.task_key}
      </span>
      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(item)}
          aria-label={t('releaseOpenWorkItem', {
            defaultValue: 'Open {{key}}',
            key: item.task_key,
          })}
          className="min-w-0 truncate border-0 bg-transparent p-0 text-left font-medium cursor-pointer transition-colors duration-150 hover:underline focus-visible:outline focus-visible:outline-2"
          style={{ color: token.colorText }}
        >
          {item.name}
        </button>
      ) : (
        <span className="min-w-0 truncate font-medium" style={{ color: token.colorText }}>
          {item.name}
        </span>
      )}
      {item.is_blocked && !item.is_done && (
        <Tooltip title={t('releaseBlockedTooltip', { defaultValue: 'Flagged as blocked' })}>
          <span
            className="text-[11px] font-bold whitespace-nowrap"
            style={{ color: token.colorError }}
          >
            ⚑ {t('releaseBlocked', { defaultValue: 'Blocked' })}
          </span>
        </Tooltip>
      )}
    </span>
  );
};

export const WorkItemStatus = ({ item }: { item: IReleaseWorkItem }) => {
  const { token } = theme.useToken();
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  const dotColor =
    (isDarkMode ? item.status_color_dark : item.status_color) ??
    item.status_color ??
    token.colorTextQuaternary;

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full text-xs">
      <span
        aria-hidden="true"
        className="inline-block w-2 h-2 rounded-full flex-none"
        style={{ backgroundColor: dotColor }}
      />
      <span className="truncate">{item.status_name ?? '–'}</span>
    </span>
  );
};

export const WorkItemEpic = ({ item }: { item: IReleaseWorkItem }) => {
  const { t } = useTranslation('project-view');
  const { token } = theme.useToken();
  if (!item.epic_name) {
    return (
      <Typography.Text type="secondary" className="text-xs">
        {t('releaseNoEpic', { defaultValue: 'No epic' })}
      </Typography.Text>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 min-w-0 max-w-full text-xs"
      style={{ color: token.purple }}
    >
      <span
        aria-hidden="true"
        className="inline-block w-2 h-2 rounded-sm flex-none"
        style={{ backgroundColor: item.epic_color ?? token.purple }}
      />
      <span className="truncate">{item.epic_name}</span>
    </span>
  );
};

export const WorkItemAssignee = ({ item }: { item: IReleaseWorkItem }) => {
  const { t } = useTranslation('project-view');
  if (!item.assignee_name) {
    return (
      <Typography.Text type="secondary" className="text-xs">
        {t('releaseUnassigned', { defaultValue: 'Unassigned' })}
      </Typography.Text>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full text-xs">
      <Avatar size={20} src={item.assignee_avatar_url || undefined}>
        {item.assignee_name.charAt(0).toUpperCase()}
      </Avatar>
      <span className="truncate">{item.assignee_name.split(' ')[0]}</span>
    </span>
  );
};
