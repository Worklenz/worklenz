import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Flex, Input, message, theme } from '@/shared/antd-imports';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import type { IHomeMention } from '@/api/home-page/home-page.api.service';

/** The same ceiling the task drawer's comment box applies. */
const MAX_COMMENT_LENGTH = 5000;

interface MentionReplyFormProps {
  mention: IHomeMention;
  onClose: () => void;
}

/**
 * A reply to a comment that mentioned the user. It is not a separate kind of message: it is added as
 * an ordinary comment on the task that comment is on, and starts with an @mention of its author so
 * they are told about it, exactly as if it had been written in the task drawer.
 */
export const MentionReplyForm: React.FC<MentionReplyFormProps> = ({ mention, onClose }) => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const mentionText = `@${mention.author_name}`;
  const [value, setValue] = useState(`${mentionText} `);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<TextAreaRef>(null);

  useEffect(() => {
    inputRef.current?.focus({ cursor: 'end' });
  }, []);

  // Just the @mention is not a reply.
  const hasReply = value.replace(mentionText, '').trim().length > 0;

  const send = async () => {
    if (!hasReply || isSending) return;
    setIsSending(true);
    try {
      const response = await taskCommentsApiService.create({
        task_id: mention.task_id,
        content: value.trim(),
        // The author is only notified if the @mention is still in the text.
        mentions:
          mention.author_team_member_id && value.includes(mentionText)
            ? [{ team_member_id: mention.author_team_member_id, name: mention.author_name }]
            : [],
        attachments: [],
      });
      if (!response.done) throw new Error(response.message);
      message.success(t('mentions.replySent', { defaultValue: 'Reply added to “{{task}}”.', task: mention.task_name }));
      // Lets an open task drawer for this task show the new comment.
      document.dispatchEvent(new CustomEvent('task-comment-create', { detail: { taskId: mention.task_id } }));
      onClose();
    } catch {
      message.error(t('mentions.replyFailed', { defaultValue: "Couldn't post your reply. Please try again." }));
      setIsSending(false);
    }
  };

  return (
    <Flex vertical gap={6} style={{ paddingBottom: 8 }}>
      <Input.TextArea
        ref={inputRef}
        value={value}
        maxLength={MAX_COMMENT_LENGTH}
        autoSize={{ minRows: 2, maxRows: 6 }}
        disabled={isSending}
        placeholder={t('mentions.replyPlaceholder', { defaultValue: 'Write a reply…' })}
        aria-label={t('mentions.replyLabel', { defaultValue: 'Reply to {{name}}', name: mention.author_name })}
        style={{ fontSize: 12 }}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send();
        }}
      />
      <span style={{ fontSize: 11, color: token.colorTextTertiary }}>
        {t('mentions.replyHint', { defaultValue: 'Posted as a comment on “{{task}}”.', task: mention.task_name })}
      </span>
      <Flex gap={8} justify="flex-end">
        <Button size="small" type="text" disabled={isSending} onClick={onClose}>
          {t('customize.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button size="small" type="primary" loading={isSending} disabled={!hasReply} onClick={send}>
          {t('mentions.reply', { defaultValue: 'Reply' })}
        </Button>
      </Flex>
    </Flex>
  );
};
