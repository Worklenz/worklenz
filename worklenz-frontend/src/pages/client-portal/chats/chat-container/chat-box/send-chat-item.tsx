import { Flex, Typography } from '@/shared/antd-imports';
import React, { ReactNode } from 'react';
import { durationDateFormat } from '../../../../../utils/durationDateFormat';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../utils/themeWiseColor';
import { CheckOutlined } from '@ant-design/icons';

type SendChatItemProps = {
  chatData: {
    id: string;
    content: ReactNode | string;
    time: Date;
    is_me: boolean;
  };
};

const SendChatItem = ({ chatData }: SendChatItemProps) => {
  const { t } = useTranslation('client-portal-chats');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Flex justify="flex-end" style={{ width: '100%' }}>
      <Flex vertical align="flex-end" style={{ maxWidth: '70%' }}>
        <div
          style={{
            backgroundColor: '#1890ff',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '18px 18px 4px 18px',
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            fontSize: 14,
          }}
        >
          {chatData.content}
        </div>
        <Flex align="center" gap={4} style={{ marginTop: 4, paddingRight: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {durationDateFormat(chatData?.time)}
          </Typography.Text>
          <CheckOutlined
            style={{
              fontSize: 10,
              color: themeWiseColor('#8c8c8c', '#595959', themeMode),
            }}
          />
        </Flex>
      </Flex>
    </Flex>
  );
};

export default SendChatItem;
