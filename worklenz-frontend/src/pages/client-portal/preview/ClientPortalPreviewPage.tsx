import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { CheckOutlined, LockOutlined, MinusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  ConfigProvider,
  Empty,
  Flex,
  Select,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { useGetProjectAccessQuery } from '@/api/client-portal/portal-projects-api';
import { useGetPreviewQuery, useGetPreviewUsersQuery } from '@/api/client-portal/portal-workflow-api';
import { RoleTag, StatusTag, ROLE_LABEL_COPY } from '@/components/client-portal/v2';
import { CLIENT_PORTAL_BRAND_COLORS, type IClientPortalSettings } from '@/types/settings/client-portal-settings.types';
import type { ClientCapability, ClientRole, PreviewUser } from '@/types/client-portal/v2';
import {
  PreviewApprovals,
  PreviewChangeRequests,
  PreviewDashboard,
  PreviewDiscussions,
  PreviewError,
  PreviewProjects,
} from './PreviewViews';
import { PortalLoader } from '@/components/client-portal/v2';
import { PortalPreviewShell, type PreviewTab } from './PortalPreviewShell';

const CAPABILITY_ROWS: { capability: ClientCapability; key: string; defaultValue: string }[] = [
  { capability: 'view', key: 'capability.view', defaultValue: 'View assigned projects, milestones, client-visible tasks and files' },
  { capability: 'comment', key: 'capability.comment', defaultValue: 'Comment and reply in client-visible discussions' },
  { capability: 'upload', key: 'capability.upload', defaultValue: 'Upload files (where the project allows it)' },
  { capability: 'submit_change_request', key: 'capability.submitChangeRequest', defaultValue: 'Submit and follow change requests' },
  { capability: 'approve', key: 'capability.approve', defaultValue: 'Approve items or request changes' },
  { capability: 'manage_users', key: 'capability.manageUsers', defaultValue: 'Manage users in their own organization' },
];

/** The portal's own look, read from the live Portal Settings so the preview matches what clients get. */
const usePortalBranding = () => {
  const [branding, setBranding] = useState<Pick<IClientPortalSettings, 'portal_title' | 'primary_color' | 'portal_theme' | 'logo_url' | 'organization_logo_url' | 'company_name' | 'show_powered_by'> | null>(null);

  useEffect(() => {
    let cancelled = false;
    profileSettingsApiService
      .getClientPortalSettings()
      .then(response => {
        if (!cancelled && response.done && response.body) setBranding(response.body);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return branding;
};

/**
 * A read-only preview of what one client user sees, built by the same functions the client API uses,
 * so it cannot drift from what the portal enforces. It never impersonates a session and writes nothing.
 */
const ClientPortalPreviewPage = () => {
  const { t } = useTranslation('client-portal-v2-preview');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get('project');
  const branding = usePortalBranding();

  const [contactId, setContactId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [tab, setTab] = useState<PreviewTab>(projectParam ? 'projects' : 'dashboard');
  const [openProjectId, setOpenProjectId] = useState<string | null>(projectParam);

  const usersQuery = useGetPreviewUsersQuery();
  const users: PreviewUser[] = useMemo(() => usersQuery.data?.body ?? [], [usersQuery.data]);

  // Coming from a project: preview as a Client Admin assigned to it (or anyone assigned), not the first user in the list.
  const accessQuery = useGetProjectAccessQuery(projectParam ?? '', { skip: !projectParam });
  const preferredUserId = useMemo(() => {
    const assigned = accessQuery.data?.body?.assigned ?? [];
    const candidates = assigned.filter(user => users.some(candidate => candidate.id === user.id));
    return (candidates.find(user => user.role === 'admin') ?? candidates[0])?.id ?? null;
  }, [accessQuery.data, users]);

  const selectedId =
    contactId ?? (projectParam && accessQuery.isLoading ? null : (preferredUserId ?? users[0]?.id ?? null));

  const previewQuery = useGetPreviewQuery(selectedId ?? '', { skip: !selectedId });
  const preview = previewQuery.data?.body;
  const selectedUser = users.find(user => user.id === selectedId);

  const clients = useMemo(() => {
    const byId = new Map<string, string>();
    users.forEach(user => {
      if (!byId.has(user.organization_id)) byId.set(user.organization_id, user.organization_name);
    });
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [users]);
  const activeClientId = clientId ?? selectedUser?.organization_id ?? null;
  const clientUsers = useMemo(
    () => users.filter(user => user.organization_id === activeClientId),
    [users, activeClientId]
  );

  const brandColor = branding?.primary_color || CLIENT_PORTAL_BRAND_COLORS[0];
  const isDarkPortal = branding?.portal_theme === 'dark';
  const portalTitle = branding?.portal_title || branding?.company_name || t('frame.defaultTitle', { defaultValue: 'Client Portal' });

  const header = (
    <Flex justify="space-between" align="flex-start" gap={12} wrap="wrap" style={{ marginBottom: 16 }}>
      <div>
        <Typography.Title level={4} style={{ margin: 0, fontSize: 22 }}>
          {t('title', { defaultValue: 'Client Portal' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('description', {
            defaultValue: 'A read-only preview of what one client user sees, built from the same visibility rules the portal enforces.',
          })}
        </Typography.Text>
      </div>
    </Flex>
  );

  if (usersQuery.isLoading) return <div>{header}<PortalLoader /></div>;

  if (usersQuery.isError) {
    return (
      <div>
        {header}
        <Alert
          type="error"
          showIcon
          message={t('usersFailed', { defaultValue: 'The client users could not be loaded.' })}
          action={
            <Button size="small" onClick={() => usersQuery.refetch()}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div>
        {header}
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('noUsers', {
            defaultValue: 'No active client users with a project yet. Invite a user and assign a project to preview the portal.',
          })}
        />
      </div>
    );
  }

  const roleLabel = (role: ClientRole) => tShared(ROLE_LABEL_COPY[role].key, { defaultValue: ROLE_LABEL_COPY[role].defaultValue });
  const role = preview?.user.role ?? selectedUser?.role;
  const can = preview?.role?.can;

  const frameBody = () => {
    if (previewQuery.isLoading || !selectedId) return <PortalLoader />;
    if (previewQuery.isError || !preview) return <PreviewError onRetry={() => previewQuery.refetch()} />;

    switch (tab) {
      case 'projects':
        return (
          <PreviewProjects
            projects={preview.projects}
            contactId={selectedId}
            openProjectId={openProjectId}
            onOpenProject={setOpenProjectId}
          />
        );
      case 'discussions':
        return <PreviewDiscussions threads={preview.threads} canComment={can?.comment === true} />;
      case 'approvals':
        return (
          <PreviewApprovals
            approvals={preview.approvals}
            projects={preview.projects}
            role={role}
            canApprove={can?.approve === true}
          />
        );
      case 'change-requests':
        return <PreviewChangeRequests requests={preview.change_requests} projects={preview.projects} />;
      default:
        return (
          <PreviewDashboard
            dashboard={preview.dashboard}
            layout={preview.dashboard_layout}
            canApprove={can?.approve === true}
            firstName={preview.user.name.trim().split(/\s+/)[0] ?? ''}
          />
        );
    }
  };

  const onTabChange = (next: PreviewTab) => {
    setTab(next);
    if (next !== 'projects') setOpenProjectId(null);
  };

  return (
    <div>
      {header}

      <Flex gap={12} align="center" wrap="wrap" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>{t('previewAs', { defaultValue: 'Preview as' })}</span>
        <Select<string>
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 220 }}
          value={activeClientId ?? undefined}
          placeholder={t('selectClient', { defaultValue: 'Select client' })}
          aria-label={t('client', { defaultValue: 'Client' })}
          onChange={value => {
            setClientId(value);
            setContactId(users.find(user => user.organization_id === value)?.id ?? null);
            setOpenProjectId(null);
            setTab('dashboard');
          }}
          options={clients.map(client => ({ value: client.id, label: client.name }))}
        />
        <Select<string>
          showSearch
          optionFilterProp="label"
          style={{ minWidth: 260 }}
          value={selectedId ?? undefined}
          placeholder={t('selectUser', { defaultValue: 'Select client user' })}
          aria-label={t('clientUser', { defaultValue: 'Client user' })}
          onChange={value => {
            setContactId(value);
            setOpenProjectId(null);
            setTab('dashboard');
          }}
          options={clientUsers.map(user => ({
            value: user.id,
            label: t('userOption', {
              name: user.name,
              role: roleLabel(user.role),
              defaultValue: '{{name}} · {{role}}',
            }),
          }))}
        />
        {role && <RoleTag role={role} />}
      </Flex>

      <Flex gap={20} align="flex-start" wrap="wrap">
        <div
          style={{
            flex: '3 1 520px',
            minWidth: 0,
            border: `2px solid ${token.colorBorderSecondary}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {/* The frame uses the portal's own colour and light/dark theme, not the admin app's. */}
          <ConfigProvider
            theme={{
              algorithm: isDarkPortal ? theme.darkAlgorithm : theme.defaultAlgorithm,
              token: { colorPrimary: brandColor },
            }}
          >
            <PortalPreviewShell
              brandColor={brandColor}
              isDark={isDarkPortal}
              title={portalTitle}
              logoUrl={branding?.logo_url || branding?.organization_logo_url || null}
              userName={selectedUser?.name ?? ''}
              showPoweredBy={branding?.show_powered_by !== false}
              activeTab={tab}
              onTabChange={onTabChange}
            >
              {frameBody()}
            </PortalPreviewShell>
          </ConfigProvider>
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 240 }}>
          <Card
            size="small"
            style={{ marginBottom: 16 }}
            title={t('hidden.title', { defaultValue: 'Hidden from this view' })}
            extra={
              <StatusTag tone="gray" icon={<LockOutlined />}>
                {t('hidden.staffOnly', { defaultValue: 'Staff only' })}
              </StatusTag>
            }
          >
            <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
              {t('hidden.description', {
                defaultValue: 'This panel is never shown to the client. They cannot infer these counts from anything in the portal.',
              })}
            </Typography.Paragraph>
            {preview ? (
              <>
                <HiddenRow label={t('hidden.milestones', { defaultValue: 'Internal-only milestones' })} value={preview.hidden.milestones} />
                <HiddenRow label={t('hidden.tasks', { defaultValue: 'Internal-only tasks' })} value={preview.hidden.tasks} />
                <HiddenRow label={t('hidden.files', { defaultValue: 'Internal-only files' })} value={preview.hidden.files} />
                <HiddenRow label={t('hidden.drafts', { defaultValue: 'Draft approvals' })} value={preview.hidden.draft_approvals} />
              </>
            ) : (
              <PortalLoader />
            )}
          </Card>

          <Card
            size="small"
            title={
              role
                ? t('can.title', { role: roleLabel(role), defaultValue: '{{role}} can' })
                : t('can.titleNoRole', { defaultValue: 'This role can' })
            }
          >
            {CAPABILITY_ROWS.map(row => {
              const allowed = can?.[row.capability] === true;
              const manageUsersOff = row.capability === 'manage_users' && allowed && preview?.manage_users_enabled === false;
              return (
                <Flex key={row.capability} gap={8} style={{ fontSize: 12, padding: '4px 0', opacity: allowed ? 1 : 0.5 }}>
                  <span style={{ color: allowed ? token.colorSuccess : undefined }}>
                    {allowed ? <CheckOutlined aria-label={t('can.allowed', { defaultValue: 'Allowed' })} /> : <MinusOutlined aria-label={t('can.notAllowed', { defaultValue: 'Not allowed' })} />}
                  </span>
                  <span>
                    {manageUsersOff
                      ? t('capability.manageUsersOff', { defaultValue: 'Manage organization users (currently off in Settings)' })
                      : t(row.key, { defaultValue: row.defaultValue })}
                  </span>
                </Flex>
              );
            })}
          </Card>
        </div>
      </Flex>
    </div>
  );
};

const HiddenRow = ({ label, value }: { label: string; value: number }) => {
  const { token } = theme.useToken();
  return (
    <Flex justify="space-between" style={{ padding: '5px 0', fontSize: 12.5, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <span style={{ color: token.colorTextSecondary }}>{label}</span>
      <strong>{value}</strong>
    </Flex>
  );
};

export default ClientPortalPreviewPage;
