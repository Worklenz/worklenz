import { Flex, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import ChatBoxWrapper from './chat-container/chat-box/chat-box-wrapper';

const ClientPortalChats = () => {
  // localization
  const { t } = useTranslation('client-portal-chats');

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={5}>{t('title')}</Typography.Title>
      </Flex>

      <ChatBoxWrapper />
    </Flex>
  );
};

export default ClientPortalChats;
