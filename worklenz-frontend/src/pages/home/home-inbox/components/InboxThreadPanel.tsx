import React from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { ArrowLeftOutlined, PushpinFilled, PushpinOutlined } from '@ant-design/icons';
import ChatBox from '@/ee/pages/client-portal/chats/chat-container/chat-box/chat-box';
import ProjectViewUpdates from '@/pages/projects/project-view-1/updates/project-view-updates';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import { InboxConversation } from '../hooks/useInboxConversations';

interface InboxThreadPanelProps {
  selected: InboxConversation | null;
  pinnedPanelOpen: boolean;
  onTogglePinnedPanel: () => void;
  /** Mobile only — when provided, a back button returns to the conversation list. */
  onBack?: () => void;
}

const InboxThreadPanel: React.FC<InboxThreadPanelProps> = ({
  selected,
  pinnedPanelOpen,
  onTogglePinnedPanel,
  onBack,
}) => {
  const { t } = useTranslation('home-inbox');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);

  const backButton = onBack && (
    <button
      onClick={onBack}
      style={{
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <ArrowLeftOutlined />
    </button>
  );

  if (!selected) {
    return (
      <Flex vertical style={{ flex: 1, minHeight: 0 }}>
        {onBack && (
          <Flex
            align="center"
            gap={8}
            style={{ padding: '10px 16px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}
          >
            {backButton}
          </Flex>
        )}
        <Flex align="center" justify="center" style={{ flex: 1 }}>
          <Typography.Text type="secondary">
            {t('selectConversation', { defaultValue: 'Select a conversation to view messages' })}
          </Typography.Text>
        </Flex>
      </Flex>
    );
  }

  if (selected.category === 'client') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <ChatBox openedChat={selected} onBack={onBack} />
      </div>
    );
  }

  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${border}`,
        }}
      >
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          {backButton}
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              flexShrink: 0,
              background: selected.colorCode || '#1677ff',
            }}
          />
          <Typography.Text strong style={{ fontSize: 14 }} ellipsis>
            {selected.name}
          </Typography.Text>
        </Flex>
        <Tooltip title={t('pinnedMessages', { defaultValue: 'Pinned messages' })}>
          <button
            onClick={onTogglePinnedPanel}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 15,
              color: pinnedPanelOpen ? '#1677ff' : undefined,
            }}
          >
            {pinnedPanelOpen ? <PushpinFilled /> : <PushpinOutlined />}
          </button>
        </Tooltip>
      </Flex>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ProjectViewUpdates key={selected.id} projectId={selected.id} fullHeight />
      </div>
    </>
  );
};

export default InboxThreadPanel;
