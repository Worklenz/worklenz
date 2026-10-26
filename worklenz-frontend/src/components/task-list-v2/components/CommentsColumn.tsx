import React, { memo, useMemo } from 'react';
import { Tooltip } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { Task } from '@/types/task-management.types';
import { sanitizeCommentContent } from '@/utils/sanitizeInput';
import './CommentsColumn.css';

interface CommentsColumnProps {
  width: string;
  task: Task;
  onOpenComment?: (commentId: string) => void;
}

/**
 * Strips HTML tags and normalizes whitespace so accessible text and aria-labels stay plain text.
 *
 * @param html - Raw HTML string to strip
 * @returns Plain text content
 */
const stripHtml = (html: string): string => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
};

/**
 * Formats an ISO date string into a localized short date display (e.g., "Oct 26, 2026").
 *
 * @param value - ISO date string or null/undefined
 * @returns Formatted date string, or empty string if invalid
 */
const formatCommentDate = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Extracts the first meaningful line or block from HTML content for single-row table cell preview,
 * preserving inline rich formatting tags while ignoring subsequent blocks.
 *
 * @param html - Full sanitized comment HTML string
 * @returns Object with preview HTML string and hasMore boolean indicator
 */
export const extractFirstLinePreview = (html: string): { previewHtml: string; hasMore: boolean } => {
  if (!html) return { previewHtml: '', hasMore: false };

  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = html;

    const children = Array.from(container.children);
    if (children.length === 0) {
      return { previewHtml: html, hasMore: false };
    }

    // Look for first block with non-whitespace content
    let firstBlock: Element | null = null;
    let firstBlockIndex = -1;

    for (let i = 0; i < children.length; i++) {
      if ((children[i].textContent || '').trim().length > 0) {
        firstBlock = children[i];
        firstBlockIndex = i;
        break;
      }
    }

    if (!firstBlock) {
      return { previewHtml: container.innerHTML, hasMore: false };
    }

    // Check if there are other subsequent blocks with content
    const hasSubsequentBlocks = children
      .slice(firstBlockIndex + 1)
      .some(c => (c.textContent || '').trim().length > 0);

    // If it's a list (ul/ol), grab the first <li>
    const tagName = firstBlock.tagName.toLowerCase();
    if (tagName === 'ul' || tagName === 'ol') {
      const lis = Array.from(firstBlock.querySelectorAll('li'));
      const firstLi = lis.find(li => (li.textContent || '').trim().length > 0);
      if (firstLi) {
        return {
          previewHtml: firstLi.innerHTML,
          hasMore: hasSubsequentBlocks || lis.length > 1,
        };
      }
    }

    // If first block has line breaks (<br>), take only the first line
    const htmlContent = firstBlock.innerHTML;
    const brMatch = htmlContent.match(/<br\s*\/?>/i);
    if (brMatch && brMatch.index !== undefined) {
      const firstPart = htmlContent.slice(0, brMatch.index);
      return {
        previewHtml: firstPart,
        hasMore: true,
      };
    }

    return {
      previewHtml: htmlContent,
      hasMore: hasSubsequentBlocks,
    };
  }

  return { previewHtml: html, hasMore: false };
};

/**
 * Shows the formatted latest comment posted on a task with full rich hover preview
 * so recent activity can be scanned with full fidelity without opening the task drawer.
 */
export const CommentsColumn: React.FC<CommentsColumnProps> = memo(({ width, task, onOpenComment }) => {
  const { t } = useTranslation('task-list-table');
  const rawComment = task.latest_comment || '';
  const sanitizedComment = useMemo(() => sanitizeCommentContent(rawComment), [rawComment]);
  const plainTextComment = useMemo(() => stripHtml(sanitizedComment), [sanitizedComment]);
  const { previewHtml, hasMore } = useMemo(
    () => extractFirstLinePreview(sanitizedComment),
    [sanitizedComment]
  );

  const latestCommentId = task.latest_comment_id;
  const author = task.latest_comment_author ? String(task.latest_comment_author) : '';
  const date = formatCommentDate(task.latest_comment_at);
  const meta = [author, date].filter(Boolean).join(' · ');
  const columnLabel = t('commentsColumn', { defaultValue: 'Latest Comment' });
  const openCommentLabel = t('openLatestComment', { defaultValue: 'Open latest comment' });
  const canOpenComment = Boolean(
    plainTextComment && latestCommentId && onOpenComment && !task.is_parent_container
  );

  return (
    <div
      className="flex h-full items-center overflow-hidden border-r border-gray-200 px-2 dark:border-gray-700"
      style={{ width }}
    >
      {plainTextComment ? (
        <Tooltip
          rootClassName="latest-comment-tooltip"
          title={
            <div className="latest-comment-tooltip-body" data-testid="latest-comment-tooltip-content">
              <div
                className="rich-comment-rendered"
                dangerouslySetInnerHTML={{ __html: sanitizedComment }}
              />
              {meta && <div className="latest-comment-tooltip-meta">{meta}</div>}
            </div>
          }
        >
          {canOpenComment ? (
            <button
              type="button"
              className="w-full truncate border-0 bg-transparent p-0 text-left text-sm text-gray-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-gray-300"
              aria-label={openCommentLabel}
              onClick={event => {
                event.stopPropagation();
                if (latestCommentId) onOpenComment?.(latestCommentId);
              }}
            >
              <span className="comments-column-preview">
                <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                {hasMore && <span className="comments-column-ellipsis">...</span>}
              </span>
            </button>
          ) : (
            <span
              className="w-full truncate text-sm text-gray-600 dark:text-gray-300"
              aria-label={columnLabel}
            >
              <span className="comments-column-preview">
                <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
                {hasMore && <span className="comments-column-ellipsis">...</span>}
              </span>
            </span>
          )}
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
