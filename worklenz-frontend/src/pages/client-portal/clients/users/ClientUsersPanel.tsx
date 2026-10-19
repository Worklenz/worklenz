import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  GroupOutlined,
  LinkOutlined,
  MailOutlined,
  MessageOutlined,
  MoreOutlined,
  ProjectOutlined,
  StopOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TableProps } from 'antd/es/table';
import { Button, Dropdown, Flex, Typography, theme } from '@/shared/antd-imports';
import type { MenuProps } from '@/shared/antd-imports';
import { useGetPortalClientUsersQuery, useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import {
  PORTAL_TOOLBAR_BUTTON_STYLE,
  PortalAvatar,
  ColumnTitle,
  PortalFieldsButton,
  PortalFilterButton,
  PortalListToolbar,
  PortalPagedTable,
  ROLE_LABEL_COPY,
  RoleTag,
  UserStatusTag,
  formatRelativeTime,
  useDebouncedValue,
  usePortalColumnVisibility,
  usePortalPaging,
  usePortalSort,
} from '@/components/client-portal/v2';
import type { PortalField, PortalFilterGroup } from '@/components/client-portal/v2';
import { CLIENT_ROLES, type ClientRole, type ClientUser, type ClientUserStatus } from '@/types/client-portal/v2';
import { useClientUserActions } from './useClientUserActions';

type StatusFilter = ClientUserStatus | 'invite_expired';

const GROUP_BY_CLIENT_KEY = 'worklenz.portal.clientUsers.groupByClient';

/** Grouping is on unless the user switched it off before. Storage can be blocked, so fall back to on. */
const readGroupByClient = (): boolean => {
  try {
    return localStorage.getItem(GROUP_BY_CLIENT_KEY) !== 'off';
  } catch {
    return true;
  }
};

interface ClickableNameProps {
  children: React.ReactNode;
  /** Without a handler the name is plain text. */
  onClick?: () => void;
}

/** A bold name that opens something on click: pointer cursor only, no link colour or underline on hover. */
const ClickableName = ({ children, onClick }: ClickableNameProps) => {
  if (!onClick) return <span style={{ fontWeight: 600, fontSize: 13, minWidth: 0 }}>{children}</span>;
  return (
    <span
      role="button"
      tabIndex={0}
      style={{ fontWeight: 600, fontSize: 13, minWidth: 0, cursor: 'pointer' }}
      onClick={event => {
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </span>
  );
};

interface ClientUsersPanelProps {
  /** Limits the list to one organization (the workspace's Users & Access tab) and hides that column. */
  organizationId?: string;
  onOpenOrganization?: (organizationId: string) => void;
  /** Reports the total so the tab above the list can show a count. */
  onTotalChange?: (total: number) => void;
  /** Rendered first in the toolbar (the page's Clients / Client Users toggle); the search then sits at the right. */
  toolbarLead?: React.ReactNode;
}

export const ClientUsersPanel = ({ organizationId, onOpenOrganization, onTotalChange, toolbarLead }: ClientUsersPanelProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();
  const paging = usePortalPaging();
  const sorting = usePortalSort();
  const { actions, modals } = useClientUserActions();

  const [search, setSearch] = React.useState('');
  const [roles, setRoles] = React.useState<ClientRole[]>([]);
  const [statuses, setStatuses] = React.useState<StatusFilter[]>([]);
  const [organizationIds, setOrganizationIds] = React.useState<string[]>([]);
  const [groupByClient, setGroupByClient] = React.useState(readGroupByClient);
  const debouncedSearch = useDebouncedValue(search);
  // Rows come back ordered by client unless the user picks another sort; then groups would scatter, so pause them.
  const isGrouped =
    groupByClient && !organizationId && (!sorting.sort || sorting.sort === 'organization') && sorting.order !== 'desc';
  const toggleGroupByClient = () => {
    const next = !groupByClient;
    setGroupByClient(next);
    try {
      localStorage.setItem(GROUP_BY_CLIENT_KEY, next ? 'on' : 'off');
    } catch {
      // Storage unavailable: the choice just lasts for this visit.
    }
  };
  const columnVisibility = usePortalColumnVisibility(
    organizationId ? 'worklenz.portal.clientUsers.workspace.hiddenColumns' : 'worklenz.portal.clientUsers.hiddenColumns'
  );
  // The client filter only exists on the all-clients list; a workspace is already one client.
  const organizations = useGetPortalOrganizationsQuery({ limit: 100 }, { skip: Boolean(organizationId) });

  // Any filter change starts again from page 1.
  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, roles, statuses, organizationIds, organizationId, sorting.sort, sorting.order]);

  const query = useGetPortalClientUsersQuery({
    page: paging.page,
    limit: paging.limit,
    search: debouncedSearch.trim() || undefined,
    role: roles.length ? roles.join(',') : undefined,
    status: statuses.length ? statuses.join(',') : undefined,
    organization_id: organizationId ?? (organizationIds.length ? organizationIds.join(',') : undefined),
    sort: sorting.sort,
    order: sorting.order,
  });
  const list = query.data?.body;

  useEffect(() => {
    if (list) onTotalChange?.(list.total);
  }, [list, onTotalChange]);

  /**
   * A person who deleted their own account can only be looked at, restored (inside the 30-day window) or removed.
   * Reactivate would not bring the account back, so it is not offered.
   */
  const deletedAccountMenu = (user: ClientUser): MenuProps['items'] => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: t('menu.view', { defaultValue: 'View profile' }),
      onClick: () => actions.onView(user),
    },
    ...(user.restorable_until
      ? [
          {
            key: 'restoreAccount',
            icon: <UndoOutlined />,
            label: t('menu.restoreAccount', { defaultValue: 'Restore account' }),
            onClick: () => actions.onRestoreAccount(user),
          },
        ]
      : []),
    { type: 'divider' as const },
    {
      key: 'remove',
      danger: true,
      icon: <DeleteOutlined />,
      label: t('menu.remove', { defaultValue: 'Remove user' }),
      onClick: () => actions.onRemove(user),
    },
  ];

  const menuFor = (user: ClientUser): MenuProps['items'] =>
    user.status === 'deleted'
      ? deletedAccountMenu(user)
      : [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: t('menu.view', { defaultValue: 'View profile' }),
      onClick: () => actions.onView(user),
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('menu.edit', { defaultValue: 'Edit user & role' }),
      onClick: () => actions.onEdit(user),
    },
    ...(user.status === 'active'
      ? [
          {
            key: 'message',
            icon: <MessageOutlined />,
            label: t('menu.message', { defaultValue: 'Message' }),
            onClick: () => actions.onMessage(user),
          },
        ]
      : []),
    {
      key: 'assign',
      icon: <ProjectOutlined />,
      label: t('menu.assign', { defaultValue: 'Assign projects' }),
      onClick: () => actions.onAssign(user),
    },
    ...(user.status === 'invited'
      ? [
          {
            key: 'resend',
            icon: <MailOutlined />,
            label: t('menu.resend', { defaultValue: 'Resend invitation' }),
            onClick: () => actions.onResend(user),
          },
        ]
      : []),
    ...(user.status !== 'deactivated'
      ? [
          {
            key: 'createLink',
            icon: <LinkOutlined />,
            label: t('menu.createLink', { defaultValue: 'Create sign-in link' }),
            onClick: () => actions.onCreateLink(user),
          },
        ]
      : []),
    { type: 'divider' as const },
    user.status === 'deactivated'
      ? {
          key: 'reactivate',
          icon: <CheckCircleOutlined />,
          label: t('menu.reactivate', { defaultValue: 'Reactivate user' }),
          onClick: () => actions.onReactivate(user),
        }
      : {
          key: 'deactivate',
          icon: <StopOutlined />,
          label: t('menu.deactivate', { defaultValue: 'Deactivate user' }),
          onClick: () => actions.onDeactivate(user),
        },
    {
      key: 'remove',
      danger: true,
      icon: <DeleteOutlined />,
      label: t('menu.remove', { defaultValue: 'Remove user' }),
      onClick: () => actions.onRemove(user),
    },
  ];

  const columns: ColumnsType<ClientUser> = [
    ...(organizationId
      ? []
      : [
          {
            key: 'organization',
            ...sorting.columnProps('organization'),
            title: (
              <ColumnTitle
                label={t('users.columns.organization', { defaultValue: 'Client' })}
                help={t('users.columnHelp.organization', { defaultValue: 'The client this user belongs to.' })}
              />
            ),
            // Same avatar + bold name as the Clients table, so a client looks the same in both lists.
            render: (_value: unknown, user: ClientUser) => (
              <Flex align="center" gap={10}>
                <PortalAvatar name={user.organization_name} />
                <ClickableName onClick={onOpenOrganization ? () => onOpenOrganization(user.organization_id) : undefined}>
                  {user.organization_name}
                </ClickableName>
              </Flex>
            ),
          },
        ]),
    {
      key: 'name',
      ...sorting.columnProps('name'),
      title: (
        <ColumnTitle
          label={t('users.columns.name', { defaultValue: 'Name' })}
          help={t('users.columnHelp.name', { defaultValue: 'The client user’s full name.' })}
        />
      ),
      render: (_value, user) => (
        <Flex
          align="center"
          gap={10}
          style={{ opacity: user.status === 'deactivated' || user.status === 'deleted' ? 0.6 : 1 }}
        >
          <PortalAvatar name={user.name} />
          <ClickableName onClick={() => actions.onView(user)}>{user.name}</ClickableName>
        </Flex>
      ),
    },
    {
      key: 'email',
      ...sorting.columnProps('email'),
      title: (
        <ColumnTitle
          label={t('users.columns.email', { defaultValue: 'Email' })}
          help={t('users.columnHelp.email', { defaultValue: 'The address this user signs in with.' })}
        />
      ),
      render: (_value, user) => (
        <span style={{ fontSize: 12.5, color: token.colorTextSecondary }}>{user.email}</span>
      ),
    },
    {
      key: 'job_title',
      ...sorting.columnProps('job_title'),
      title: (
        <ColumnTitle
          label={t('users.columns.jobTitle', { defaultValue: 'Job title' })}
          help={t('users.columnHelp.jobTitle', { defaultValue: 'Their role within the client’s company.' })}
        />
      ),
      render: (_value, user) => <span style={{ fontSize: 12.5 }}>{user.job_title || '—'}</span>,
    },
    {
      key: 'phone',
      ...sorting.columnProps('phone'),
      title: (
        <ColumnTitle
          label={t('users.columns.phone', { defaultValue: 'Phone number' })}
          help={t('users.columnHelp.phone', { defaultValue: 'Contact phone number, if provided.' })}
        />
      ),
      render: (_value, user) => <span style={{ fontSize: 12.5 }}>{user.phone || '—'}</span>,
    },
    {
      key: 'role',
      ...sorting.columnProps('role'),
      filters: CLIENT_ROLES.map(value => ({
        text: tShared(ROLE_LABEL_COPY[value].key, { defaultValue: ROLE_LABEL_COPY[value].defaultValue }),
        value,
      })),
      filteredValue: roles.length ? roles : null,
      title: (
        <ColumnTitle
          label={t('users.columns.role', { defaultValue: 'Role' })}
          help={t('users.columnHelp.role', { defaultValue: 'What the user can do in the portal: Admin, Member or Viewer.' })}
        />
      ),
      render: (_value, user) => <RoleTag role={user.role} />,
    },
    {
      key: 'status',
      ...sorting.columnProps('status'),
      filters: [
        { text: tShared('userActive', { defaultValue: 'Active' }), value: 'active' },
        { text: tShared('userInvited', { defaultValue: 'Invited' }), value: 'invited' },
        { text: tShared('userInviteExpired', { defaultValue: 'Invite expired' }), value: 'invite_expired' },
        { text: tShared('userDeactivated', { defaultValue: 'Deactivated' }), value: 'deactivated' },
        { text: tShared('userDeleted', { defaultValue: 'Account deleted' }), value: 'deleted' },
      ],
      filteredValue: statuses.length ? statuses : null,
      title: (
        <ColumnTitle
          label={t('users.columns.status', { defaultValue: 'Status' })}
          help={t('users.columnHelp.status', { defaultValue: 'Whether the user has signed in, is invited, or is deactivated.' })}
        />
      ),
      render: (_value, user) => {
        const invitedAgo = user.status === 'invited' ? formatRelativeTime(user.invited_at, i18n.language) : null;
        return (
          <div>
            <UserStatusTag user={user} />
            {invitedAgo && (
              <div style={{ fontSize: 11, color: token.colorTextTertiary, marginTop: 3 }}>
                {t('users.invitedAgo', { when: invitedAgo, defaultValue: 'Invited {{when}}' })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'projects',
      ...sorting.columnProps('projects'),
      title: (
        <ColumnTitle
          label={t('users.columns.projects', { defaultValue: 'Projects' })}
          help={t('users.columnHelp.projects', { defaultValue: 'Number of portal projects this user can open.' })}
        />
      ),
      render: (_value, user) =>
        user.projects.length > 0 ? (
          <span title={user.projects.map(project => project.name).join('\n')}>
            {t('users.projectCount', { count: user.projects.length, defaultValue: '{{count}} projects' })}
          </span>
        ) : (
          <Typography.Text type="secondary">
            {t('users.noProjects', { defaultValue: 'None assigned' })}
          </Typography.Text>
        ),
    },
    {
      key: 'last_access',
      ...sorting.columnProps('last_access'),
      title: (
        <ColumnTitle
          label={t('users.columns.lastAccess', { defaultValue: 'Last access' })}
          help={t('users.columnHelp.lastAccess', { defaultValue: 'When the user last signed in to the portal.' })}
        />
      ),
      render: (_value, user) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatRelativeTime(user.last_access_at, i18n.language) ??
            t('users.neverAccessed', { defaultValue: 'Never' })}
        </Typography.Text>
      ),
    },
    {
      key: 'actions',
      title: t('users.columns.actions', { defaultValue: 'Actions' }),
      align: 'right',
      render: (_value, user) => (
        <Flex gap={6} justify="flex-end" align="center">
          {user.status === 'invited' && (
            <Button size="small" onClick={() => actions.onResend(user)}>
              {t('menu.resendShort', { defaultValue: 'Resend' })}
            </Button>
          )}
          <Dropdown menu={{ items: menuFor(user) }} trigger={['click']}>
            <Button
              size="small"
              type="text"
              icon={<MoreOutlined />}
              aria-label={t('users.rowActions', { name: user.name, defaultValue: 'Actions for {{name}}' })}
            />
          </Dropdown>
        </Flex>
      ),
    },
  ];

  const handleTableChange: TableProps<ClientUser>['onChange'] = (_pagination, filters, sorter) => {
    sorting.applySorter(sorter);
    setRoles((filters.role ?? []) as ClientRole[]);
    setStatuses((filters.status ?? []) as StatusFilter[]);
  };

  const hasFilters =
    debouncedSearch.trim() !== '' || roles.length > 0 || statuses.length > 0 || organizationIds.length > 0;

  const roleOptions = CLIENT_ROLES.map(value => ({
    value,
    label: tShared(ROLE_LABEL_COPY[value].key, { defaultValue: ROLE_LABEL_COPY[value].defaultValue }),
  }));
  const statusOptions = [
    { value: 'active', label: tShared('userActive', { defaultValue: 'Active' }) },
    { value: 'invited', label: tShared('userInvited', { defaultValue: 'Invited' }) },
    { value: 'invite_expired', label: tShared('userInviteExpired', { defaultValue: 'Invite expired' }) },
    { value: 'deactivated', label: tShared('userDeactivated', { defaultValue: 'Deactivated' }) },
    { value: 'deleted', label: tShared('userDeleted', { defaultValue: 'Account deleted' }) },
  ];
  const clientOptions = (organizations.data?.body?.items ?? []).map(item => ({ value: item.id, label: item.name }));

  const filterGroups: PortalFilterGroup[] = [
    {
      key: 'role',
      label: t('users.columns.role', { defaultValue: 'Role' }),
      options: roleOptions,
      value: roles,
      onChange: value => setRoles(value as ClientRole[]),
    },
    {
      key: 'status',
      label: t('users.columns.status', { defaultValue: 'Status' }),
      options: statusOptions,
      value: statuses,
      onChange: value => setStatuses(value as StatusFilter[]),
    },
    ...(organizationId
      ? []
      : [
          {
            key: 'client',
            label: t('users.columns.organization', { defaultValue: 'Client' }),
            options: clientOptions,
            value: organizationIds,
            onChange: setOrganizationIds,
            searchPlaceholder: t('users.searchClients', { defaultValue: 'Search clients…' }),
          },
        ]),
  ];

  const clearFilters = () => {
    setRoles([]);
    setStatuses([]);
    setOrganizationIds([]);
  };

  /** The name column stays visible so a row is never anonymous. */
  const fields: PortalField[] = [
    ...(organizationId
      ? []
      : [{ key: 'organization', label: t('users.columns.organization', { defaultValue: 'Client' }) }]),
    { key: 'email', label: t('users.columns.email', { defaultValue: 'Email' }) },
    { key: 'job_title', label: t('users.columns.jobTitle', { defaultValue: 'Job title' }) },
    { key: 'phone', label: t('users.columns.phone', { defaultValue: 'Phone number' }) },
    { key: 'role', label: t('users.columns.role', { defaultValue: 'Role' }) },
    { key: 'status', label: t('users.columns.status', { defaultValue: 'Status' }) },
    { key: 'projects', label: t('users.columns.projects', { defaultValue: 'Projects' }) },
    { key: 'last_access', label: t('users.columns.lastAccess', { defaultValue: 'Last access' }) },
  ];

  return (
    <div>
      <PortalListToolbar
        lead={toolbarLead}
        controls={
          <>
            <PortalFilterButton groups={filterGroups} onClear={clearFilters} />
            {!organizationId && (
              <Button
                style={PORTAL_TOOLBAR_BUTTON_STYLE}
                type={groupByClient ? 'primary' : 'default'}
                ghost={groupByClient}
                icon={<GroupOutlined />}
                aria-pressed={groupByClient}
                aria-label={t('users.groupBy.label', { defaultValue: 'Group client users' })}
                onClick={toggleGroupByClient}
              >
                {t('users.groupBy.client', { defaultValue: 'Group' })}
              </Button>
            )}
            <PortalFieldsButton fields={fields} hidden={columnVisibility.hidden} onToggle={columnVisibility.toggle} />
          </>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          organizationId
            ? t('users.searchInOrganization', { defaultValue: 'Search by name, email, job title, phone or project…' })
            : t('users.search', { defaultValue: 'Search by name, email, client, job title, phone or project…' })
        }
        searchLabel={t('users.searchLabel', { defaultValue: 'Search client users' })}
      />

      <PortalPagedTable<ClientUser>
        ariaLabel={t('users.tableLabel', { defaultValue: 'Client users' })}
        columns={columnVisibility.visibleColumns(columns)}
        onTableChange={handleTableChange}
        grouping={
          isGrouped
            ? {
                getKey: user => user.organization_id,
                renderHeader: (_key, users) => (
                  <Flex align="center" gap={10}>
                    <PortalAvatar name={users[0].organization_name} />
                    <ClickableName
                      onClick={onOpenOrganization ? () => onOpenOrganization(users[0].organization_id) : undefined}
                    >
                      {users[0].organization_name}
                    </ClickableName>
                    <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
                      {t('users.groupBy.count', { count: users.length, defaultValue: '{{count}} users' })}
                    </Typography.Text>
                  </Flex>
                ),
              }
            : undefined
        }
        rows={list?.items ?? []}
        rowKey={user => user.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyText={
          hasFilters
            ? t('users.emptyFiltered', { defaultValue: 'No client users match these filters.' })
            : t('users.empty', { defaultValue: 'No client users yet. Use Add Client to invite the first one.' })
        }
      />

      {modals}
    </div>
  );
};
