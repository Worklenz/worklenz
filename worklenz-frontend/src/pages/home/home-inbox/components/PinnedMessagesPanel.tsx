import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Flex, Spin, Tooltip, Typography } from '@/shared/antd-imports';
import { CloseOutlined, PushpinFilled } from '@ant-design/icons';
import { projectCommentsApiService } from '@/api/projects/comments/project-comments.api.service';
import {
  IPinnedProjectComment,
  IProjectCommentPinChangedSocketPayload,
} from '@/types/home/inbox.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';

interface PinnedMessagesPanelProps {
  projectId: string;
  onClose: () => void;
}

const PinnedMessagesPanel: React.FC<PinnedMessagesPanelProps> = ({ projectId, onClose }) => {
  const { t } = useTranslation('home-inbox');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { socket } = useSocket();

  const [pinned, setPinned] = useState<IPinnedProjectComment[]>([]);
  const [loading, setLoading] = useState(true);

  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);
  const textSec = themeWiseColor('rgba(0,0,0,.45)', 'rgba(255,255,255,.45)', themeMode);

  const fetchPinned = useCallback(async () => {
    try {
      const res = await projectCommentsApiService.getPinnedByProjectId(projectId);
      if (res.done) setPinned(res.body || []);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    void fetchPinned();
  }, [fetchPinned]);

  useEffect(() => {
    if (!socket) return;
    const onPinChanged = (payload: IProjectCommentPinChangedSocketPayload) => {
      if (payload?.project_id === projectId) void fetchPinned();
    };
    socket.on(SocketEvents.PROJECT_COMMENT_PIN_CHANGED.toString(), onPinChanged);
    return () => {
      socket.off(SocketEvents.PROJECT_COMMENT_PIN_CHANGED.toString(), onPinChanged);
    };
  }, [socket, projectId, fetchPinned]);

  const unpin = async (commentId: string) => {
    try {
      await projectCommentsApiService.setPinned(commentId, projectId, false);
      setPinned(prev => prev.filter(p => p.id !== commentId));
    } catch {
      // socket refetch will reconcile
    }
  };

  return (
    <div
      style={{
        borderLeft: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
      }}
    >
      <Flex
        align="center"
        justify="space-between"
        style={{ padding: '12px 14px', borderBottom: `1px solid ${border}` }}
      >
        <Typography.Text strong style={{ fontSize: 13 }}>
          <PushpinFilled style={{ marginRight: 6, color: '#1677ff' }} />
          {t('pinnedMessages', { defaultValue: 'Pinned messages' })}
        </Typography.Text>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: textSec }}
        >
          <CloseOutlined />
        </button>
      </Flex>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Flex align="center" justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : pinned.length === 0 ? (
          <Flex align="center" justify="center" style={{ padding: 24 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
              {t('noPinnedMessages', { defaultValue: 'No pinned messages yet' })}
            </Typography.Text>
          </Flex>
        ) : (
          pinned.map(item => (
            <div
              key={item.id}
              style={{ padding: '10px 12px', borderBottom: `1px solid ${border}` }}
            >
              <Flex align="center" justify="space-between" gap={6}>
                <Flex align="center" gap={2} style={{ minWidth: 0 }}>
                  <SingleAvatar name={item.created_by} avatarUrl={item.avatar_url} />
                  <Typography.Text strong style={{ fontSize: 12 }} ellipsis>
                    {item.created_by}
                  </Typography.Text>
                </Flex>
                <Tooltip title={t('unpinMessage', { defaultValue: 'Unpin' })}>
                  <button
                    onClick={() => unpin(item.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: textSec,
                      flexShrink: 0,
                    }}
                  >
                    <CloseOutlined style={{ fontSize: 11 }} />
                  </button>
                </Tooltip>
              </Flex>
              <div style={{ fontSize: 12, marginTop: 4, wordBreak: 'break-word' }}>
                {item.content_preview}
              </div>
              <div style={{ fontSize: 11, color: textSec, marginTop: 4 }}>
                {item.created_at ? dayjs(item.created_at).format('MMM D, YYYY h:mm A') : ''}
                {item.pinned_by_name
                  ? ` · ${t('pinnedBy', { defaultValue: 'Pinned by' })} ${item.pinned_by_name}`
                  : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PinnedMessagesPanel;
