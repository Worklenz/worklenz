import React, { memo } from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { Task } from '@/types/task-management.types';

interface CommentsColumnProps {
  width: string;
  task: Task;
}

/** Strip HTML tags so rich-text comments render as plain, single-line text. */
const stripHtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
};

const formatCommentDate = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Shows the text of the most recent comment posted on a task so recent activity
 * can be scanned without opening the task drawer.
 */
export const CommentsColumn: React.FC<CommentsColumnProps> = memo(({ width, task }) => {
  const { t } = useTranslation('task-list-table');
  const comment = stripHtml(task.latest_comment || '');
  const author = task.latest_comment_author ? String(task.latest_comment_author) : '';
  const date = formatCommentDate(task.latest_comment_at);
  const meta = [author, date].filter(Boolean).join(' · ');
  const columnLabel = t('commentsColumn', { defaultValue: 'Latest Comment' });

  return (
    <div
      className="flex h-full items-center overflow-hidden border-r border-gray-200 px-2 dark:border-gray-700"
      style={{ width }}
    >
      {comment ? (
        <Tooltip
          title={
            <div className="max-w-[360px] whitespace-pre-wrap break-words">
              <div>{comment}</div>
              {meta && <div className="mt-1 text-xs opacity-70">{meta}</div>}
            </div>
          }
        >
          <span
            className="w-full cursor-default truncate text-sm text-gray-600 dark:text-gray-300"
            tabIndex={0}
            aria-label={columnLabel}
          >
            {comment}
          </span>
        </Tooltip>
      ) : (
        <span
          className="text-sm text-gray-400 dark:text-gray-600"
          aria-label={columnLabel}
        >
          —
        </span>
      )}
    </div>
  );
});

CommentsColumn.displayName = 'CommentsColumn';
