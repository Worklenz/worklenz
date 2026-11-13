import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import {
  Alert,
  Button,
  Empty,
  Flex,
  Skeleton,
  Table,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useGetProjectAccessQuery } from '@/api/client-portal/portal-projects-api';
import {
  PortalAvatar,
  RoleTag,
  UserStatusTag,
  formatRelativeTime,
} from '@/components/client-portal/v2';
import type { ProjectAccessUser } from '@/types/client-portal/v2';
import { portalPaths } from '@/pages/client-portal/portal-paths';
import TablePagination from '@/components/TablePagination';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';

interface ProjectClientPortalMembersProps {
  projectId: string;
  clientId?: string | null;
  clientName?: string | null;
  searchQuery?: string;
  /** Owner/Admin only — assignment stays in Client Portal admin routes. */
  canManageAccess?: boolean;
}

/**
 * Client's team tab body: portal users who can open this project.
 * Rendered inside the shared Members card (tabs live in the card title).
 */
export const ProjectClientPortalMembers = ({
  projectId,
  clientId,
  clientName,
  searchQuery = '',
  canManageAccess = false,
}: ProjectClientPortalMembersProps) => {
  const { t, i18n } = useTranslation('project-view-members');
  const { token } = theme.useToken();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const pageSizeNumberOptions = useMemo(() => PAGE_SIZE_OPTIONS.map(Number), []);

  const isLinkedToClient = Boolean(clientId) || Boolean(clientName);
  const accessQuery = useGetProjectAccessQuery(projectId, {
    skip: !projectId || !isLinkedToClient,
  });

  const access = accessQuery.data?.body;
  const organizationId = access?.organization_id ?? clientId ?? null;
  const assigned = access?.assigned ?? [];
  const hasOrganization = Boolean(organizationId);

  const filteredAssigned = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return assigned;
    return assigned.filter(
      user =>
        user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    );
  }, [assigned, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, projectId]);

  const total = filteredAssigned.length;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    if (page > totalPages) setPage(totalPages);
  }, [total, pageSize, page]);

  const pagedAssigned = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAssigned.slice(start, start + pageSize);
  }, [filteredAssigned, page, pageSize]);

  const handlePageChange = useCallback((nextPage: number, nextPageSize: number) => {
    setPage(nextPage);
    setPageSize(nextPageSize);
  }, []);

  const columns: ColumnsType<ProjectAccessUser> = useMemo(
    () => [
      {
        key: 'name',
        title: t('clientPortal.nameColumn', { defaultValue: 'Name' }),
        render: (_value, user) => (
          <Flex align="center" gap={10}>
            <PortalAvatar name={user.name} />
            <Typography.Text>{user.name}</Typography.Text>
          </Flex>
        ),
      },
      {
        key: 'email',
        title: t('clientPortal.emailColumn', { defaultValue: 'Email' }),
        render: (_value, user) => <Typography.Text>{user.email}</Typography.Text>,
      },
      {
        key: 'role',
        title: t('clientPortal.roleColumn', { defaultValue: 'Role' }),
        render: (_value, user) => <RoleTag role={user.role} />,
      },
      {
        key: 'status',
        title: t('clientPortal.statusColumn', { defaultValue: 'Status' }),
        render: (_value, user) => (
          <UserStatusTag
            user={{
              status: user.status,
              invite_expired: false,
              invite_not_sent: false,
              new_link_requested: false,
              email_verified: true,
            }}
          />
        ),
      },
      {
        key: 'lastAccess',
        title: t('clientPortal.lastAccessColumn', { defaultValue: 'Last access' }),
        render: (_value, user) => (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatRelativeTime(user.last_access_at, i18n.language) ??
              t('clientPortal.neverAccessed', { defaultValue: 'Never' })}
          </Typography.Text>
        ),
      },
    ],
    [t, i18n.language]
  );

  const manageAccessPath = portalPaths.project(projectId, 'access');
  const hasActiveSearch = searchQuery.trim().length > 0;

  if (!isLinkedToClient || (accessQuery.isSuccess && !hasOrganization)) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={
          <Flex vertical gap={8} align="center">
            <Typography.Text type="secondary">
              {t('clientPortal.noClientLinked', {
                defaultValue:
                  'This project is not linked to a client yet. Assign a client in the Client Portal to manage client team access here.',
              })}
            </Typography.Text>
            {canManageAccess && (
              <Link to={portalPaths.projects}>
                <Button type="primary" size="small">
                  {t('clientPortal.goToClientPortal', {
                    defaultValue: 'Go to Client Portal',
                  })}
                </Button>
              </Link>
            )}
          </Flex>
        }
      />
    );
  }

  if (accessQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  if (accessQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('clientPortal.loadFailed', {
          defaultValue: 'Client portal users could not be loaded.',
        })}
        action={
          <Button size="small" onClick={() => accessQuery.refetch()}>
            {t('clientPortal.retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Table<ProjectAccessUser>
        aria-label={t('clientPortal.tableLabel', {
          defaultValue: 'Client portal users with access to this project',
        })}
        className="custom-two-colors-row-table"
        size="middle"
        columns={columns}
        dataSource={pagedAssigned}
        rowKey={user => user.id}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Flex vertical gap={8} align="center">
                  <Typography.Text type="secondary">
                    {hasActiveSearch
                      ? t('clientPortal.searchEmpty', {
                          defaultValue: 'No client users match your search.',
                        })
                      : t('clientPortal.empty', {
                          defaultValue:
                            'No client users are assigned to this project yet. Assign them from Client Portal.',
                        })}
                  </Typography.Text>
                  {!hasActiveSearch && canManageAccess && (
                    <Link to={manageAccessPath}>
                      <Button type="link" size="small" style={{ padding: 0 }}>
                        {t('clientPortal.manageAccess', { defaultValue: 'Manage access' })}
                      </Button>
                    </Link>
                  )}
                </Flex>
              }
            />
          ),
        }}
        onRow={() => ({
          style: {
            height: 42,
            borderColor: token.colorBorderSecondary,
          },
        })}
      />
      <TablePagination
        navigationLabel={t('common:paginationNavigation', { defaultValue: 'Pagination' })}
        firstPageLabel={t('common:firstPage', { defaultValue: 'First page' })}
        previousPageLabel={t('common:previousPage', { defaultValue: 'Previous page' })}
        nextPageLabel={t('common:nextPage', { defaultValue: 'Next page' })}
        lastPageLabel={t('common:lastPage', { defaultValue: 'Last page' })}
        renderDefaultSummary={(range, count) =>
          t('common:paginationSummary', { range, total: count, defaultValue: `${range} of ${count}` })
        }
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={handlePageChange}
        pageSizeOptions={pageSizeNumberOptions}
        rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
        renderSummary={(range, totalCount) =>
          t('paginationSummary', {
            range,
            total: totalCount,
            defaultValue: `${range} of ${totalCount}`,
          })
        }
      />
    </>
  );
};
