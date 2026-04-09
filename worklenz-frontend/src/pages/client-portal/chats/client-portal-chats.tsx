import { Flex, Typography, Button, Tooltip, Space } from '@/shared/antd-imports';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ChatBoxWrapper from './chat-container/chat-box/chat-box-wrapper';
import { MessageOutlined, ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useGetOrganizationChatsQuery } from '@api/client-portal/client-portal-api';
import { useResponsive } from '@/hooks/useResponsive';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '../../../types/mixpanel-events.types';

const ClientPortalChats = () => {
  // localization
  const { t } = useTranslation('client-portal-chats');
  const { isDesktop } = useResponsive();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  // API hooks - using organization-side endpoint (clientId is optional)
  const { data: chatsData, isLoading, error, refetch } = useGetOrganizationChatsQuery({});
  const chats = chatsData?.chats || [];

  // Track page visit
  useEffect(() => {
    const pageEventProps: ClientPortalEventProps = {
      page: 'chats',
      section: 'client_portal',
      total_items: chats?.length || 0,
      source: 'direct_visit',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_PAGE_VISITED, pageEventProps);
  }, [trackMixpanelEvent, chats]);

  const handleRefresh = () => {
    const actionProps: ClientPortalActionEventProps = {
      action_type: 'refresh',
      item_type: 'chat',
      page: 'chats',
      section: 'client_portal',
      source: 'refresh_button',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_CHAT_REFRESHED, actionProps);
    refetch();
  };

  return (
    <div
      style={{
        maxWidth: '100%',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isDesktop ? 32 : 24 }}>
        <Flex align="center" justify="space-between" style={{ width: '100%' }} wrap="wrap" gap={16}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
              <MessageOutlined style={{ fontSize: 20 }} />
              <Typography.Title
                level={4}
                style={{
                  margin: 0,
                  fontSize: '20px',
                }}
              >
                {t('title') || 'Messages'}
              </Typography.Title>
            </Flex>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: isDesktop ? '16px' : '14px',
                lineHeight: 1.5,
              }}
            >
              {t('description') || 'Communicate with your team and clients'}
            </Typography.Text>
          </div>

          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsNewChatModalOpen(true)}
              size={isDesktop ? 'middle' : 'small'}
            >
              {t('startConversation') || 'New Conversation'}
            </Button>
            <Tooltip title={t('refresh') || 'Refresh'}>
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={isLoading}
              />
            </Tooltip>
          </Space>
        </Flex>
      </div>

      <ChatBoxWrapper
        isNewChatModalOpen={isNewChatModalOpen}
        setIsNewChatModalOpen={setIsNewChatModalOpen}
      />
    </div>
  );
};

export default ClientPortalChats;
