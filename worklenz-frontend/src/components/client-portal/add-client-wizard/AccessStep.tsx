import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Descriptions, Empty, Input, Typography, theme } from '@/shared/antd-imports';
import { useGetPortalProjectsQuery } from '@/api/client-portal/portal-projects-api';
import { ClientProjectStatusTag, ROLE_LABEL_COPY, StatusTag, useDebouncedValue } from '@/components/client-portal/v2';
import type { ClientRole } from '@/types/client-portal/v2';
import { getFullName, getOrganizationLabel, type WizardState } from './wizard-state';
import { PortalLoader } from '@/components/client-portal/v2';

interface AccessStepProps {
  state: WizardState;
  role: ClientRole;
  onToggleProject: (projectId: string) => void;
  onSendInvitation: (value: boolean) => void;
}

/** Project access, a summary and the choice to send the invitation now. */
export const AccessStep = ({ state, role, onToggleProject, onSendInvitation }: AccessStepProps) => {
  const { t } = useTranslation('client-portal-v2-add-client');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const isNewOrganization = state.method === 'new_organization';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // A new organization is offered the workspace projects that have no client yet; an existing one, its own.
  const projectsQuery = useGetPortalProjectsQuery({
    organization_id: isNewOrganization ? 'none' : state.organization?.id,
    search: debouncedSearch.trim() || undefined,
    limit: 100,
  });
  const projects = projectsQuery.data?.body?.items ?? [];

  const renderProjects = () => {
    if (projectsQuery.isLoading) return <PortalLoader />;
    if (projectsQuery.isError) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('access.loadFailed', { defaultValue: 'The projects could not be loaded.' })}
          action={
            <Button size="small" onClick={() => projectsQuery.refetch()}>
              {tShared('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }
    if (projects.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            isNewOrganization
              ? t('access.noProjectsNew', {
                  defaultValue: 'Every workspace project already has a client. Link one later from Portal Projects.',
                })
              : t('access.noProjectsExisting', {
                  defaultValue: 'This organization has no projects yet. The user can be assigned projects later.',
                })
          }
        />
      );
    }

    return projects.map(project => (
      <label
        key={project.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 12px',
          marginBottom: 6,
          cursor: 'pointer',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
        }}
      >
        <Checkbox checked={state.projectIds.includes(project.id)} onChange={() => onToggleProject(project.id)} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600 }}>
          {project.name}
          {project.organization_id === null && (
            <span style={{ marginLeft: 8 }}>
              <StatusTag tone="blue">{t('access.noClientYet', { defaultValue: 'No client yet' })}</StatusTag>
            </span>
          )}
          {!project.portal_enabled && (
            <span style={{ marginLeft: 6 }}>
              <StatusTag tone="gray">
                {t('access.portalOff', { defaultValue: 'Portal off, will be switched on' })}
              </StatusTag>
            </span>
          )}
        </span>
        <ClientProjectStatusTag status={project.status} />
      </label>
    ));
  };

  return (
    <div>
      <Typography.Text strong style={{ display: 'block' }}>
        {t('access.title', { defaultValue: 'Project access' })}
      </Typography.Text>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: '2px 0 8px' }}>
        {isNewOrganization
          ? t('access.introNew', {
              defaultValue:
                'Pick the projects this client should see. Projects without a client are linked to the new organization, and the Client Portal is switched on for each one you pick.',
            })
          : t('access.introExisting', {
              defaultValue:
                'Pick the projects this user can open. If the Client Portal is off for a project you pick, it is switched on.',
            })}
      </Typography.Paragraph>
      <Input
        allowClear
        size="small"
        prefix={<SearchOutlined />}
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder={t('access.search', { defaultValue: 'Search projects…' })}
        aria-label={t('access.search', { defaultValue: 'Search projects…' })}
        style={{ marginBottom: 8 }}
      />
      <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 14 }}>{renderProjects()}</div>

      <Descriptions size="small" column={1} bordered style={{ marginBottom: 14 }}>
        <Descriptions.Item label={t('review.organization', { defaultValue: 'Organization' })}>
          {getOrganizationLabel(state) || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('review.name', { defaultValue: 'Name' })}>
          {getFullName(state) || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('review.email', { defaultValue: 'Email' })}>
          {state.email.trim() || '—'}
        </Descriptions.Item>
        <Descriptions.Item label={t('review.role', { defaultValue: 'Role' })}>
          {tShared(ROLE_LABEL_COPY[role].key, { defaultValue: ROLE_LABEL_COPY[role].defaultValue })}
        </Descriptions.Item>
        <Descriptions.Item label={t('review.projects', { defaultValue: 'Projects' })}>
          {state.projectIds.length > 0
            ? t('review.projectsAssigned', {
                count: state.projectIds.length,
                defaultValue: '{{count}} assigned',
              })
            : t('review.projectsNone', { defaultValue: 'None yet' })}
        </Descriptions.Item>
      </Descriptions>

      <label
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: '10px 12px',
          cursor: 'pointer',
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 8,
        }}
      >
        <Checkbox
          checked={state.sendInvitation}
          onChange={event => onSendInvitation(event.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>
            {t('review.sendInvitation', { defaultValue: 'Send the invitation now' })}
          </span>
          <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary }}>
            {t('review.sendInvitationHint', {
              defaultValue:
                'The link carries their email address; opening it sends them a 6-digit code, so there is no password to set. The link expires after 7 days. If it expires, resend it from the Users list, or they can sign in by entering their email.',
            })}
          </span>
        </span>
      </label>
    </div>
  );
};
