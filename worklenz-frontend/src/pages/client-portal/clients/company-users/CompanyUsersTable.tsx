import { useEffect, useMemo, useState } from 'react';
import {
  EyeOutlined,
  EditOutlined,
  FolderOpenOutlined,
  MailOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  StarFilled,
  StarOutlined,
  StopOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Dropdown,
  Empty,
  Flex,
  Input,
  Modal,
  Pagination,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps, TableProps } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  CompanyUser,
  CompanyUserPortalStatus,
  useGetCompanyUsersQuery,
  useInviteCompanyUserMutation,
  useRemoveCompanyUserMutation,
  useSetCompanyUserDisabledMutation,
  useSetCompanyUserRoleMutation,
} from '@/api/client-portal/company-users-api';
import PortalStatusTag from '@/components/client-portal/PortalStatusTag';
import { PERMISSION_LEVELS } from '@/lib/client-portal/client-permissions';
import { AvatarNamesMap } from '@/shared/constants';
import { ClientInvitationLinkModal } from '../ClientInvitationLinkModal';
import { PAGE_SIZE_OPTIONS, getClientInitials } from '../clients-list-helpers';
import {
  COMPANY_USER_STATUS_FILTER_VALUES,
  getApiErrorMessage,
  getCompanyUserMenuState,
} from './company-users-helpers';
import { AssignProjectsModal } from './AssignProjectsModal';
import { EditCompanyUserModal } from './EditCompanyUserModal';
import { CompanyUserProfileModal } from './CompanyUserProfileModal';

const { Text } = Typography;

const SEARCH_DEBOUNCE_MS = 300;

type StatusFilter = 'all' | CompanyUserPortalStatus;
type CompanyUserColumn = NonNullable<TableProps<CompanyUser>['columns']>[number];

interface CompanyUsersTableProps {
  /** Scopes the table to one company (the workspace's Company Members tab) and hides its column. */
  clientId?: string;
  /** Called when a company name is clicked. Without it the name is plain text. */
  onOpenCompany?: (clientId: string) => void;
  /** Shows an add button in the empty state. */
  onAdd?: () => void;
  /** Wording of that button, when "Add Client" would be wrong (inside a company, it adds a user). */
  addLabel?: string;
}

export const CompanyUsersTable = ({
  clientId,
  onOpenCompany,
  onAdd,
  addLabel,
}: CompanyUsersTableProps) => {
  const { t } = useTranslation('client-portal-company-users');
  const { token } = theme.useToken();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sort, setSort] = useState<{ sortBy: string; sortOrder: 'asc' | 'desc' }>({
    sortBy: 'name',
    sortOrder: 'asc',
  });

  const [profileUser, setProfileUser] = useState<CompanyUser | null>(null);
  const [editUser, setEditUser] = useState<CompanyUser | null>(null);
  const [assignUser, setAssignUser] = useState<CompanyUser | null>(null);
  const [fallbackLink, setFallbackLink] = useState('');

  const { data, isFetching, error, refetch } = useGetCompanyUsersQuery(
    {
      page,
      limit,
      search: search || undefined,
      status: status !== 'all' ? status : undefined,
      client_id: clientId,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    },
    { refetchOnMountOrArgChange: true }
  );

  const [setRole] = useSetCompanyUserRoleMutation();
  const [setDisabled] = useSetCompanyUserDisabledMutation();
  const [inviteUser] = useInviteCompanyUserMutation();
  const [removeUser] = useRemoveCompanyUserMutation();

  const users = data?.body?.users ?? [];
  const total = data?.body?.total ?? 0;
  const hasActiveFilters = Boolean(search) || status !== 'all';

  // Search runs on the server, so wait for a pause in typing. A new search starts from page 1.
  useEffect(() => {
    if (searchInput === search) return undefined;

    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const statusLabel = (value: string) =>
    t(`portalStatus.${value}`, {
      defaultValue:
        value === 'active'
          ? 'Active'
          : value === 'invited'
            ? 'Invited'
            : value === 'expired'
              ? 'Expired'
              : value === 'disabled'
                ? 'Disabled'
                : 'Not Invited',
    });

  const levelLabel = (levelKey: string) => {
    const definition = PERMISSION_LEVELS.find(level => level.key === levelKey);
    return definition
      ? t(definition.labelKey, { defaultValue: definition.labelDefault })
      : t('permissionLevels.unknown', { defaultValue: 'Unknown level' });
  };

  const handleStatusChange = (value: StatusFilter) => {
    setStatus(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('all');
    setPage(1);
  };

  const handlePaginationChange = (nextPage: number, pageSize: number) => {
    if (pageSize !== limit) {
      setLimit(pageSize);
      setPage(1);
      return;
    }
    setPage(nextPage);
  };

  const handleTableChange: TableProps<CompanyUser>['onChange'] = (
    _pagination,
    _filters,
    sorter
  ) => {
    const next = Array.isArray(sorter) ? sorter[0] : sorter;

    if (next?.columnKey && next.order) {
      setSort({
        sortBy: String(next.columnKey),
        sortOrder: next.order === 'ascend' ? 'asc' : 'desc',
      });
    } else {
      setSort({ sortBy: 'name', sortOrder: 'asc' });
    }
    setPage(1);
  };

  const sortOrderFor = (key: string): 'ascend' | 'descend' | null =>
    sort.sortBy === key ? (sort.sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const handleToggleRole = async (user: CompanyUser) => {
    const nextRole = user.role === 'poc' ? 'member' : 'poc';
    try {
      await setRole({ id: user.id, role: nextRole }).unwrap();
      message.success(
        nextRole === 'poc'
          ? t('messages.madePoc', { name: user.name, defaultValue: '{{name}} is now a POC.' })
          : t('messages.removedPoc', {
              name: user.name,
              defaultValue: '{{name}} is no longer a POC.',
            })
      );
    } catch (roleError) {
      message.error(
        getApiErrorMessage(roleError) ||
          t('messages.roleError', { defaultValue: 'Could not change the role.' })
      );
    }
  };

  const handleInvite = async (user: CompanyUser) => {
    try {
      const result = await inviteUser({ id: user.id, delivery: 'email' }).unwrap();

      if (result.body.email_sent) {
        message.success(
          t('messages.inviteSent', {
            email: user.email,
            defaultValue: 'Invitation sent to {{email}}.',
          })
        );
        return;
      }

      // The invitation exists but the email did not go out, so let the operator share the link.
      message.warning(
        t('messages.inviteEmailFailed', {
          defaultValue: 'The invitation was created but the email could not be sent.',
        })
      );
      if (result.body.link) setFallbackLink(result.body.link);
    } catch (inviteError) {
      message.error(
        getApiErrorMessage(inviteError) ||
          t('messages.inviteError', { defaultValue: 'Could not send the invitation.' })
      );
    }
  };

  const handleSetDisabled = async (user: CompanyUser, disabled: boolean) => {
    try {
      await setDisabled({ id: user.id, disabled }).unwrap();
      message.success(
        disabled
          ? t('messages.disabled', { name: user.name, defaultValue: '{{name}} was disabled.' })
          : t('messages.enabled', { name: user.name, defaultValue: '{{name}} was enabled.' })
      );
    } catch (statusError) {
      message.error(
        getApiErrorMessage(statusError) ||
          t('messages.statusError', { defaultValue: 'Could not update the user.' })
      );
    }
  };

  const confirmDisable = (user: CompanyUser) =>
    Modal.confirm({
      title: t('confirmDisable.title', { defaultValue: 'Disable this user?' }),
      content: t('confirmDisable.content', {
        name: user.name,
        defaultValue:
          '{{name}} will lose access to the portal straight away. You can enable them again later and they will return to the status they had.',
      }),
      okText: t('confirmDisable.ok', { defaultValue: 'Disable user' }),
      cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
      onOk: () => handleSetDisabled(user, true),
    });

  const confirmRemove = (user: CompanyUser) =>
    Modal.confirm({
      title: t('confirmRemove.title', { defaultValue: 'Remove this user?' }),
      content: t('confirmRemove.content', {
        name: user.name,
        defaultValue:
          '{{name}} will be removed from the company and lose portal access. This can’t be undone. The company and its other users are not affected.',
      }),
      okText: t('confirmRemove.ok', { defaultValue: 'Remove user' }),
      okType: 'danger',
      cancelText: t('cancelButton', { defaultValue: 'Cancel' }),
      onOk: async () => {
        try {
          await removeUser(user.id).unwrap();
          message.success(
            t('messages.removed', { name: user.name, defaultValue: '{{name}} was removed.' })
          );
        } catch (removeError) {
          message.error(
            getApiErrorMessage(removeError) ||
              t('messages.removeError', { defaultValue: 'Could not remove the user.' })
          );
        }
      },
    });

  const getMenuItems = (user: CompanyUser): MenuProps['items'] => {
    const state = getCompanyUserMenuState(user);

    return [
      {
        key: 'profile',
        icon: <EyeOutlined />,
        label: t('menu.viewProfile', { defaultValue: 'View Profile' }),
        onClick: () => setProfileUser(user),
      },
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: t('menu.editUser', { defaultValue: 'Edit User' }),
        onClick: () => setEditUser(user),
      },
      {
        key: 'assign',
        icon: <FolderOpenOutlined />,
        label: t('menu.assignProjects', { defaultValue: 'Assign Projects' }),
        onClick: () => setAssignUser(user),
      },
      {
        key: 'poc',
        icon: state.pocAction === 'make' ? <StarOutlined /> : <StarFilled />,
        label:
          state.pocAction === 'make'
            ? t('menu.makePoc', { defaultValue: 'Make POC' })
            : t('menu.removePoc', { defaultValue: 'Remove POC' }),
        onClick: () => handleToggleRole(user),
      },
      ...(state.canInvite
        ? [
            {
              key: 'invite',
              icon: <MailOutlined />,
              label:
                state.inviteAction === 'send'
                  ? t('menu.sendInvite', { defaultValue: 'Send Invite' })
                  : t('menu.resendInvite', { defaultValue: 'Resend Invite' }),
              onClick: () => handleInvite(user),
            },
          ]
        : []),
      { type: 'divider' as const },
      state.isDisabled
        ? {
            key: 'enable',
            icon: <CheckCircleOutlined />,
            label: t('menu.enableUser', { defaultValue: 'Enable User' }),
            onClick: () => handleSetDisabled(user, false),
          }
        : {
            key: 'disable',
            icon: <StopOutlined />,
            label: t('menu.disableUser', { defaultValue: 'Disable User' }),
            onClick: () => confirmDisable(user),
          },
      {
        key: 'remove',
        icon: <DeleteOutlined />,
        danger: true,
        label: t('menu.removeUser', { defaultValue: 'Remove User' }),
        onClick: () => confirmRemove(user),
      },
    ];
  };

  const renderSecondaryText = (value?: string | null) => (
    <Text type="secondary">{value?.trim() ? value : '—'}</Text>
  );

  const renderProjects = (user: CompanyUser) => {
    if (user.project_count === 0) {
      return (
        <Text type="secondary">{t('projectsNone', { defaultValue: 'No projects assigned' })}</Text>
      );
    }

    return (
      <Tooltip
        title={
          <Flex vertical gap={2}>
            {user.projects.map(project => (
              <span key={project.project_id}>
                {project.name}: {levelLabel(project.level)}
              </span>
            ))}
          </Flex>
        }
      >
        <Text tabIndex={0} style={{ cursor: 'default' }}>
          {t('projectsCount', {
            count: user.project_count,
            defaultValue_one: '{{count}} project',
            defaultValue_other: '{{count}} projects',
          })}
        </Text>
      </Tooltip>
    );
  };

  // Shown only in the global list: inside one company's workspace every row has the same company.
  const companyColumn: CompanyUserColumn = {
    key: 'company_name',
    title: t('columns.company', { defaultValue: 'Company' }),
    dataIndex: 'company_name',
    sorter: true,
    sortOrder: sortOrderFor('company_name'),
    render: (_company: string, record: CompanyUser) =>
      onOpenCompany ? (
        <Typography.Link onClick={() => onOpenCompany(record.client_id)}>
          {record.company_name}
        </Typography.Link>
      ) : (
        <Text>{record.company_name}</Text>
      ),
  };

  const columns: CompanyUserColumn[] = [
    {
      key: 'name',
      title: t('columns.user', { defaultValue: 'User' }),
      dataIndex: 'name',
      sorter: true,
      sortOrder: sortOrderFor('name'),
      onCell: () => ({ style: { minWidth: 200 } }),
      render: (_name: string, record) => {
        const initial = getClientInitials(record.name).charAt(0);
        return (
          <Flex align="center" gap={10}>
            <Avatar
              size={28}
              style={{
                flexShrink: 0,
                color: token.colorWhite,
                backgroundColor: AvatarNamesMap[initial],
              }}
            >
              {initial}
            </Avatar>
            <Text strong>{record.name}</Text>
          </Flex>
        );
      },
    },
    {
      key: 'email',
      title: t('columns.email', { defaultValue: 'Email' }),
      dataIndex: 'email',
      sorter: true,
      sortOrder: sortOrderFor('email'),
      render: (email: string) => renderSecondaryText(email),
    },
    {
      key: 'phone',
      title: t('columns.phone', { defaultValue: 'Phone' }),
      dataIndex: 'phone',
      render: (phone: string | null) => renderSecondaryText(phone),
    },
    ...(clientId ? [] : [companyColumn]),
    {
      key: 'role',
      title: t('columns.access', { defaultValue: 'Access' }),
      dataIndex: 'role',
      sorter: true,
      sortOrder: sortOrderFor('role'),
      render: (role: CompanyUser['role']) => (
        <Tag color={role === 'poc' ? 'blue' : 'default'} style={{ margin: 0 }}>
          {role === 'poc'
            ? t('role.poc', { defaultValue: 'POC' })
            : t('role.member', { defaultValue: 'Member' })}
        </Tag>
      ),
    },
    {
      key: 'jobTitle',
      title: t('columns.jobTitle', { defaultValue: 'Job title' }),
      dataIndex: 'job_title',
      render: (jobTitle: string | null) => renderSecondaryText(jobTitle),
    },
    {
      key: 'projects',
      title: t('columns.projects', { defaultValue: 'Projects' }),
      dataIndex: 'project_count',
      render: (_count: number, record) => renderProjects(record),
    },
    {
      key: 'portalStatus',
      title: t('columns.portalStatus', { defaultValue: 'Portal Status' }),
      dataIndex: 'portal_status',
      render: (_status: unknown, record) => (
        <PortalStatusTag
          showDot
          status={record.portal_status.status}
          label={statusLabel(record.portal_status.status)}
        />
      ),
    },
    {
      key: 'actions',
      title: t('columns.actions', { defaultValue: 'Actions' }),
      width: 88,
      fixed: 'right',
      align: 'center',
      render: (_actions: unknown, record) => (
        <Dropdown
          menu={{ items: getMenuItems(record) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            size="small"
            icon={<MoreOutlined />}
            aria-label={t('rowActionsLabel', {
              name: record.name,
              defaultValue: 'Actions for {{name}}',
            })}
          />
        </Dropdown>
      ),
    },
  ];

  const statusOptions = useMemo(
    () =>
      COMPANY_USER_STATUS_FILTER_VALUES.map(value => ({
        value,
        label:
          value === 'all'
            ? t('allStatusesOption', { defaultValue: 'All statuses' })
            : statusLabel(value),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const renderEmptyState = () => (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      style={{ padding: '40px 0' }}
      description={
        <Flex vertical gap={4}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('empty.title', { defaultValue: 'No client users found' })}
          </Typography.Title>
          <Text type="secondary">
            {hasActiveFilters
              ? t('empty.filtered', { defaultValue: 'No users match the current filters.' })
              : t('empty.none', {
                  defaultValue:
                    'No client users yet. Add a client or a user to a company to give people portal access.',
                })}
          </Text>
        </Flex>
      }
    >
      {hasActiveFilters ? (
        <Button onClick={handleClearFilters}>
          {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
        </Button>
      ) : (
        onAdd && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
            {addLabel ?? t('addButton', { defaultValue: 'Add Client' })}
          </Button>
        )
      )}
    </Empty>
  );

  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('errorTitle', { defaultValue: 'Error loading client users' })}
        description={t('errorDescription', {
          defaultValue: 'There was an error loading client users. Please try again.',
        })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retryButton', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Flex gap={12} align="center" wrap="wrap" style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder={t('searchPlaceholder', { defaultValue: 'Search users or companies...' })}
          aria-label={t('searchPlaceholder', { defaultValue: 'Search users or companies...' })}
          style={{ width: '100%', maxWidth: 280 }}
          value={searchInput}
          onChange={event => setSearchInput(event.target.value)}
          onSearch={value => {
            setSearchInput(value);
            setSearch(value);
            setPage(1);
          }}
        />

        <Select
          aria-label={t('statusFilterLabel', { defaultValue: 'Filter by status' })}
          style={{ width: 170 }}
          value={status}
          onChange={handleStatusChange}
          options={statusOptions}
        />

        <Tooltip title={t('refreshButton', { defaultValue: 'Refresh' })}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => refetch()}
            loading={isFetching}
            aria-label={t('refreshButton', { defaultValue: 'Refresh' })}
          />
        </Tooltip>

        {hasActiveFilters && (
          <Button type="link" onClick={handleClearFilters}>
            {t('clearFiltersButton', { defaultValue: 'Clear Filters' })}
          </Button>
        )}
      </Flex>

      <Card style={{ borderRadius: 8, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
        {users.length > 0 || isFetching ? (
          <Table<CompanyUser>
            columns={columns}
            dataSource={users}
            rowKey="id"
            size="middle"
            pagination={false}
            loading={isFetching}
            onChange={handleTableChange}
            scroll={{ x: 'max-content' }}
            onRow={record => ({
              // A disabled user stays visible but reads as inactive.
              style: record.portal_status.status === 'disabled' ? { opacity: 0.6 } : undefined,
            })}
          />
        ) : (
          renderEmptyState()
        )}

        {total > 0 && (
          <Flex
            justify="end"
            style={{ padding: '12px 16px', borderTop: `1px solid ${token.colorBorderSecondary}` }}
          >
            <Pagination
              current={page}
              pageSize={limit}
              total={total}
              responsive
              showSizeChanger
              pageSizeOptions={PAGE_SIZE_OPTIONS.map(String)}
              showTotal={(count, range) =>
                t('paginationSummary', {
                  from: range[0],
                  to: range[1],
                  total: count,
                  defaultValue: 'Showing {{from}}-{{to}} of {{total}} users',
                })
              }
              onChange={handlePaginationChange}
            />
          </Flex>
        )}
      </Card>

      <CompanyUserProfileModal
        user={profileUser}
        open={profileUser !== null}
        onClose={() => setProfileUser(null)}
      />
      <EditCompanyUserModal
        user={editUser}
        open={editUser !== null}
        onClose={() => setEditUser(null)}
      />
      <AssignProjectsModal
        user={assignUser}
        open={assignUser !== null}
        onClose={() => setAssignUser(null)}
      />
      <ClientInvitationLinkModal
        open={Boolean(fallbackLink)}
        link={fallbackLink}
        onClose={() => setFallbackLink('')}
        onCopy={() => {
          navigator.clipboard
            ?.writeText(fallbackLink)
            .then(() =>
              message.success(t('messages.linkCopied', { defaultValue: 'Invitation link copied.' }))
            )
            .catch(() =>
              message.error(
                t('messages.linkCopyError', { defaultValue: 'Could not copy the link.' })
              )
            );
        }}
      />
    </>
  );
};
