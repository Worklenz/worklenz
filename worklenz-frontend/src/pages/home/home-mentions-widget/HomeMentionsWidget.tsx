import React, { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
import { Button, Typography, theme } from '@/shared/antd-imports';
import CustomAvatar from '@/components/CustomAvatar';
import { useGetHomeMentionsQuery } from '@/api/home-page/home-page.api.service';
import { HomeWidgetCard, WidgetEmpty, WidgetError, WidgetLoading } from '../home-widgets/HomeWidgetCard';
import { useOpenHomeTask } from '../home-widgets/useOpenHomeTask';
import { WIDGET_DATA_ATTRIBUTE } from '../home-widgets/widgetInteraction';
import { MentionReplyForm } from './MentionReplyForm';

dayjs.extend(relativeTime);

const MENTION_LIMIT = 6;
/** New mentions arrive from other people's actions, so look again from time to time while the page is open. */
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

/** The avatar (28px) and the gap after it, so a reply lines up with the comment's text. */
const REPLY_INDENT = 38;

/**
 * Recent task comments where a teammate @mentioned the user. Click a comment to open its task, or
 * reply to it right here: the reply is added as a comment on that task.
 */
export const HomeMentionsWidget: React.FC = () => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const openTask = useOpenHomeTask();
  // The comment being replied to, if any: one at a time.
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useGetHomeMentionsQuery(
    { limit: MENTION_LIMIT },
    { refetchOnMountOrArgChange: 30, pollingInterval: REFRESH_INTERVAL_MS, skipPollingIfUnfocused: true }
  );

  const mentions = data?.body ?? [];

  return (
    <HomeWidgetCard title={t('customize.widgets.mentions', { defaultValue: 'Comments mentioning me' })}>
      {isLoading && <WidgetLoading />}
      {isError && !data && <WidgetError onRetry={refetch} />}
      {data &&
        (mentions.length === 0 ? (
          <WidgetEmpty
            text={t('mentions.empty', { defaultValue: 'No one has mentioned you in a comment yet.' })}
          />
        ) : (
          <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }}>
            {mentions.map(mention => (
              <div key={mention.id}>
              <button
                type="button"
                className="home-widget-row"
                onClick={() => openTask(mention.task_id, mention.project_id)}
              >
                <CustomAvatar avatarName={mention.author_name} avatarUrl={mention.author_avatar_url ?? undefined} size={28} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <Typography.Text ellipsis style={{ fontSize: 13, fontWeight: 500, minWidth: 0 }}>
                      {mention.author_name}
                    </Typography.Text>
                    <span style={{ flexShrink: 0, fontSize: 11, color: token.colorTextTertiary }}>
                      {dayjs(mention.created_at).fromNow()}
                    </span>
                  </span>
                  <span
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      overflowWrap: 'anywhere',
                      fontSize: 12,
                      color: token.colorText,
                    }}
                  >
                    {mention.excerpt}
                  </span>
                  <Typography.Text ellipsis style={{ display: 'block', fontSize: 11, color: token.colorTextSecondary }}>
                    {mention.task_name} · {mention.project_name}
                  </Typography.Text>
                </span>
              </button>
              {/* Lined up under the comment's text (the avatar and the gap are 38px). */}
              <div style={{ paddingLeft: REPLY_INDENT }}>
                {replyingToId === mention.id ? (
                  <MentionReplyForm mention={mention} onClose={() => setReplyingToId(null)} />
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => setReplyingToId(mention.id)}
                    aria-label={t('mentions.replyLabel', { defaultValue: 'Reply to {{name}}', name: mention.author_name })}
                    style={{ padding: 0, height: 'auto', marginBottom: 6, fontSize: 12 }}
                  >
                    {t('mentions.reply', { defaultValue: 'Reply' })}
                  </Button>
                )}
              </div>
              </div>
            ))}
          </div>
        ))}
    </HomeWidgetCard>
  );
};

export default HomeMentionsWidget;
