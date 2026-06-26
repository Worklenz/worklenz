import {
  Button,
  Flex,
  Typography,
  Card,
  Statistic,
  Spin,
  Row,
  Col,
  Space,
} from '@/shared/antd-imports';
import {
  PlusOutlined,
  UserOutlined,
  TeamOutlined,
  ProjectOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleAddClientDrawer } from '@/features/clients-portal/clients/clients-slice';
import { useGetClientsQuery, ClientPortalClient } from '@/api/client-portal/client-portal-api';
import ClientsTable from './ClientsTable';
import AddClientDrawer from '@/components/client-portal/AddClientDrawer';
import ClientDetailsDrawer from '@/components/client-portal/ClientDetailsDrawer';
import ClientTeamsDrawer from '@/components/client-portal/ClientTeamsDrawer';
import ClientSettingsDrawer from '@/components/client-portal/ClientSettingsDrawer';
import InviteLinkModal from '@/components/client-portal/InviteLinkModal';
import { useResponsive } from '@/hooks/useResponsive';
import { createPortal } from 'react-dom';
import React, { useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  MixpanelEvents,
  ClientPortalEventProps,
  ClientPortalActionEventProps,
} from '@/types/mixpanel-events.types';

const { Title } = Typography;

const ClientPortalClients = () => {
  const { t } = useTranslation('client-portal-clients');
  const dispatch = useAppDispatch();
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { trackMixpanelEvent } = useMixpanelTracking();

  // State for invite modal
  const [showInviteModal, setShowInviteModal] = React.useState(false);

  // RTK Query hook for clients data
  const {
    data: clientsData,
    isLoading,
    error,
  } = useGetClientsQuery({
    page: 1,
    limit: 1000, // Get all clients for stats
  });

  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
  };

  // Calculate statistics - properly access the nested structure
  const totalClients = clientsData?.body?.total || 0;
  // Active clients should be based on portal status, not general client status
  // A client is "active" if they have portal access (has_portal_access === true)
  const activeClients =
    clientsData?.body?.clients?.filter((client: ClientPortalClient) => {
      // Check if client has active portal access
      return client.has_portal_access === true || client.portal_status?.status === 'active';
    }).length || 0;
  const totalProjects =
    clientsData?.body?.clients?.reduce(
      (sum: number, client: ClientPortalClient) => sum + (client.assigned_projects_count || 0),
      0
    ) || 0;
  const totalTeamMembers =
    clientsData?.body?.clients?.reduce(
      (sum: number, client: ClientPortalClient) => sum + (client.team_members?.length || 0),
      0
    ) || 0;

  // Track page visit
  useEffect(() => {
    const pageEventProps: ClientPortalEventProps = {
      page: 'clients',
      section: 'client_portal',
      total_items: totalClients,
      source: 'direct_visit',
    };

    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_PAGE_VISITED, pageEventProps);
  }, [trackMixpanelEvent, totalClients]);

  // Enhanced action handlers with tracking
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
        maxWidth: '100%',
        minHeight: 'calc(100vh - 120px)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isDesktop ? 32 : 24 }}>
        <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Flex align="center" gap={12} style={{ marginBottom: 8 }}>
              <UserOutlined style={{ fontSize: 20 }} />
              <Title
                level={4}
                style={{
                  margin: 0,
                  fontSize: '20px',
                }}
              >
                {t('pageTitle') || 'Clients'}
              </Title>
            </Flex>
            <Typography.Text
              type="secondary"
              style={{
                fontSize: isDesktop ? '16px' : '14px',
                lineHeight: 1.5,
              }}
            >
              {t('pageDescription') || 'Manage your clients and their access to the portal'}
            </Typography.Text>
          </div>
          <Space wrap>
            <Button
              icon={<ShareAltOutlined />}
              onClick={handleShowInviteModalWithTracking}
              size={isMobile ? 'small' : 'middle'}
            >
              {t('inviteButton') || 'Invite'}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddClientWithTracking}
              size={isMobile ? 'small' : 'middle'}
            >
              {t('addClientButton') || 'Add Client'}
            </Button>
          </Space>
        </Flex>
      </div>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: isDesktop ? 32 : 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Statistic
              title={t('totalClientsLabel') || 'Total Clients'}
              value={totalClients}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff', fontSize: isDesktop ? '24px' : '20px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Statistic
              title={t('activeClientsLabel') || 'Active Clients'}
              value={activeClients}
              valueStyle={{ color: '#3f8600', fontSize: isDesktop ? '24px' : '20px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Statistic
              title={t('totalProjectsLabel') || 'Total Projects'}
              value={totalProjects}
              prefix={<ProjectOutlined />}
              valueStyle={{ color: '#722ed1', fontSize: isDesktop ? '24px' : '20px' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              height: '100%',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Statistic
              title={t('totalTeamMembersLabel') || 'Team Members'}
              value={totalTeamMembers}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#eb2f96', fontSize: isDesktop ? '24px' : '20px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Clients Table */}
      <Card
        style={{
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderRadius: 8,
        }}
      >
        <Spin spinning={isLoading}>
          <ClientsTable />
        </Spin>
      </Card>

      {/* Drawers */}
      {createPortal(<AddClientDrawer />, document.body)}
      {createPortal(<ClientDetailsDrawer />, document.body)}
      {createPortal(<ClientTeamsDrawer />, document.body)}
      {createPortal(<ClientSettingsDrawer />, document.body)}

      {/* Invite Link Modal */}
      <InviteLinkModal visible={showInviteModal} onClose={handleCloseInviteModal} />
    </div>
  );
};

export default ClientPortalClients;
