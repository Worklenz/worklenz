import { useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, DeleteOutlined, EditOutlined, Flex, LockOutlined, Popconfirm, RollbackOutlined, Tag, theme } from '@/shared/antd-imports';
import { useFormatters } from '@/hooks/useFormatters';
import { useMessage } from '@/hooks/useMessage';
import { useDeleteMessageMutation } from '@/store/api-v2';
import { errorMessage } from '@/components/v2';
import { RichTextView, isRichTextEmpty } from '@/components/v2';
import type { ClientThreadMessageV2 } from '@/types/v2';
import { MessageAttachments } from './MessageAttachments';
import { ThreadAvatar } from './discussionUtils';
import './ThreadMessages.css';

interface ThreadMessagesProps {
  messages: ClientThreadMessageV2[];
  /** Replying needs the Comment capability; without it no actions are shown. */
  canComment?: boolean;
  /** The sender can also edit and delete their own message. False on a change request's thread. */
  canModify?: boolean;
  onReply?: (message: ClientThreadMessageV2) => void;
  onEdit?: (message: ClientThreadMessageV2) => void;
  /** Called after one of this person's messages was deleted, so the composer can drop a stale reply or edit. */
  onDeleted?: (messageId: string) => void;
}

/**
 * The conversation. The signed-in person's own messages sit on the right in the brand colour; everyone
 * else's sit on the left with an avatar, and the team's carry a Team tag. Internal comments never reach
 * this app, so every message here is one the whole project can read.
 */
export const ThreadMessages = ({ messages, canComment = false, canModify = false, onReply, onEdit, onDeleted }: ThreadMessagesProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const toast = useMessage();
  const [deleteMessage, { isLoading: isDeleting }] = useDeleteMessageMutation();

  const remove = async (messageId: string) => {
    try {
      await deleteMessage(messageId).unwrap();
      onDeleted?.(messageId);
      void toast.success(t('discussions.deleted', { defaultValue: 'Message deleted.' }));
    } catch (error) {
      void toast.error(errorMessage(error) ?? t('discussions.deleteFailed', { defaultValue: 'We could not delete your message. Please try again.' }));
    }
  };
  const { dateTime } = useFormatters();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view when the thread changes or a message is added.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  return (
    <div
      role="log"
      aria-label={t('discussions.messagesLabel', { defaultValue: 'Messages' })}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}
    >
      {messages.map(message => {
        const isMine = message.mine === true;
        const isTeam = message.side === 'internal';
        const isClientOnly = message.visibility === 'client_only';
        // A message of only files carries an empty paragraph; it should not leave a blank line above them.
        const attachments = message.attachments ?? [];
        const hasBody = !isRichTextEmpty(message.text) || attachments.length === 0;
        const isDeleted = message.deleted === true;
        const canReplyTo = canComment && !isDeleted && Boolean(onReply);
        const canChange = canModify && isMine && !isDeleted;
        const onBrand = isMine && !isClientOnly;

        return (
          <Flex key={message.id} gap={8} justify={isMine ? 'flex-end' : 'flex-start'} style={{ marginBottom: 14 }}>
            {!isMine && <ThreadAvatar name={message.author} />}
            <div className="thread-message" style={{ maxWidth: 'min(560px, 82%)' }}>
              <Flex
                align="center"
                gap={6}
                wrap="wrap"
                justify={isMine ? 'flex-end' : 'flex-start'}
                style={{ fontSize: 11.5, color: token.colorTextSecondary, marginBottom: 2 }}
              >
                <span>{message.author}</span>
                {isTeam && <Tag color="blue" style={{ marginInlineEnd: 0 }}>{t('discussions.team', { defaultValue: 'Team' })}</Tag>}
                {isClientOnly && (
                  <Tag color="orange" icon={<LockOutlined />} style={{ marginInlineEnd: 0 }}>
                    {t('discussions.clientOnlyTag', { defaultValue: 'Client users only' })}
                  </Tag>
                )}
              </Flex>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: isClientOnly ? token.colorWarningBg : isMine ? token.colorPrimary : token.colorFillQuaternary,
                  color: isMine && !isClientOnly ? token.colorTextLightSolid : token.colorText,
                  border: isClientOnly ? `1px dashed ${token.colorWarning}` : 'none',
                  wordBreak: 'break-word',
                  fontSize: 13,
                }}
              >
                {message.reply_to && (
                  <div
                    style={{
                      marginBottom: 6,
                      padding: '2px 8px',
                      borderInlineStart: `3px solid ${onBrand ? token.colorTextLightSolid : token.colorPrimary}`,
                      fontSize: 12,
                      opacity: 0.85,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{message.reply_to.author}</div>
                    <div style={{ fontStyle: message.reply_to.deleted ? 'italic' : 'normal', overflowWrap: 'anywhere' }}>
                      {message.reply_to.deleted
                        ? t('discussions.messageDeleted', { defaultValue: 'This message was deleted' })
                        : message.reply_to.snippet}
                    </div>
                  </div>
                )}
                {isDeleted && (
                  <span style={{ fontStyle: 'italic', opacity: 0.8 }}>
                    {t('discussions.messageDeleted', { defaultValue: 'This message was deleted' })}
                  </span>
                )}
                {!isDeleted && hasBody && (
                  <RichTextView
                    value={message.text}
                    style={
                      {
                        '--rich-message-mention-bg': isMine && !isClientOnly ? 'rgba(255,255,255,0.25)' : token.colorPrimaryBg,
                        '--rich-message-mention-color': isMine && !isClientOnly ? token.colorTextLightSolid : token.colorPrimary,
                        '--rich-message-border': token.colorBorder,
                        '--rich-message-link': isMine && !isClientOnly ? token.colorTextLightSolid : token.colorPrimary,
                      } as CSSProperties
                    }
                  />
                )}
                {!isDeleted && <MessageAttachments attachments={attachments} />}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  marginTop: 2,
                  textAlign: isMine ? 'right' : 'left',
                }}
              >
                {dateTime(message.at)}
                {message.edited && ` · ${t('discussions.edited', { defaultValue: 'edited' })}`}
                {isClientOnly && ` · ${t('discussions.onlyClientsSee', { defaultValue: 'your team cannot see this' })}`}
              </div>
              {(canReplyTo || canChange) && (
                <Flex className="thread-message-actions" gap={2} justify={isMine ? 'flex-end' : 'flex-start'} style={{ marginTop: 2 }}>
                  {canReplyTo && (
                    <Button type="text" size="small" icon={<RollbackOutlined />} onClick={() => onReply?.(message)}>
                      {t('discussions.replyAction', { defaultValue: 'Reply' })}
                    </Button>
                  )}
                  {canChange && onEdit && (
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(message)}>
                      {t('discussions.edit', { defaultValue: 'Edit' })}
                    </Button>
                  )}
                  {canChange && (
                    <Popconfirm
                      title={t('discussions.deleteConfirm', { defaultValue: 'Delete this message?' })}
                      description={t('discussions.deleteConfirmHint', { defaultValue: 'Replies will show that it was deleted.' })}
                      okText={t('discussions.delete', { defaultValue: 'Delete' })}
                      cancelText={t('discussions.cancel', { defaultValue: 'Cancel' })}
                      okButtonProps={{ danger: true, loading: isDeleting }}
                      onConfirm={() => void remove(message.id)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                        {t('discussions.delete', { defaultValue: 'Delete' })}
                      </Button>
                    </Popconfirm>
                  )}
                </Flex>
              )}
            </div>
          </Flex>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};
