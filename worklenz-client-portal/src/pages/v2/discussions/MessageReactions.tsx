import React, { useState } from 'react';
import { Button, Flex, Popover, Tooltip, SmileOutlined, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { ClientThreadMessageReactionV2 } from '@/types/v2';

export const POPULAR_REACTION_EMOJIS = ['👍', '❤️', '😄', '🎉', '🚀', '👀', '🔥', '👏', '💯', '🙏'] as const;

interface MessageReactionsProps {
  messageId: string;
  reactions?: ClientThreadMessageReactionV2[];
  canReact?: boolean;
  onToggleReaction: (messageId: string, emoji: string) => Promise<unknown> | void;
  align?: 'flex-start' | 'flex-end';
}

export const MessageReactions: React.FC<MessageReactionsProps> = ({
  messageId,
  reactions = [],
  canReact = false,
  onToggleReaction,
  align = 'flex-start',
}) => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleSelectEmoji = (emoji: string) => {
    setPopoverOpen(false);
    void onToggleReaction(messageId, emoji);
  };

  const handleBadgeClick = (emoji: string) => {
    if (!canReact) return;
    void onToggleReaction(messageId, emoji);
  };

  const pickerContent = (
    <Flex gap={6} wrap="wrap" style={{ maxWidth: 220, padding: 2 }}>
      {POPULAR_REACTION_EMOJIS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleSelectEmoji(emoji)}
          style={{
            background: 'transparent',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: token.borderRadiusSM,
            lineHeight: 1,
            transition: 'background 150ms ease, transform 100ms ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = token.colorFillTertiary;
            e.currentTarget.style.transform = 'scale(1.2)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.transform = 'scale(1)';
          }}
          aria-label={emoji}
        >
          {emoji}
        </button>
      ))}
    </Flex>
  );

  const hasReactions = reactions.length > 0;

  if (!hasReactions && !canReact) {
    return null;
  }

  return (
    <Flex
      align="center"
      gap={4}
      wrap="wrap"
      justify={align}
      role="group"
      aria-label={t('discussions.reactionsLabel', { defaultValue: 'Reactions' })}
      style={{ marginTop: 4 }}
    >
      {reactions.map(reaction => {
        const isReacted = reaction.has_reacted === true;
        const usersList = reaction.users ?? [];
        const tooltipContent = (
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {isReacted
                ? t('discussions.reactedTooltip', { defaultValue: 'Click to remove your reaction' })
                : canReact
                  ? t('discussions.notReactedTooltip', {
                      defaultValue: 'Click to react with {{emoji}}',
                      emoji: reaction.emoji,
                    })
                  : ''}
            </div>
            {usersList.map((u, i) => (
              <div key={`${u.id}-${i}`}>
                {u.name}
                {u.side === 'internal' && (
                  <span style={{ opacity: 0.75, marginInlineStart: 4 }}>
                    ({t('discussions.team', { defaultValue: 'Team' })})
                  </span>
                )}
              </div>
            ))}
          </div>
        );

        return (
          <Tooltip key={reaction.emoji} title={tooltipContent} mouseEnterDelay={0.3}>
            <button
              type="button"
              onClick={() => handleBadgeClick(reaction.emoji)}
              disabled={!canReact}
              aria-pressed={isReacted}
              aria-label={`${reaction.emoji} ${reaction.count}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: 12,
                cursor: canReact ? 'pointer' : 'default',
                transition: 'all 150ms ease',
                border: `1px solid ${isReacted ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                background: isReacted ? token.colorPrimaryBg : token.colorFillQuaternary,
                color: isReacted ? token.colorPrimary : token.colorText,
                fontWeight: isReacted ? 600 : 400,
              }}
              onMouseEnter={e => {
                if (!canReact) return;
                e.currentTarget.style.background = isReacted
                  ? token.colorPrimaryBgHover
                  : token.colorFillTertiary;
              }}
              onMouseLeave={e => {
                if (!canReact) return;
                e.currentTarget.style.background = isReacted
                  ? token.colorPrimaryBg
                  : token.colorFillQuaternary;
              }}
            >
              <span>{reaction.emoji}</span>
              <span style={{ fontSize: 11 }}>{reaction.count}</span>
            </button>
          </Tooltip>
        );
      })}

      {canReact && (
        <Popover
          content={pickerContent}
          trigger="click"
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
          placement="top"
        >
          <Tooltip title={t('discussions.addReaction', { defaultValue: 'Add reaction' })}>
            <Button
              type="text"
              size="small"
              icon={<SmileOutlined style={{ fontSize: 13, color: token.colorTextSecondary }} />}
              aria-label={t('discussions.addReaction', { defaultValue: 'Add reaction' })}
              style={{
                padding: '2px 6px',
                height: 24,
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
        </Popover>
      )}
    </Flex>
  );
};
