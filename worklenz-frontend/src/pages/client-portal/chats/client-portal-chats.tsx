import { Typography } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetChatConversationsQuery } from '@api/client-portal/client-portal-api';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelEvents, ClientPortalEventProps } from '../../../types/mixpanel-events.types';
import { ChatsInbox } from './chat-container/ChatsInbox';

const ClientPortalChats = () => {
  const { t } = useTranslation('client-portal-chats');
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { data: conversations } = useGetChatConversationsQuery();
  const totalConversations = conversations?.length ?? 0;

  // Track page visit
  useEffect(() => {
    const pageEventProps: ClientPortalEventProps = {
      page: 'chats',
      section: 'client_portal',
      total_items: totalConversations,
      source: 'direct_visit',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_PAGE_VISITED, pageEventProps);
  }, [trackMixpanelEvent, totalConversations]);

  // Same header as Home > Inbox; the two-pane area below fills the rest of the page.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        minHeight: 520,
      }}
    >
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <Typography.Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {t('title', { defaultValue: 'Chats' })}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {t('description', { defaultValue: 'Direct messaging with your clients' })}
        </Typography.Text>
      </div>

      <ChatsInbox />
    </div>
  );
};

export default ClientPortalChats;
