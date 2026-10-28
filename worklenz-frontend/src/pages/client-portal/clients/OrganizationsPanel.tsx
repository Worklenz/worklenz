import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  MessageOutlined,
  MoreOutlined,
  ProjectOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { Button, Dropdown, Flex, message, theme } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleClientDetailsDrawer } from '@/features/clients-portal/clients/clients-slice';
import {
  useGetPortalOrganizationsQuery,
  useResendPortalInvitationMutation,
} from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { decodeHtmlEntities } from '@/utils/html-entities';
import {
  InvitationLinkModal,
  OrganizationAccessTag,
  PortalAvatar,
  ColumnTitle,
  PortalFieldsButton,
  PortalFilterButton,
  PortalListToolbar,
  PortalPagedTable,
  StatusTag,
  useDebouncedValue,
  usePortalColumnVisibility,
  usePortalPaging,
  usePortalSort,
} from '@/components/client-portal/v2';
import type { PortalField, PortalFilterGroup } from '@/components/client-portal/v2';
import type { ClientOrganization, OrganizationPortalAccess } from '@/types/client-portal/v2';
import { MessageClientModal } from '../discussions/MessageClientModal';
import { clientWorkspacePath } from './workspace/workspace-helpers';

const ACCESS_FILTER_LABELS: Record<OrganizationPortalAccess, string> = {
  active: 'Active',
  invited: 'Invited',
  deactivated: 'Deactivated',
  none: 'No users',
};

/** Client organizations: who they are, how many of their people can sign in, and what they owe us a reply on. */
interface OrganizationsPanelProps {
  /** Rendered first in the toolbar (the page's Clients / Client Users toggle); Filter, Fields and search sit at the right. */
  toolbarLead?: React.ReactNode;
}

export const OrganizationsPanel = ({ toolbarLead }: OrganizationsPanelProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const paging = usePortalPaging();
  const sorting = usePortalSort();
  const [access, setAccess] = useState<OrganizationPortalAccess[]>([]);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const columnVisibility = usePortalColumnVisibility('worklenz.portal.clients.hiddenColumns');

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, access, sorting.sort, sorting.order]);

  const query = useGetPortalOrganizationsQuery({
    page: paging.page,
    limit: paging.limit,
    search: debouncedSearch.trim() || undefined,
    access: access.length ? access.join(',') : undefined,
    sort: sorting.sort,
    order: sorting.order,
  });
  const list = query.data?.body;

  const [createInvitationLink] = useResendPortalInvitationMutation();
  const [shareLink, setShareLink] = useState<{ link: string; email: string } | null>(null);
  const [messageOrganizationId, setMessageOrganizationId] = useState<string | null>(null);

  /** Creates a sign-in link for the primary contact without emailing it, then shows it to copy. */
  const handleCreateLink = async (organization: ClientOrganization) => {
    if (!organization.primary_contact_id) return;
    try {
      const result = await createInvitationLink({
        userId: organization.primary_contact_id,
        delivery: 'link',
      }).unwrap();
      const link = result.body?.link;
      if (!link) throw new Error('No link was returned');
      setShareLink({ link, email: result.body?.email ?? organization.primary_contact_email ?? '' });
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          t('organizations.createLinkFailed', { defaultValue: 'The invitation link could not be created.' })
        )
      );
    }
  };

  const handleTableChange: TableProps<ClientOrganization>['onChange'] = (_pagination, filters, sorter) => {
    sorting.applySorter(sorter);
    setAccess((filters.access ?? []) as OrganizationPortalAccess[]);
  };

  const menuFor =(organization: ClientOrganization): MenuProps['items'] => [
    {
      key: 'open',
      icon: <EyeOutlined />,
      label: t('organizations.menu.open', { defaultValue: 'View details' }),
      onClick: () => navigate(clientWorkspacePath(organization.id)),
    },
    {
      key: 'users',
      ...sorting.columnProps('users'),
      icon: <TeamOutlined />,
      label: t('organizations.menu.users', { defaultValue: 'Manage users & access' }),
      onClick: () => navigate(clientWorkspacePath(organization.id, 'users')),
    },
    {
      key: 'projects',
      ...sorting.columnProps('projects'),
      icon: <ProjectOutlined />,
      label: t('organizations.menu.projects', { defaultValue: 'Manage projects' }),
      onClick: () => navigate(clientWorkspacePath(organization.id, 'projects')),
    },
    {
      key: 'message',
      icon: <MessageOutlined />,
      disabled: organization.active_users === 0,
      label: t('organizations.menu.message', { defaultValue: 'Message client' }),
      onClick: () => setMessageOrganizationId(organization.id),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('organizations.menu.edit', { defaultValue: 'Edit client' }),
      onClick: () => dispatch(toggleClientDetailsDrawer(organization.id)),
    },
    {
      key: 'copyInvite',
      icon: <LinkOutlined />,
      disabled: !organization.primary_contact_id,
      label: t('organizations.menu.copyInvite', { defaultValue: 'Copy invitation link' }),
      onClick: () => handleCreateLink(organization),
    },
  ];

  const columns: ColumnsType<ClientOrganization> = [
    {
      key: 'client',
      ...sorting.columnProps('client'),
      title: (
        <ColumnTitle
          label={t('organizations.columns.client', { defaultValue: 'Client' })}
          help={t('organizations.columnHelp.client', { defaultValue: 'The client organization.' })}
        />
      ),
      render: (_value, organization) => (
        <Flex align="center" gap={10}>
          <PortalAvatar name={decodeHtmlEntities(organization.name)} />
          <span style={{ fontWeight: 600, fontSize: 13 }}>{decodeHtmlEntities(organization.name)}</span>
        </Flex>
      ),
    },
    {
      key: 'contact_name',
      ...sorting.columnProps('contact_name'),
      title: (
        <ColumnTitle
          label={t('organizations.columns.contactName', { defaultValue: 'Primary contact' })}
          help={t('organizations.columnHelp.contactName', { defaultValue: 'The first active portal admin of this client.' })}
        />
      ),
      render: (_value, organization) => (
        <span style={{ fontSize: 12.5 }}>{organization.primary_contact_name ?? '—'}</span>
      ),
    },
    {
      key: 'contact_email',
      ...sorting.columnProps('contact_email'),
      title: (
        <ColumnTitle
          label={t('organizations.columns.contactEmail', { defaultValue: 'Contact email' })}
          help={t('organizations.columnHelp.contactEmail', { defaultValue: 'Email address of the primary contact.' })}
        />
      ),
      render: (_value, organization) => (
        <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>
          {organization.primary_contact_email ?? '—'}
        </span>
      ),
    },
    {
      key: 'access',
      ...sorting.columnProps('access'),
      filters: (['active', 'invited', 'deactivated', 'none'] as const).map(value => ({
        text: t(`organizations.accessFilter.${value}`, { defaultValue: ACCESS_FILTER_LABELS[value] }),
        value,
      })),
      filteredValue: access.length ? access : null,
      title: (
        <ColumnTitle
          label={t('organizations.columns.access', { defaultValue: 'Portal access' })}
          help={t('organizations.columnHelp.access', { defaultValue: 'Active if any user can sign in, otherwise Invited, Deactivated or No users.' })}
        />
      ),
      render: (_value, organization) => <OrganizationAccessTag access={organization.portal_access} />,
    },
    {
      key: 'users',
      title: (
        <ColumnTitle
          label={t('organizations.columns.users', { defaultValue: 'Users' })}
          help={t('organizations.columnHelp.users', { defaultValue: 'Users who have signed in, out of all users for this client.' })}
        />
      ),
      render: (_value, organization) =>
        t('organizations.usersSummary', {
          active: organization.active_users,
          total: organization.total_users,
          defaultValue: '{{active}} active · {{total}} total',
        }),
    },
    {
      key: 'projects',
      title: (
        <ColumnTitle
          label={t('organizations.columns.projects', { defaultValue: 'Portal projects' })}
          help={t('organizations.columnHelp.projects', { defaultValue: 'Projects shared with this client in the portal.' })}
        />
      ),
      render: (_value, organization) => <strong>{organization.portal_projects}</strong>,
    },
    {
      key: 'awaiting',
      ...sorting.columnProps('awaiting'),
      title: (
        <ColumnTitle
          label={t('organizations.columns.awaiting', { defaultValue: 'Awaiting client' })}
          help={t('organizations.columnHelp.awaiting', { defaultValue: 'Approvals and information requests waiting on the client.' })}
        />
      ),
      render: (_value, organization) => {
        const approvals = organization.awaiting_approvals ?? 0;
        const changeRequests = organization.awaiting_change_requests ?? 0;
        // Empty or zero reads as a plain number, like the Users column, not as a dash.
        if (approvals + changeRequests === 0) return <span>0</span>;
        return (
          <Flex vertical gap={2} align="flex-start">
            {approvals > 0 && (
              <StatusTag tone="orange">
                {t('organizations.awaitingApprovals', {
                  count: approvals,
                  defaultValue: '{{count}} approval',
                })}
              </StatusTag>
            )}
            {changeRequests > 0 && (
              <StatusTag tone="orange">
                {t('organizations.awaitingChangeRequests', {
                  count: changeRequests,
                  defaultValue: '{{count}} change request',
                })}
              </StatusTag>
            )}
          </Flex>
        );
      },
    },
    {
      key: 'actions',
      title: t('organizations.columns.actions', { defaultValue: 'Actions' }),
      align: 'right',
      render: (_value, organization) => (
        // The row opens the workspace on click, so the menu must not bubble to it.
        <span onClick={event => event.stopPropagation()}>
          <Dropdown menu={{ items: menuFor(organization) }} trigger={['click']}>
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('organizations.rowActions', {
                name: decodeHtmlEntities(organization.name),
                defaultValue: 'Actions for {{name}}',
              })}
            />
          </Dropdown>
        </span>
      ),
    },
  ];

  const accessOptions = (['active', 'invited', 'deactivated', 'none'] as const).map(value => ({
    value,
    label: t(`organizations.accessFilter.${value}`, { defaultValue: ACCESS_FILTER_LABELS[value] }),
  }));

  const filterGroups: PortalFilterGroup[] = [
    {
      key: 'access',
      label: t('organizations.columns.access', { defaultValue: 'Portal access' }),
      options: accessOptions,
      value: access,
      onChange: value => setAccess(value as OrganizationPortalAccess[]),
    },
  ];

  /** The client name stays visible so a row is never anonymous. */
  const fields: PortalField[] = [
    { key: 'contact_name', label: t('organizations.columns.contactName', { defaultValue: 'Primary contact' }) },
    { key: 'contact_email', label: t('organizations.columns.contactEmail', { defaultValue: 'Contact email' }) },
    { key: 'access', label: t('organizations.columns.access', { defaultValue: 'Portal access' }) },
    { key: 'users', label: t('organizations.columns.users', { defaultValue: 'Users' }) },
    { key: 'projects', label: t('organizations.columns.projects', { defaultValue: 'Portal projects' }) },
    { key: 'awaiting', label: t('organizations.columns.awaiting', { defaultValue: 'Awaiting client' }) },
  ];

  return (
    <div>
      <PortalListToolbar
        lead={toolbarLead}
        controls={
          <>
            <PortalFilterButton groups={filterGroups} onClear={() => setAccess([])} />
            <PortalFieldsButton fields={fields} hidden={columnVisibility.hidden} onToggle={columnVisibility.toggle} />
          </>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('organizations.search', { defaultValue: 'Search by client, contact, email or phone…' })}
        searchLabel={t('organizations.searchLabel', { defaultValue: 'Search client organizations' })}
      />

      <PortalPagedTable<ClientOrganization>
        ariaLabel={t('organizations.tableLabel', { defaultValue: 'Client organizations' })}
        columns={columnVisibility.visibleColumns(columns)}
        onTableChange={handleTableChange}
        rows={list?.items ?? []}
        rowKey={organization => organization.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={organization => navigate(clientWorkspacePath(organization.id))}
        emptyText={
          debouncedSearch.trim() || access.length > 0
            ? t('organizations.emptySearch', { defaultValue: 'No clients match these filters.' })
            : t('organizations.empty', {
                defaultValue: 'No client organizations yet. Use Add Client to create the first one.',
              })
        }
      />

      {messageOrganizationId && (
        <MessageClientModal
          key={messageOrganizationId}
          target={{ organizationId: messageOrganizationId }}
          onClose={() => setMessageOrganizationId(null)}
        />
      )}

      {shareLink && (
        <InvitationLinkModal
          open
          link={shareLink.link}
          email={shareLink.email}
          reason="created"
          onClose={() => setShareLink(null)}
        />
      )}
    </div>
  );
};
