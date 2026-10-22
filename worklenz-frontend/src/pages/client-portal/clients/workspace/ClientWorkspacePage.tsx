import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EditOutlined, MessageOutlined, MoreOutlined } from '@ant-design/icons';
import { Badge, Button, Col, Dropdown, Flex, Modal, Result, Row, Tabs } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { ClientPortalEventProps, MixpanelEvents } from '@/types/mixpanel-events.types';
import {
  openAddCompanyUserDrawer,
  toggleClientDetailsDrawer,
} from '@/features/clients-portal/clients/clients-slice';
import { useGetOrganizationOverviewQuery } from '@/api/client-portal/portal-access-api';
import { portalPaths } from '../../portal-paths';
import { MessageClientModal } from '../../discussions/MessageClientModal';
import { ActivityTab } from './ActivityTab';
import { ApprovalsTab } from './ApprovalsTab';
import { BillingTab } from './BillingTab';
import { ChangeRequestsTab } from './ChangeRequestsTab';
import { OverviewTab } from './OverviewTab';
import { ProjectsTab } from './ProjectsTab';
import { UsersTab } from './UsersTab';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceRail } from './WorkspaceRail';
import { CLIENTS_PATH, DEFAULT_WORKSPACE_TAB, WorkspaceTab, parseWorkspaceTab } from './workspace-helpers';
import { PortalLoader } from '@/components/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

/**
 * One record for a client organization: who they are, who can sign in, what they are waiting on
 * and their projects, approvals, change requests, invoices and audit trail together. Every way of
 * opening a client lands here.
 */
const ClientWorkspacePage = () => {
  // "Edit client" opens the drawer mounted by the Clients list, which always renders underneath this modal.
  const { t } = useTranslation('client-portal-v2-clients');
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [isMessaging, setIsMessaging] = useState(false);

  const activeTab = parseWorkspaceTab(searchParams.get('tab'));

  const overviewQuery = useGetOrganizationOverviewQuery(id, { skip: !id });
  const overview = overviewQuery.data?.body;
  const organization = overview?.organization;
  const organizationDisplayName = decodeHtmlEntities(organization?.name);

  // Count one view per opened client, once we know it exists.
  const trackedClientId = useRef<string | null>(null);
  useEffect(() => {
    if (!organization || trackedClientId.current === organization.id) return;
    trackedClientId.current = organization.id;

    const props: ClientPortalEventProps = {
      page: 'client_workspace',
      section: 'client_portal',
      source: activeTab,
    };
    trackMixpanelEvent(MixpanelEvents.CLIENT_PORTAL_CLIENT_VIEWED, props);
  }, [organization, activeTab, trackMixpanelEvent]);

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

  const openInviteWizard = () => {
    if (organization) dispatch(openAddCompanyUserDrawer({ id: organization.id, name: organization.name }));
  };

  let body;

  if (overviewQuery.isLoading) {
    body = (
      <div aria-busy="true">
        <PortalLoader />
      </div>
    );
  } else if (overviewQuery.isError || !overview || !organization) {
    const isNotFound = (overviewQuery.error as { status?: number } | undefined)?.status === 404;

    body = (
      <Result
        status={isNotFound ? '404' : 'error'}
        title={
          isNotFound
            ? t('workspace.errors.notFoundTitle', { defaultValue: 'Client not found' })
            : t('workspace.errors.loadTitle', { defaultValue: 'Could not load this client' })
        }
        subTitle={
          isNotFound
            ? t('workspace.errors.notFoundDescription', {
                defaultValue: 'It may have been removed, or the link is wrong.',
              })
            : t('workspace.errors.loadDescription', { defaultValue: 'Please try again.' })
        }
        extra={[
          !isNotFound && (
            <Button key="retry" type="primary" onClick={() => overviewQuery.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          ),
          <Button key="back" type={isNotFound ? 'primary' : 'default'} onClick={() => navigate(CLIENTS_PATH)}>
            {t('workspace.errors.backToClients', { defaultValue: 'Back to clients' })}
          </Button>,
        ]}
      />
    );
  } else {
    const awaitingApprovals = overview.needs_attention.filter(item => item.kind === 'approval_awaiting').length;
    const needsReview = overview.needs_attention.filter(item => item.kind === 'change_request_review').length;

    const tabLabel = (label: string, count: number) =>
      count > 0 ? (
        <span>
          {label} <Badge count={count} size="small" />
        </span>
      ) : (
        label
      );

    const tabItems = [
      {
        key: 'overview',
        label: t('workspace.tabs.overview', { defaultValue: 'Overview' }),
        children: <OverviewTab overview={overview} organizationId={id} onOpenTab={goToTab} />,
      },
      {
        key: 'users',
        label: t('workspace.tabs.users', { defaultValue: 'Users & Access' }),
        children: (
          <UsersTab organizationId={id} organizationName={organizationDisplayName} onInviteUser={openInviteWizard} />
        ),
      },
      {
        key: 'projects',
        label: t('workspace.tabs.projects', { defaultValue: 'Projects' }),
        children: <ProjectsTab organizationId={id} organizationName={organizationDisplayName} />,
      },
      {
        key: 'approvals',
        label: tabLabel(t('workspace.tabs.approvals', { defaultValue: 'Approvals' }), awaitingApprovals),
        children: <ApprovalsTab organizationId={id} organizationName={organizationDisplayName} />,
      },
      {
        key: 'change-requests',
        label: tabLabel(t('workspace.tabs.changeRequests', { defaultValue: 'Change Requests' }), needsReview),
        children: <ChangeRequestsTab organizationId={id} organizationName={organizationDisplayName} />,
      },
      {
        key: 'billing',
        label: t('workspace.tabs.billing', { defaultValue: 'Billing' }),
        children: (
          <BillingTab
            organizationId={id}
            organizationName={organizationDisplayName}
            portalAccess={organization.portal_access}
            onOpenTab={goToTab}
          />
        ),
      },
      {
        key: 'activity',
        label: t('workspace.tabs.activity', { defaultValue: 'Activity' }),
        children: <ActivityTab organizationId={id} organizationName={organizationDisplayName} />,
      },
    ];

    body = (
      <>
        <WorkspaceHeader organization={organization} />

        {/* The rail sits above the content on narrow screens and beside it from the large breakpoint. */}
        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8} xl={6}>
            <WorkspaceRail
              organization={organization}
              onInviteUser={openInviteWizard}
              onRequestApproval={() => navigate(portalPaths.newApproval({ organizationId: id }))}
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
                <Flex align="center" gap={4}>
                  <Button
                    size="small"
                    icon={<MessageOutlined />}
                    disabled={organization.active_users === 0}
                    onClick={() => setIsMessaging(true)}
                  >
                    {t('workspace.header.message', { defaultValue: 'Message' })}
                  </Button>
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'edit',
                          icon: <EditOutlined />,
                          label: t('workspace.header.edit', { defaultValue: 'Edit client' }),
                          onClick: () => dispatch(toggleClientDetailsDrawer(id)),
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <Button
                      type="text"
                      icon={<MoreOutlined />}
                      aria-label={t('workspace.header.actionsLabel', { defaultValue: 'Client actions' })}
                    />
                  </Dropdown>
                </Flex>
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
      {isMessaging && <MessageClientModal target={{ organizationId: id }} onClose={() => setIsMessaging(false)} />}
    </>
  );
};

export default ClientWorkspacePage;
