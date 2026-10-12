import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Col, Dropdown, Modal, Result, Row, Skeleton, Tabs } from '@/shared/antd-imports';
import { EditOutlined, MoreOutlined } from '@ant-design/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { ClientPortalEventProps, MixpanelEvents } from '@/types/mixpanel-events.types';
import {
  openAddCompanyUserDrawer,
  toggleClientDetailsDrawer,
  toggleClientSettingsDrawer,
} from '@/features/clients-portal/clients/clients-slice';
import {
  useGetClientWorkspaceProfileQuery,
  useGetClientWorkspaceStatsQuery,
} from '@/api/client-portal/client-workspace-api';
import ClientDetailsDrawer from '@/components/client-portal/ClientDetailsDrawer';
import ClientSettingsDrawer from '@/components/client-portal/ClientSettingsDrawer';
import { BillingTab } from './BillingTab';
import { MembersTab } from './MembersTab';
import { MessagesTab } from './MessagesTab';
import { OverviewTab } from './OverviewTab';
import { ProjectsTab } from './ProjectsTab';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceRail } from './WorkspaceRail';
import {
  CLIENTS_PATH,
  DEFAULT_WORKSPACE_TAB,
  WorkspaceTab,
  getClientDisplayName,
  parseWorkspaceTab,
} from './workspace-helpers';

/**
 * One record for a client instead of five screens: who they are, how their portal is doing, and
 * their messages, people, projects and invoices together. Every way of opening a client lands here.
 */
const ClientWorkspacePage = () => {
  const { t } = useTranslation('client-portal-client-workspace');
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const activeTab = parseWorkspaceTab(searchParams.get('tab'));

  const profileQuery = useGetClientWorkspaceProfileQuery(id, { skip: !id });
  const statsQuery = useGetClientWorkspaceStatsQuery(id, {
    skip: !id,
    refetchOnMountOrArgChange: true,
  });
  const profile = profileQuery.data?.body;
  const stats = statsQuery.data?.body;
  const clientName = profile ? getClientDisplayName(profile) : '';

  // Count one view per opened client, once we know it exists.
  const trackedClientId = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || trackedClientId.current === profile.id) return;
    trackedClientId.current = profile.id;

    const props: ClientPortalEventProps = {
      page: 'client_workspace',
      section: 'client_portal',
      source: activeTab,
    };
    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_CLIENT_VIEWED, props);
  }, [profile, activeTab, trackMixpanelEvent]);

  const goToTab = (tab: WorkspaceTab) =>
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (tab === DEFAULT_WORKSPACE_TAB) next.delete('tab');
        else next.set('tab', tab);
        return next;
      },
      { replace: true }
    );

  // Back to wherever the client was opened from (a list tab, an invoice, ...), or to the list when
  // this modal was opened directly (a shared link, a fresh tab).
  const goBack = () => {
    if (location.key !== 'default') navigate(-1);
    else navigate(CLIENTS_PATH);
  };

  let body;

  if (profileQuery.isLoading) {
    body = (
      <div aria-busy="true">
        <Skeleton active avatar paragraph={{ rows: 1 }} />
        <Skeleton active paragraph={{ rows: 8 }} style={{ marginTop: 24 }} />
      </div>
    );
  } else if (profileQuery.isError || !profile) {
    const isNotFound = (profileQuery.error as { status?: number } | undefined)?.status === 404;

    body = (
      <Result
        status={isNotFound ? '404' : 'error'}
        title={
          isNotFound
            ? t('errors.notFoundTitle', { defaultValue: 'Client not found' })
            : t('errors.loadTitle', { defaultValue: 'Could not load this client' })
        }
        subTitle={
          isNotFound
            ? t('errors.notFoundDescription', {
                defaultValue: 'It may have been removed, or the link is wrong.',
              })
            : t('errors.loadDescription', { defaultValue: 'Please try again.' })
        }
        extra={[
          !isNotFound && (
            <Button key="retry" type="primary" onClick={() => profileQuery.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          ),
          <Button
            key="back"
            type={isNotFound ? 'primary' : 'default'}
            onClick={() => navigate(CLIENTS_PATH)}
          >
            {t('errors.backToClients', { defaultValue: 'Back to clients' })}
          </Button>,
        ]}
      />
    );
  } else {
    const tabItems = [
      {
        key: 'overview',
        label: t('tabs.overview', { defaultValue: 'Overview' }),
        children: (
          <OverviewTab
            clientId={id}
            clientName={clientName}
            stats={stats}
            isStatsLoading={statsQuery.isLoading}
            isStatsError={statsQuery.isError}
            onRetryStats={() => statsQuery.refetch()}
          />
        ),
      },
      {
        key: 'messages',
        label: t('tabs.messages', { defaultValue: 'Messages' }),
        children: <MessagesTab clientId={id} clientName={clientName} />,
      },
      {
        key: 'members',
        label: t('tabs.members', { defaultValue: 'Company Members' }),
        children: (
          <MembersTab
            clientId={id}
            onAddUser={() => dispatch(openAddCompanyUserDrawer({ id, name: clientName }))}
          />
        ),
      },
      {
        key: 'projects',
        label: t('tabs.projects', { defaultValue: 'Projects' }),
        children: (
          <ProjectsTab
            clientId={id}
            clientName={clientName}
            onAssignProject={() => dispatch(toggleClientSettingsDrawer(id))}
          />
        ),
      },
      {
        key: 'billing',
        label: t('tabs.billing', { defaultValue: 'Billing' }),
        children: (
          <BillingTab
            clientId={id}
            clientName={clientName}
            portalStatus={stats?.portalStatus.status}
            onInvited={() => statsQuery.refetch()}
          />
        ),
      },
    ];

    body = (
      <>
        <WorkspaceHeader profile={profile} stats={stats} isStatsLoading={statsQuery.isLoading} />

        {/* The rail sits above the content on narrow screens and beside it from the large breakpoint. */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8} xl={6}>
            <WorkspaceRail
              profile={profile}
              stats={stats}
              isStatsLoading={statsQuery.isLoading}
              onOpenTab={goToTab}
            />
          </Col>
          <Col xs={24} lg={16} xl={18}>
            <Tabs
              activeKey={activeTab}
              onChange={key => goToTab(key as WorkspaceTab)}
              items={tabItems}
              destroyOnHidden
              tabBarExtraContent={
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'edit',
                        icon: <EditOutlined />,
                        label: t('header.edit', { defaultValue: 'Edit client' }),
                        onClick: () => dispatch(toggleClientDetailsDrawer(id)),
                      },
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    aria-label={t('header.actionsLabel', { defaultValue: 'Client actions' })}
                  />
                </Dropdown>
              }
            />
          </Col>
        </Row>
      </>
    );
  }

  return (
    <>
      <Modal
        open
        onCancel={goBack}
        footer={null}
        width="min(1440px, 96vw)"
        style={{ top: 24 }}
        styles={{
          body: { maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', overflowX: 'hidden' },
        }}
      >
        {body}
      </Modal>

      {createPortal(<ClientDetailsDrawer />, document.body)}
      {createPortal(<ClientSettingsDrawer />, document.body)}
    </>
  );
};

export default ClientWorkspacePage;
