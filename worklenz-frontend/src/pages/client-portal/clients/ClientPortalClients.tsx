import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { PlusOutlined } from '@ant-design/icons';
import { Badge, Button, Col, Flex, Row, Typography, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { toggleAddClientDrawer } from '@/features/clients-portal/clients/clients-slice';
import {
  useGetPortalClientUsersQuery,
  useGetPortalOrganizationsQuery,
} from '@/api/client-portal/portal-access-api';
import ClientDetailsDrawer from '@/components/client-portal/ClientDetailsDrawer';
import { StatCard } from '@/components/client-portal/v2';
import { useIsAdminSurfaceReadOnly } from '@/hooks/useIsAdminSurfaceReadOnly';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '@/types/mixpanel-events.types';
import { OrganizationsPanel } from './OrganizationsPanel';
import { ClientUsersPanel } from './users/ClientUsersPanel';
import { clientWorkspacePath } from './workspace/workspace-helpers';

/** Matches the Input, Select and Button heights set in config/theme.config.ts. */
const CONTROL_HEIGHT = 36;

type ClientsView = 'organizations' | 'users';

const ClientPortalClients = () => {
  const { t } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const isReadOnly = useIsAdminSurfaceReadOnly();

  // The view lives in the URL so coming back from a client keeps the tab that was open.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView: ClientsView = searchParams.get('view') === 'users' ? 'users' : 'organizations';

  const handleViewChange = (view: ClientsView) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (view === 'users') next.set('view', 'users');
        else next.delete('view');
        return next;
      },
      { replace: true }
    );
  };

  // One-row queries for the stat cards and tab counts; each result carries the whole-workspace totals.
  const statsQuery = useGetPortalOrganizationsQuery({ page: 1, limit: 1 });
  const usersCountQuery = useGetPortalClientUsersQuery({ page: 1, limit: 1 });
  const stats = statsQuery.data?.body?.stats;
  const hasTrackedVisit = useRef(false);

  // Track the page visit once, as soon as the totals are known (or the request has failed).
  useEffect(() => {
    if (statsQuery.isLoading || hasTrackedVisit.current) return;
    hasTrackedVisit.current = true;

    const pageEventProps: ClientPortalEventProps = {
      page: 'clients',
      section: 'client_portal',
      total_items: stats?.organizations ?? 0,
      source: 'direct_visit',
    };
    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_PAGE_VISITED, pageEventProps);
  }, [statsQuery.isLoading, stats, trackMixpanelEvent]);

  const handleAddClient = () => {
    const actionProps: ClientPortalActionEventProps = {
      action_type: 'create',
      item_type: 'client',
      page: 'clients',
      section: 'client_portal',
      source: 'add_client_button',
    };
    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_CLIENT_CREATED, actionProps);
    dispatch(toggleAddClientDrawer());
  };

  const countBadge = (count: number, active: boolean) => (
    <Badge
      count={count}
      showZero
      overflowCount={999}
      style={{
        backgroundColor: active ? token.colorBgContainer : token.colorPrimary,
        color: active ? token.colorPrimary : token.colorTextLightSolid,
        boxShadow: 'none',
      }}
    />
  );

  const viewToggle = (
    <PillToggle<ClientsView>
      value={activeView}
      onChange={handleViewChange}
      // Same height as the search input and filters beside it (the theme sets Input/Select/Button to 36).
      style={{ height: CONTROL_HEIGHT, boxSizing: 'border-box' }}
      ariaLabel={t('page.viewToggle', { defaultValue: 'Clients view' })}
      options={[
        {
          value: 'organizations',
          label: (
            <Flex align="center" gap={8}>
              <span>{t('page.organizationsTab', { defaultValue: 'Clients' })}</span>
              {countBadge(stats?.organizations ?? 0, activeView === 'organizations')}
            </Flex>
          ),
        },
        {
          value: 'users',
          label: (
            <Flex align="center" gap={8}>
              <span>{t('page.usersTab', { defaultValue: 'Client Users' })}</span>
              {countBadge(usersCountQuery.data?.body?.total ?? 0, activeView === 'users')}
            </Flex>
          ),
        },
      ]}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, maxWidth: '100%' }}>
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('page.title', { defaultValue: 'Clients' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('page.description', {
            defaultValue:
              'Client organizations, the people who can sign in to their portal, and what each of them is waiting on.',
          })}
        </Typography.Text>
      </div>

      <Flex align="center" wrap="wrap" gap={16} style={{ marginBottom: 16, flexShrink: 0 }}>
        {!isReadOnly && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddClient} style={{ fontSize: 12, fontWeight: 500 }}>
            {t('page.addClient', { defaultValue: 'Add New' })}
          </Button>
        )}

      </Flex>

      <Row gutter={[12, 12]} style={{ marginBottom: 16, flexShrink: 0 }}>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('stats.organizations', { defaultValue: 'Client organizations' })}
            value={stats?.organizations ?? '—'}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('stats.activeUsers', { defaultValue: 'Active users' })}
            value={stats?.active_users ?? '—'}
            tone="success"
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('stats.invited', { defaultValue: 'Invited' })}
            value={stats?.invited_users ?? '—'}
            tone="warning"
            sub={t('stats.expired', { count: stats?.expired_invites ?? 0, defaultValue: '{{count}} expired' })}
          />
        </Col>
        <Col xs={12} lg={6}>
          <StatCard
            label={t('stats.awaiting', { defaultValue: 'Awaiting client action' })}
            value={stats?.awaiting_client_action ?? '—'}
            tone="warning"
            sub={t('stats.awaitingSub', { defaultValue: 'Approvals and info requests' })}
          />
        </Col>
      </Row>

      <div style={{ flex: 1, minHeight: 0 }}>
        {activeView === 'organizations' ? (
          <OrganizationsPanel toolbarLead={viewToggle} />
        ) : (
          <ClientUsersPanel toolbarLead={viewToggle} onOpenOrganization={organizationId => navigate(clientWorkspacePath(organizationId))} />
        )}
      </div>

      {/* Edit client opens this drawer. Everything else about a client lives in its workspace. */}
      {createPortal(<ClientDetailsDrawer />, document.body)}

      {/* clients/:id renders here as a modal over this list, so a direct or shared link
          still shows the list underneath it instead of a blank page. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalClients;
