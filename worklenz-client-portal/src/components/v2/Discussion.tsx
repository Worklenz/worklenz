import { useState } from 'react';
import { Button, Flex, Tag, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '@/hooks/useFormatters';
import { useClientAccess } from '@/hooks/useClientAccess';
import { useMessage } from '@/hooks/useMessage';
import { decodeHtmlEntities } from '@/utils/html-entities';
import type { ClientThreadMessageV2 } from '@/types/v2';
import { useToggleMessageReactionMutation } from '@/store/api-v2';
import { MessageReactions } from '@/pages/v2/discussions/MessageReactions';
import { errorMessage } from './index';
import { LockedNote } from './LockedNote';
import { RichTextField } from './RichTextField';
import { RichTextView } from './RichTextView';
import { isRichTextEmpty } from './richTextUtils';

interface MessageListProps {
  messages: ClientThreadMessageV2[];
  /** Right-align the signed-in person's own messages (the discussion pane). */
  bubbles?: boolean;
  emptyText?: string;
}

/** Thread messages. A "Team" tag marks the project team; `@First Last` shows as a chip. */
export const MessageList = ({ messages, bubbles = false, emptyText }: MessageListProps) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { dateTime } = useFormatters();
  const { me, can } = useClientAccess();
  const [toggleReaction] = useToggleMessageReactionMutation();

  const toast = useMessage();
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleReaction({ messageId, emoji }).unwrap();
    } catch (error) {
      void toast.error(errorMessage(error) ?? t('discussions.reactFailed', { defaultValue: 'Failed to update reaction' }));
    }
  };

  if (messages.length === 0) {
    return emptyText ? (
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        {emptyText}
      </Typography.Text>
    ) : null;
  }

  return (
    <div>
      {messages.map(message => {
        const mine = bubbles && decodeHtmlEntities(message.author) === decodeHtmlEntities(me?.name);
        return (
          <Flex
            key={message.id}
            vertical
            align={mine ? 'flex-end' : 'flex-start'}
            style={{ marginBottom: 12 }}
          >
            <Typography.Text style={{ fontSize: token.fontSizeSM }} strong>
              {decodeHtmlEntities(message.author)}
              {message.side === 'internal' && (
                <Tag color="blue" style={{ marginInlineStart: 6 }}>
                  {t('discussions.team', { defaultValue: 'Team' })}
                </Tag>
              )}
              <Typography.Text type="secondary" style={{ fontWeight: 400, marginInlineStart: 6 }}>
                {dateTime(message.at)}
              </Typography.Text>
            </Typography.Text>
            <div
              style={{
                marginTop: 2,
                maxWidth: bubbles ? '80%' : '100%',
                padding: bubbles ? '8px 12px' : 0,
                borderRadius: token.borderRadiusLG,
                background: bubbles ? (mine ? 'var(--portal-brand-tint-soft)' : token.colorFillTertiary) : 'transparent',
                wordBreak: 'break-word',
              }}
            >
              <RichTextView value={message.text} />
            </div>
            {!message.deleted && (
              <MessageReactions
                messageId={message.id}
                reactions={message.reactions}
                canReact={can.comment}
                onToggleReaction={handleToggleReaction}
                align={mine ? 'flex-end' : 'flex-start'}
              />
            )}

          </Flex>
        );
      })}
    </div>
  );
};

interface CommentComposerProps {
  placeholder: string;
  sendLabel?: string;
  canComment: boolean;
  /** Shown instead of the box for roles that can't comment. */
  lockedText: string;
  onSend: (text: string) => Promise<unknown>;
}

/** Rich-text reply box (the same editor as the other notes and descriptions). Viewers see a note instead of nothing. */
export const CommentComposer = ({ placeholder, sendLabel, canComment, lockedText, onSend }: CommentComposerProps) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  if (!canComment) return <LockedNote>{lockedText}</LockedNote>;

  const send = async () => {
    const text = draft;
    if (isRichTextEmpty(text) || sending) return;
    setSending(true);
    try {
      await onSend(text);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <Flex gap={8} align="flex-end">
      <RichTextField
        value={draft}
        onChange={setDraft}
        onSubmit={() => void send()}
        placeholder={placeholder}
        ariaLabel={placeholder}
        maxLength={5000}
        minHeight={24}
        maxHeight={180}
        disabled={sending}
      />
      <Button type="primary" loading={sending} disabled={isRichTextEmpty(draft)} onClick={() => void send()}>
        {sendLabel ?? t('discussions.send', { defaultValue: 'Send' })}
      </Button>
    </Flex>
  );
};
