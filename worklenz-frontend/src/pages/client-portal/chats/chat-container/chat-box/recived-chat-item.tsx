import { Flex, Typography } from '@/shared/antd-imports';
import React, { ReactNode } from 'react';
import CustomAvatar from '../../../../../components/CustomAvatar';
import { durationDateFormat } from '../../../../../utils/durationDateFormat';
import { useAppSelector } from '../../../../../hooks/useAppSelector';
import { themeWiseColor } from '../../../../../utils/themeWiseColor';
import { PaperClipOutlined } from '@ant-design/icons';

type RecivedChatItemProps = {
  sendersName: string;
  chatData: {
    id: string;
    content: ReactNode | string;
    time: Date;
    is_me: boolean;
    file_url?: string | null;
    file_name?: string | null;
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
          {chatData.content && (
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
          )}
          {chatData.file_url && (
            <a
              href={chatData.file_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: chatData.content ? 6 : 0,
                padding: '8px 12px',
                backgroundColor: themeWiseColor('#f0f0f0', '#262626', themeMode),
                borderRadius: '12px 12px 12px 4px',
                fontSize: 13,
                color: themeWiseColor('#1677ff', '#4096ff', themeMode),
                textDecoration: 'none',
                maxWidth: 250,
                wordBreak: 'break-all',
              }}
            >
              <PaperClipOutlined />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chatData.file_name || 'Attachment'}
              </span>
            </a>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 4, paddingLeft: 4 }}>
            {durationDateFormat(chatData?.time)}
          </Typography.Text>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default RecivedChatItem;
