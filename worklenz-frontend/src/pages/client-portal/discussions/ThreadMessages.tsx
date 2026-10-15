import { Fragment, useEffect, useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { LockOutlined } from '@ant-design/icons';
import { Flex, theme } from '@/shared/antd-imports';
import { PortalAvatar, StatusTag, formatPortalDateTime } from '@/components/client-portal/v2';
import type { ThreadMessage } from '@/types/client-portal/v2';
import { MessageAttachments } from './MessageAttachments';
import { RichMessageContent } from './RichMessageContent';
import { isRichTextEmpty } from '../shared/rich-text/richText';

interface ThreadMessagesProps {
  messages: ThreadMessage[];
}

/** Highlights @Name for the client users a client-visible message actually mentioned. */
export const renderMentions = (text: string, mentions: string[], highlight: { background: string; color: string }) => {
  if (mentions.length === 0) return text;
  const escaped = mentions.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');
  return text.split(pattern).map((part, index) =>
    index % 2 === 1 ? (
      <span
        key={index}
        style={{ ...highlight, borderRadius: 4, padding: '0 4px', fontWeight: 600 }}
      >
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
};

/**
 * The conversation. Client messages sit on the left with a Client tag; the team's sit on the right.
 * An internal comment is orange with a lock and says only the team sees it, so it can never be mistaken
 * for something the client will read.
 */
export const ThreadMessages = ({ messages }: ThreadMessagesProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-discussions');
  const { token } = theme.useToken();
  const endRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view when the thread changes or a message is added.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length]);

  return (
    <div
      role="log"
      aria-label={t('thread.messagesLabel', { defaultValue: 'Messages' })}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}
    >
      {messages.map(message => {
        const isTeam = message.side === 'internal';
        const isInternalComment = message.visibility === 'internal';
        const bubbleBackground = isInternalComment
          ? token.colorWarningBg
          : isTeam
            ? token.colorPrimary
            : token.colorFillQuaternary;
        // A message of only files carries an empty paragraph; it should not leave a blank line above them.
        const hasBody = !isRichTextEmpty(message.text) || (message.attachments ?? []).length === 0;
        const bubbleColor =isInternalComment ? token.colorText : isTeam ? token.colorTextLightSolid : token.colorText;

        return (
          <Flex
            key={message.id}
            gap={8}
            justify={isTeam ? 'flex-end' : 'flex-start'}
            style={{ marginBottom: 14 }}
          >
            {!isTeam && <PortalAvatar name={message.author} />}
            <div style={{ maxWidth: 'min(560px, 82%)' }}>
              <Flex
                align="center"
                gap={6}
                wrap="wrap"
                justify={isTeam ? 'flex-end' : 'flex-start'}
                style={{ fontSize: 11.5, color: token.colorTextSecondary, marginBottom: 2 }}
              >
                <span>{message.author}</span>
                {!isTeam && <StatusTag tone="purple">{t('thread.clientTag', { defaultValue: 'Client' })}</StatusTag>}
                {isInternalComment && (
                  <StatusTag tone="orange" icon={<LockOutlined />}>
                    {t('thread.internalTag', { defaultValue: 'Internal' })}
                  </StatusTag>
                )}
              </Flex>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: bubbleBackground,
                  color: bubbleColor,
                  border: isInternalComment ? `1px dashed ${token.colorWarning}` : 'none',
                  wordBreak: 'break-word',
                  fontSize: 13,
                }}
              >
                {hasBody && <RichMessageContent
                  text={message.text}
                  style={
                    {
                      '--rich-message-mention-bg': isTeam && !isInternalComment ? 'rgba(255,255,255,0.25)' : token.colorPrimaryBg,
                      '--rich-message-mention-color':
                        isTeam && !isInternalComment ? token.colorTextLightSolid : token.colorPrimary,
                      '--rich-message-border': token.colorBorder,
                    } as CSSProperties
                  }
                  // Messages from before rich text are plain text: keep their line breaks and @Name highlight.
                  renderPlain={plain => (
                    <span style={{ whiteSpace: 'pre-wrap' }}>
                      {isInternalComment
                        ? plain
                        : renderMentions(plain, message.mentions, {
                            background: isTeam ? 'rgba(255,255,255,0.25)' : token.colorPrimaryBg,
                            color: isTeam ? token.colorTextLightSolid : token.colorPrimary,
                          })}
                    </span>
                  )}
                />}
                <MessageAttachments attachments={message.attachments ?? []} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: token.colorTextTertiary,
                  marginTop: 2,
                  textAlign: isTeam ? 'right' : 'left',
                }}
              >
                {formatPortalDateTime(message.at, i18n.language)}
                {isInternalComment &&
                  ` · ${t('thread.onlyTeamSees', { defaultValue: 'only your team sees this' })}`}
              </div>
            </div>
          </Flex>
        );
      })}
      <div ref={endRef} />
    </div>
  );
};
