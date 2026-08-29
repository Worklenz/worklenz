import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Flex,
  Typography,
  Input,
  Button,
  Avatar,
  theme,
  SmileOutlined,
  PlusOutlined,
  SyncOutlined,
  SearchOutlined,
  MessageOutlined,
} from '@/shared/antd-imports';

const { useToken } = theme;
const { Title, Text } = Typography;

const ClientPortalChatsPreviewMockup: React.FC = () => {
  const { token } = useToken();
  const { t } = useTranslation('client-portal-chats');

  return (
    <Flex vertical gap={16} style={{ height: '100%' }}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <Flex align="center" gap={10}>
          <SmileOutlined style={{ fontSize: 18 }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>
              {t('title', { defaultValue: 'Messages' })}
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t('description', { defaultValue: 'Communicate with your team and clients' })}
            </Text>
          </div>
        </Flex>
        <Flex align="center" gap={8}>
          <Button type="primary" icon={<PlusOutlined />}>
            {t('startConversation', { defaultValue: 'New Conversation' })}
          </Button>
          <SyncOutlined style={{ color: token.colorTextTertiary }} title={t('refresh', { defaultValue: 'Refresh' })} />
        </Flex>
      </Flex>

      <Card style={{ flex: 1, minHeight: 0 }} styles={{ body: { padding: 0, height: '100%' } }}>
        <Flex style={{ height: '100%' }}>
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              padding: 16,
            }}
          >
            <Text strong style={{ fontSize: 13 }}>
              {t('chatsTitle', { defaultValue: 'Conversations' })}
            </Text>
            <Input
              placeholder={t('searchConversations', { defaultValue: 'Search conversations...' })}
              prefix={<SearchOutlined />}
              style={{ margin: '10px 0' }}
              size="small"
            />
            <Flex align="center" gap={10} style={{ padding: '8px 4px' }}>
              <Avatar size={32} style={{ background: '#eb2f96' }}>
                G
              </Avatar>
              <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                <Flex justify="space-between" align="center">
                  <Text strong style={{ fontSize: 13 }}>
                    Gayan Client
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Jun 11
                  </Text>
                </Flex>
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                  Subject: Chats fdgdf
                </Text>
              </Flex>
            </Flex>
          </div>

          <Flex vertical align="center" justify="center" gap={8} style={{ flex: 1 }}>
            <Flex
              align="center"
              justify="center"
              style={{ width: 56, height: 56, borderRadius: '50%', background: token.colorFillTertiary }}
            >
              <MessageOutlined style={{ fontSize: 22, color: token.colorTextTertiary }} />
            </Flex>
            <Text style={{ fontSize: 13 }}>{t('selectChatMessage', { defaultValue: 'Select a conversation to view messages' })}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('selectChatDescription', { defaultValue: 'Choose a conversation from the list to start chatting' })}
            </Text>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};

export default ClientPortalChatsPreviewMockup;
