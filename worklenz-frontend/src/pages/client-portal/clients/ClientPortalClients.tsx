import { Badge, Button, Flex, Typography, Space, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { PlusOutlined, ShareAltOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleAddClientDrawer } from '@/features/clients-portal/clients/clients-slice';
import { useGetClientsStatsQuery } from '@/api/client-portal/client-portal-api';
import { useGetCompanyUsersStatsQuery } from '@/api/client-portal/company-users-api';
import ClientsTable from './ClientsTable';
import { ClientsStats } from './ClientsStats';
import { CompanyUsersTab } from './company-users/CompanyUsersTab';
import { clientWorkspacePath } from './workspace/workspace-helpers';
import ClientDetailsDrawer from '@/components/client-portal/ClientDetailsDrawer';
import InviteLinkModal from '@/components/client-portal/InviteLinkModal';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '@/types/mixpanel-events.types';

const { Title } = Typography;

type ClientsView = 'company' | 'users';

const ClientPortalClients = () => {
  const { t } = useTranslation('client-portal-clients');
  const { t: tUsers } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [showInviteModal, setShowInviteModal] = useState(false);

  // The view lives in the URL so coming back from a client keeps the tab that was open.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView: ClientsView = searchParams.get('view') === 'users' ? 'users' : 'company';
  const { data: usersStats } = useGetCompanyUsersStatsQuery();

  const handleViewChange = (key: string) => {
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        if (key === 'users') next.set('view', 'users');
        else next.delete('view');
        return next;
      },
      { replace: true }
    );
  };

  // Shares its cache entry with the stat cards, so this does not add a request.
  const { data: statsData, isLoading: isStatsLoading } = useGetClientsStatsQuery();
  const hasTrackedVisit = useRef(false);

  // Track the page visit once, as soon as the total is known (or the stats request has failed).
  useEffect(() => {
    if (isStatsLoading || hasTrackedVisit.current) return;
    hasTrackedVisit.current = true;

    const pageEventProps: ClientPortalEventProps = {
      page: 'clients',
      section: 'client_portal',
      total_items: statsData?.body?.total ?? 0,
      source: 'direct_visit',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_PAGE_VISITED, pageEventProps);
  }, [isStatsLoading, statsData, trackMixpanelEvent]);

  const handleAddClientWithTracking = () => {
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

  const handleShowInviteModalWithTracking = () => {
    const actionProps: ClientPortalActionEventProps = {
      action_type: 'view',
      item_type: 'client',
      page: 'clients',
      section: 'client_portal',
      source: 'invite_button',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_CLIENT_LINK_COPIED, actionProps);
    setShowInviteModal(true);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        maxWidth: '100%',
      }}
    >
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('pageTitle', { defaultValue: 'Clients' })}
        </Title>
        <Typography.Text type="secondary">
          {t('pageDescription', {
            defaultValue: 'Manage your clients and their access to the portal',
          })}
        </Typography.Text>
      </div>

      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap={16}
        style={{ marginBottom: 16, flexShrink: 0 }}
      >
        <PillToggle<ClientsView>
          value={activeView}
          onChange={handleViewChange}
          ariaLabel={t('viewToggleLabel', { defaultValue: 'Clients view' })}
          options={[
            { value: 'company', label: t('companyTab', { defaultValue: 'Clients' }) },
            {
              value: 'users',
              label: (
                <Flex align="center" gap={8}>
                  <span>{t('companyUsersTab', { defaultValue: 'Client Users' })}</span>
                  <Badge
                    count={usersStats?.body?.total ?? 0}
                    showZero
                    overflowCount={999}
                    style={{
                      backgroundColor:
                        activeView === 'users' ? token.colorBgContainer : token.colorPrimary,
                      color:
                        activeView === 'users' ? token.colorPrimary : token.colorTextLightSolid,
                      boxShadow: 'none',
                    }}
                    aria-label={tUsers('tabCountLabel', { defaultValue: 'Total client users' })}
                  />
                </Flex>
              ),
            },
          ]}
        />

        <Space wrap>
          <Button
            icon={<ShareAltOutlined />}
            onClick={handleShowInviteModalWithTracking}
            size="small"
          >
            {t('inviteButton', { defaultValue: 'Send Invitation' })}
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddClientWithTracking}
            size="small"
          >
            {t('addClientButton', { defaultValue: 'Add new' })}
          </Button>
        </Space>
      </Flex>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {activeView === 'company' ? (
          <>
            <div style={{ flexShrink: 0 }}>
              <ClientsStats />
            </div>
            <ClientsTable />
          </>
        ) : (
          <CompanyUsersTab
            onAdd={handleAddClientWithTracking}
            onOpenCompany={clientId => navigate(clientWorkspacePath(clientId))}
          />
        )}
      </div>

      {/* Edit Client opens this modal. Everything else about a client lives in its workspace. */}
      {createPortal(<ClientDetailsDrawer />, document.body)}

      <InviteLinkModal visible={showInviteModal} onClose={() => setShowInviteModal(false)} />

      {/* clients/:id renders here as a modal over this list, so a direct or shared link
          still shows the list underneath it instead of a blank page. */}
      <Outlet />
    </div>
  );
};

export default ClientPortalClients;
