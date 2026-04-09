import { useState, useEffect } from 'react';
import { Button, Form, Input, Space } from '@/shared/antd-imports';
import { ITaskCommentViewModel } from '@/types/tasks/task-comments.types';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { colors } from '@/styles/colors';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

interface TaskViewCommentEditProps {
  commentData: ITaskCommentViewModel;
  onUpdated: (comment: ITaskCommentViewModel) => void;
}

/**
 * Strips all HTML markup from stored comment content so the textarea shows
 * plain text ready for re-editing.
 *
 * Handles:
 *  - Mention spans  → @username  (via the explicit replace first)
 *  - Anchor tags    → raw URL    (the generic tag-stripper catches these,
 *                                 so https://... is restored automatically)
 *  - Any other tags the sanitizer or linkifier may have injected
 */
const prepareContentForEditing = (content: string): string => {
  if (!content) return '';

  // 1. Replace mention spans with plain @mentions so multi-word names are preserved
  const withoutMentionSpans = content.replace(
    /<span class="mentions">@([\w]+(?:\s+[\w]+)*)<\/span>/g,
    '@$1'
  );

  // 2. Replace <a href="...">label</a> with the raw href value so users see
  //    the original URL they typed, not the display label
  const withRawUrls = withoutMentionSpans.replace(/<a[^>]*href="([^"]*)"[^>]*>[^<]*<\/a>/gi, '$1');

  // 3. Strip any remaining HTML tags
  return withRawUrls.replace(/<[^>]*>/g, '');
};

const TaskViewCommentEdit = ({ commentData, onUpdated }: TaskViewCommentEditProps) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const { socket, connected } = useSocket();

  // Initialize content when component mounts
  useEffect(() => {
    if (commentData.content) {
      setContent(prepareContentForEditing(commentData.content));
    }
  }, [commentData.content]);

  const handleCancel = () => {
    commentData.edit = false;
    onUpdated(commentData);
  };

  const handleSave = async () => {
    if (!commentData.id || !commentData.task_id) return;

    try {
      setLoading(true);
      const res = await taskCommentsApiService.update(commentData.id, {
        ...commentData,
        content: content,
      });

      if (res.done) {
        commentData.content = content;
        onUpdated(commentData);

        // Dispatch event to notify that a comment was updated
        document.dispatchEvent(
          new CustomEvent('task-comment-update', {
            detail: { taskId: commentData.task_id },
          })
        );
      }
    } catch (e) {
      logger.error('Error updating comment', e);
    } finally {
      setLoading(false);
    }
  };

  // Theme-aware styles
  const textAreaStyle = {
    backgroundColor: themeWiseColor('#fff', '#2a2a2a', themeMode),
    color: themeWiseColor('#333', '#d1d0d3', themeMode),
    borderColor: themeWiseColor('#d9d9d9', '#333', themeMode),
  };

  return (
    <div className={`comment-edit-${themeMode}`}>
      <Form layout="vertical">
        <Form.Item>
          <Input.TextArea
            value={content}
            onChange={e => setContent(e.target.value)}
            autoSize={{ minRows: 3, maxRows: 6 }}
            style={textAreaStyle}
            placeholder="Type your comment here... Use @username to mention someone"
          />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" loading={loading} onClick={handleSave}>
              Save
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
};

export default TaskViewCommentEdit;
