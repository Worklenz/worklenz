import { Flex, Typography } from 'antd';
import React, { ReactNode } from 'react';
import { durationDateFormat } from '../../../../../utils/durationDateFormat';
import { useTranslation } from 'react-i18next';
import { UserOutlined } from '@ant-design/icons';
import { colors } from '../../../../../styles/colors';

type SendChatItemProps = {
  chatData: {
    id: string;
    content: ReactNode | string;
    time: Date;
    is_me: boolean;
  };
};

const SendChatItem = ({ chatData }: SendChatItemProps) => {
  // localization
  const { t } = useTranslation('client-portal-chats');

  return (
    <Flex
      gap={12}
      style={{
        maxWidth: 400,
        width: '100%',
        padding: 12,
      }}
    >
      <div>
        <Flex
          align="center"
          justify="center"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: colors.lightGray,
          }}
        >
          <UserOutlined style={{ color: colors.white }} />
        </Flex>
      </div>

      <Flex vertical gap={12} flex={1}>
        <Flex align="center" justify="space-between">
          <Typography.Text
            type="secondary"
            style={{
              textTransform: 'capitalize',
              fontWeight: 500,
            }}
          >
            {t('youText')}
          </Typography.Text>

          <Typography.Text type="secondary">
            {durationDateFormat(chatData?.time)}
          </Typography.Text>
        </Flex>

        <div>{chatData.content}</div>
      </Flex>
    </Flex>
  );
};

export default SendChatItem;
