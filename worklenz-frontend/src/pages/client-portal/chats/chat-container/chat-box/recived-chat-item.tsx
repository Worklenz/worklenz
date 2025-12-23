import { Flex, Typography } from '@/shared/antd-imports';
import React, { ReactNode } from 'react';
import CustomAvatar from '../../../../../components/CustomAvatar';
import { durationDateFormat } from '../../../../../utils/durationDateFormat';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../utils/themeWiseColor';

type RecivedChatItemProps = {
  sendersName: string;
  chatData: {
    id: string;
    content: ReactNode | string;
    time: Date;
    is_me: boolean;
  };
};

const RecivedChatItem = ({ sendersName, chatData }: RecivedChatItemProps) => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  return (
    <Flex justify="flex-start" style={{ width: '100%' }}>
      <Flex gap={10} style={{ maxWidth: '70%' }}>
        <CustomAvatar avatarName={sendersName} size={32} />
        <Flex vertical align="flex-start">
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 12,
              fontWeight: 500,
              textTransform: 'capitalize',
              marginBottom: 4,
              paddingLeft: 4,
            }}
          >
            {sendersName}
          </Typography.Text>
          <div
            style={{
              backgroundColor: themeWiseColor('#f0f0f0', '#262626', themeMode),
              color: themeWiseColor('#262626', '#e8e8e8', themeMode),
              padding: '10px 14px',
              borderRadius: '18px 18px 18px 4px',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            {chatData.content}
          </div>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, marginTop: 4, paddingLeft: 4 }}
          >
            {durationDateFormat(chatData?.time)}
          </Typography.Text>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default RecivedChatItem;
