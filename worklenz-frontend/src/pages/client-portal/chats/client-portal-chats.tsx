import { Flex, Typography, Button, Tooltip } from '@/shared/antd-imports';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ChatBoxWrapper from './chat-container/chat-box/chat-box-wrapper';
import { MessageOutlined, ReloadOutlined } from '@ant-design/icons';
import { useGetChatsQuery } from '../../../api/client-portal/client-portal-api';
import { useAppSelector } from '../../../hooks/useAppSelector';
import { useResponsive } from '../../../hooks/useResponsive';

const ClientPortalChats = () => {
  // localization
  const { t } = useTranslation('client-portal-chats');
  const { isDesktop } = useResponsive();

  // API hooks
  const { data: chats, isLoading, error, refetch } = useGetChatsQuery();

  // Unread count calculation removed since badges were removed

  const handleRefresh = () => {
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

          <Tooltip title={t('refresh') || 'Refresh'}>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={isLoading}
            />
          </Tooltip>
        </Flex>
      </div>

      <ChatBoxWrapper />
    </div>
  );
};

export default ClientPortalChats;
