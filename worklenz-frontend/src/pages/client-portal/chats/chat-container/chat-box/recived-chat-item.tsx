import { Flex, Typography } from '@/shared/antd-imports';
import React, { ReactNode } from 'react';
import CustomAvatar from '../../../../../components/CustomAvatar';
import { durationDateFormat } from '../../../../../utils/durationDateFormat';

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
  return (
    <Flex
      gap={12}
      style={{
        maxWidth: 400,
        padding: 12,
      }}
    >
      <div>
        <CustomAvatar avatarName={sendersName} />
      </div>
      <Flex vertical gap={8} flex={1}>
        <Flex align="center" justify="space-between">
          <Typography.Text
            type="secondary"
            style={{
              textTransform: 'capitalize',
              fontWeight: 500,
              fontSize: 12,
            }}
          >
            {sendersName}
          </Typography.Text>

          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {durationDateFormat(chatData?.time)}
          </Typography.Text>
        </Flex>

        <div
          style={{
            wordBreak: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4',
          }}
        >
          {chatData.content}
        </div>
      </Flex>
    </Flex>
  );
};

export default RecivedChatItem;
