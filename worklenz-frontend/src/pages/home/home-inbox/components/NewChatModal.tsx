import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, Input, Modal, Spin, Typography } from '@/shared/antd-imports';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';
import { useGetProjectsByTeamQuery } from '@/api/home-page/home-page.api.service';
import { useGetClientsQuery } from '@/ee/api/client-portal/client-portal-api';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@utils/themeWiseColor';
import { InboxConversation } from '../hooks/useInboxConversations';

export type NewChatMode = 'project' | 'client';

interface NewChatModalProps {
  open: boolean;
  mode: NewChatMode;
  existingConversationIds: string[];
  clientConversations: InboxConversation[];
  onSelectProject: (project: { id: string; name?: string; colorCode?: string }) => void;
  onSelectClientConversation: (conversation: InboxConversation) => void;
  onStartClientChat: (client: { id: string; name: string }) => void;
  onClose: () => void;
}

// Pick a project or client from the current team to open (or start) its
// conversation. Which list is shown follows the Inbox's active tab (mode).
const NewChatModal: React.FC<NewChatModalProps> = ({
  open,
  mode,
  existingConversationIds,
  clientConversations,
  onSelectProject,
  onSelectClientConversation,
  onStartClientChat,
  onClose,
}) => {
  const { t } = useTranslation('home-inbox');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [search, setSearch] = useState('');

  const { data: projectsData, isLoading: isLoadingProjects } = useGetProjectsByTeamQuery(undefined, {
    skip: mode !== 'project',
  });
  const { data: clientsData, isLoading: isLoadingClients } = useGetClientsQuery(
    { page: 1, limit: 100, status: 'active' },
    { skip: mode !== 'client' }
  );

  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);
  const hoverBg = themeWiseColor('rgba(0,0,0,.04)', 'rgba(255,255,255,.06)', themeMode);
  const iconColor = themeWiseColor('#8c8c8c', '#8c8c8c', themeMode);

  // Clears stale search text when the modal reopens or the source list
  // changes, so a leftover project query doesn't hide every client (or vice versa).
  useEffect(() => {
    if (open) setSearch('');
  }, [open, mode]);

  const projects = useMemo(() => {
    const list = (projectsData?.body || []).filter(p => p.id);
    const q = search.trim().toLowerCase();
    return q ? list.filter(p => (p.name || '').toLowerCase().includes(q)) : list;
  }, [projectsData, search]);

  const conversationByClientId = useMemo(() => {
    const map = new Map<string, InboxConversation>();
    clientConversations.forEach(c => {
      if (c.clientId) map.set(c.clientId, c);
    });
    return map;
  }, [clientConversations]);

  const clients = useMemo(() => {
    const list = clientsData?.body?.clients || [];
    const q = search.trim().toLowerCase();
    return q
      ? list.filter(
          c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.company_name || '').toLowerCase().includes(q)
        )
      : list;
  }, [clientsData, search]);

  const isLoading = mode === 'project' ? isLoadingProjects : isLoadingClients;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    cursor: 'pointer',
    borderBottom: `1px solid ${border}`,
    borderRadius: 6,
  };

  const nameStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 13,
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t('newChat', { defaultValue: 'New chat' })}
      width={420}
      destroyOnClose
    >
      <Input
        placeholder={
          mode === 'project'
            ? t('searchProjects', { defaultValue: 'Search projects' })
            : t('searchClients', { defaultValue: 'Search clients' })
        }
        prefix={
          <SearchOutlined style={{ color: themeWiseColor('#bfbfbf', '#6b6b6b', themeMode) }} />
        }
        value={search}
        onChange={e => setSearch(e.target.value)}
        allowClear
        autoFocus
        style={{ marginBottom: 12 }}
      />
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {isLoading ? (
          <Flex align="center" justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : mode === 'project' ? (
          projects.length === 0 ? (
            <Flex align="center" justify="center" style={{ padding: 24 }}>
              <Typography.Text type="secondary">
                {t('noProjectsFound', { defaultValue: 'No projects found' })}
              </Typography.Text>
            </Flex>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                onClick={() =>
                  onSelectProject({
                    id: project.id as string,
                    name: project.name,
                    colorCode: (project as any).color_code,
                  })
                }
                style={rowStyle}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flexShrink: 0,
                    background: (project as any).color_code || '#1677ff',
                  }}
                />
                <span style={nameStyle}>{project.name}</span>
                {existingConversationIds.includes(project.id as string) && (
                  <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                    {t('alreadyStarted', { defaultValue: 'Has messages' })}
                  </Typography.Text>
                )}
              </div>
            ))
          )
        ) : clients.length === 0 ? (
          <Flex align="center" justify="center" style={{ padding: 24 }}>
            <Typography.Text type="secondary">
              {t('noClientsFound', { defaultValue: 'No clients found' })}
            </Typography.Text>
          </Flex>
        ) : (
          clients.map(client => {
            const existing = conversationByClientId.get(client.id);
            return (
              <div
                key={client.id}
                onClick={() =>
                  existing
                    ? onSelectClientConversation(existing)
                    : onStartClientChat({ id: client.id, name: client.name })
                }
                style={rowStyle}
                onMouseEnter={e => (e.currentTarget.style.background = hoverBg)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <UserOutlined style={{ flexShrink: 0, color: iconColor }} />
                <span style={nameStyle}>{client.name}</span>
                {existing && (
                  <Typography.Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                    {t('alreadyStarted', { defaultValue: 'Has messages' })}
                  </Typography.Text>
                )}
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
};

export default NewChatModal;
