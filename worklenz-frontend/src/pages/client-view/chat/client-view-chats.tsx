import { Flex, Typography } from 'antd';
import React from 'react';
import ChatBoxWrapper from '../../client-portal/chats/chat-container/chat-box/chat-box-wrapper';
import { useTranslation } from 'react-i18next';

const ClientViewChats = () => {
  // localization
  const { t } = useTranslation('client-view-chats');

  return (
    <Flex vertical gap={24} style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ width: '100%' }}>
        <Typography.Title level={4} style={{ marginBlock: 0 }}>
          {t('title')}
        </Typography.Title>
      </Flex>

      <ChatBoxWrapper />
    </Flex>
  );
};

export default ClientViewChats;
