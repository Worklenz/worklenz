import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Drawer, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { LockOutlined } from '@ant-design/icons';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@utils/themeWiseColor';
import { useAuthService } from '@/hooks/useAuth';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import { useResponsive } from '@/hooks/useResponsive';
import { useInboxConversations, InboxConversation } from './hooks/useInboxConversations';
import ConversationList from './components/ConversationList';
import InboxThreadPanel from './components/InboxThreadPanel';
import PinnedMessagesPanel from './components/PinnedMessagesPanel';
import NewChatModal, { NewChatMode } from './components/NewChatModal';
import ClientPortalNewChatModal from '@/ee/components/client-portal/NewChatModal';

export type { InboxCategory, InboxConversation } from './hooks/useInboxConversations';

type InboxTab = 'all' | 'projects' | 'clients';

const HomeInboxView: React.FC = () => {
  const { t } = useTranslation('home-inbox');
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const { isDesktop } = useResponsive();
  // Below desktop this is a master-detail view — the list and thread can't
  // both fit, so only one pane shows at a time (mirrors Slack/Gmail mobile).
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);
  const hasBusinessAccess = hasBusinessFeatureAccess(currentSession);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = String(currentSession?.subscription_type || '').toLowerCase().includes('appsumo');
  const [activeTab, setActiveTab] = useState<InboxTab>('all');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [pinnedPanelOpen, setPinnedPanelOpen] = useState(false);
  const [startChatClient, setStartChatClient] = useState<{ id: string; name: string } | null>(null);

  const border = themeWiseColor('#e8e8e8', '#303030', themeMode);

  // The pinned panel renders as a persistent third column on desktop and a
  // full-screen Drawer on mobile — closing it on breakpoint changes prevents
  // a panel left open on desktop from popping the Drawer open over the list
  // pane after resizing down to mobile width.
  useEffect(() => {
    setPinnedPanelOpen(false);
  }, [isDesktop]);

  const {
    projectConversations,
    clientConversations,
    allClientConversations,
    allConversations,
    projectBadge,
    clientBadge,
    loading,
    search,
    setSearch,
    pinnedIds,
    togglePin,
    selectedId,
    setSelectedId,
    selectConversation,
    openProjectConversation,
    refetchClients,
  } = useInboxConversations();

  // Client chat is a Business-plan feature — keep it out of every list (not
  // just the "Clients" tab) so a gated user can't reach it via "All" either.
  const effectiveClientConversations = hasBusinessAccess ? clientConversations : [];
  const effectiveAllConversations = hasBusinessAccess ? allConversations : projectConversations;
  const effectiveClientBadge = hasBusinessAccess ? clientBadge : 0;
  const isClientsTabLocked = activeTab === 'clients' && !hasBusinessAccess;

  const visibleConversations = useMemo(() => {
    if (activeTab === 'projects') return projectConversations;
    if (activeTab === 'clients') return effectiveClientConversations;
    return effectiveAllConversations;
  }, [activeTab, effectiveAllConversations, projectConversations, effectiveClientConversations]);

  const selected: InboxConversation | null =
    effectiveAllConversations.find(c => c.id === selectedId) ||
    (visibleConversations.length > 0 ? visibleConversations[0] : null);

  const showPinnedPanel = pinnedPanelOpen && selected?.category === 'project';

  // "New chat" browses whichever list matches the active tab; "All" defaults
  // to projects (its prior behavior) since it isn't a client-specific view.
  const newChatMode: NewChatMode = activeTab === 'clients' && hasBusinessAccess ? 'client' : 'project';

  useEffect(() => {
    if (isClientsTabLocked && isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN, { feature: 'client_chat_inbox' });
    }
  }, [isClientsTabLocked, isAppSumoUser, trackAppSumoEvent]);

  const handleClientChatUpgradeClick = () => {
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'client_chat_inbox' });
    }
    dispatch(toggleUpgradeModal());
  };

  const handleNewChatSelectProject = (project: { id: string; name?: string; colorCode?: string }) => {
    setNewChatOpen(false);
    setActiveTab('projects');
    openProjectConversation(project);
    if (!isDesktop) setMobileShowDetail(true);
  };

  const handleSelectClientConversation = (conversation: InboxConversation) => {
    setNewChatOpen(false);
    setActiveTab('clients');
    selectConversation(conversation);
    if (!isDesktop) setMobileShowDetail(true);
  };

  const handleStartClientChat = (client: { id: string; name: string }) => {
    setNewChatOpen(false);
    setStartChatClient(client);
  };

  const handleClientChatCreated = async (chatId: string) => {
    setStartChatClient(null);
    setActiveTab('clients');
    // Wait for the new chat to actually land in the list before selecting it
    // — invalidateTags alone only schedules a refetch, so selecting/showing
    // the detail pane immediately after it can briefly show the wrong (or no)
    // conversation while the fetch is still in flight.
    await refetchClients();
    setSelectedId(chatId);
    if (!isDesktop) setMobileShowDetail(true);
  };

  const tabs: { key: InboxTab; label: string; badge: number }[] = [
    {
      key: 'all',
      label: t('tabs.all', { defaultValue: 'All' }),
      badge: projectBadge + effectiveClientBadge,
    },
    { key: 'projects', label: t('tabs.projects', { defaultValue: 'Projects' }), badge: projectBadge },
    { key: 'clients', label: t('tabs.clients', { defaultValue: 'Clients' }), badge: effectiveClientBadge },
  ];

  const tabBtn = (tab: { key: InboxTab; label: string; badge: number }, isLast: boolean) => {
    const isActive = activeTab === tab.key;
    const isLocked = tab.key === 'clients' && !hasBusinessAccess;
    const button = (
      <button
        key={tab.key}
        onClick={() => {
          setActiveTab(tab.key);
          if (!isDesktop) setMobileShowDetail(false);
        }}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          padding: '5px 12px',
          border: 'none',
          borderRight: isLast ? 'none' : `1px solid ${border}`,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          background: isActive ? '#1677ff' : 'transparent',
          color: isActive ? '#fff' : undefined,
          transition: 'all .15s',
          whiteSpace: 'nowrap',
        }}
      >
        {tab.label}
        {isLocked && <LockOutlined style={{ fontSize: 10 }} />}
        {tab.badge > 0 && (
          <span
            style={{
              background: isActive ? 'rgba(255,255,255,.25)' : '#1677ff',
              color: '#fff',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              lineHeight: '16px',
            }}
          >
            {tab.badge}
          </span>
        )}
      </button>
    );

    return isLocked ? (
      <Tooltip
        key={tab.key}
        title={t('clientsLockedTooltip', { defaultValue: 'Available on the Business plan' })}
      >
        {button}
      </Tooltip>
    ) : (
      button
    );
  };

  return (
    <div
      style={{
        padding: 24,
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <Typography.Title level={3} style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {t('title', { defaultValue: 'Inbox' })}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('subtitle', { defaultValue: 'All messages across teams & projects' })}
        </Typography.Text>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: isDesktop ? 'row' : 'column',
          flex: 1,
          minHeight: 0,
          border: `1px solid ${border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Sidebar — on mobile this pane and the chat panel below are mutually
            exclusive (mobileShowDetail), since a 320px list + thread can't
            both fit a phone width; only one shows at a time. */}
        {(isDesktop || !mobileShowDetail) && (
          <div
            style={{
              width: isDesktop ? 320 : '100%',
              flexShrink: 0,
              borderRight: isDesktop ? `1px solid ${border}` : 'none',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flexShrink: 0,
                margin: '8px 10px',
                display: 'flex',
                width: 'calc(100% - 20px)',
                border: `1px solid ${border}`,
                borderRadius: 7,
                overflow: 'hidden',
              }}
            >
              {tabs.map((tab, i) => tabBtn(tab, i === tabs.length - 1))}
            </div>

            {isClientsTabLocked ? (
              <Flex
                vertical
                align="center"
                justify="center"
                gap={8}
                style={{ flex: 1, padding: 24, textAlign: 'center' }}
              >
                <LockOutlined style={{ fontSize: 20, color: '#bfbfbf' }} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('clientChatLockedBody', {
                    defaultValue:
                      'Chat with your clients directly from the Inbox is available on the Business plan.',
                  })}
                </Typography.Text>
              </Flex>
            ) : (
              <ConversationList
                conversations={visibleConversations}
                selectedId={selected?.id || null}
                pinnedIds={pinnedIds}
                loading={loading}
                search={search}
                showCategoryTag={activeTab === 'all'}
                onSearchChange={setSearch}
                onSelect={conversation => {
                  selectConversation(conversation);
                  if (!isDesktop) setMobileShowDetail(true);
                }}
                onTogglePin={togglePin}
                onNewChat={() => setNewChatOpen(true)}
              />
            )}
          </div>
        )}

        {/* Main chat panel */}
        {(isDesktop || mobileShowDetail) && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
            {isClientsTabLocked ? (
              <Flex
                vertical
                align="center"
                justify="center"
                gap={12}
                style={{ flex: 1, padding: 32, textAlign: 'center' }}
              >
                <LockOutlined style={{ fontSize: 32, color: '#bfbfbf' }} />
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {t('clientChatLockedTitle', { defaultValue: 'Client Chat Locked' })}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ maxWidth: 360 }}>
                  {t('clientChatLockedBody', {
                    defaultValue:
                      'Chat with your clients directly from the Inbox is available on the Business plan.',
                  })}
                </Typography.Text>
                <Button type="primary" onClick={handleClientChatUpgradeClick}>
                  {t('upgradeNow', { defaultValue: 'Upgrade Now' })}
                </Button>
              </Flex>
            ) : (
              <InboxThreadPanel
                selected={selected}
                pinnedPanelOpen={showPinnedPanel}
                onTogglePinnedPanel={() => setPinnedPanelOpen(open => !open)}
                onBack={!isDesktop ? () => setMobileShowDetail(false) : undefined}
              />
            )}
          </div>
        )}

        {/* Pinned messages — a persistent third column on desktop; on mobile
            (no room for a third pane) it becomes a full-screen overlay instead. */}
        {showPinnedPanel && selected && isDesktop && (
          <PinnedMessagesPanel projectId={selected.id} onClose={() => setPinnedPanelOpen(false)} />
        )}
      </div>

      {!isDesktop && (
        <Drawer
          open={showPinnedPanel && !!selected}
          placement="right"
          width="100%"
          closable={false}
          styles={{ body: { padding: 0 } }}
          onClose={() => setPinnedPanelOpen(false)}
        >
          {selected && (
            <PinnedMessagesPanel projectId={selected.id} onClose={() => setPinnedPanelOpen(false)} />
          )}
        </Drawer>
      )}

      <NewChatModal
        open={newChatOpen}
        mode={newChatMode}
        existingConversationIds={projectConversations.map(c => c.id)}
        clientConversations={allClientConversations}
        onSelectProject={handleNewChatSelectProject}
        onSelectClientConversation={handleSelectClientConversation}
        onStartClientChat={handleStartClientChat}
        onClose={() => setNewChatOpen(false)}
      />

      {startChatClient && (
        <ClientPortalNewChatModal
          open={!!startChatClient}
          clientId={startChatClient.id}
          onClose={() => setStartChatClient(null)}
          onSuccess={handleClientChatCreated}
        />
      )}
    </div>
  );
};

export default HomeInboxView;
