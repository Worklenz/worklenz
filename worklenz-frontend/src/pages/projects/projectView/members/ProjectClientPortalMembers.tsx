import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import {
  Alert,
  Button,
  Card,
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
import { clientWorkspacePath } from '@/pages/client-portal/clients/workspace/workspace-helpers';

interface ProjectClientPortalMembersProps {
  projectId: string;
  clientId?: string | null;
  clientName?: string | null;
}

/**
 * Client's team tab content: portal users who can open this project.
 * Shown even when no client is linked, with guidance to assign one.
 */
export const ProjectClientPortalMembers = ({
  projectId,
  clientId,
  clientName,
}: ProjectClientPortalMembersProps) => {
  const { t, i18n } = useTranslation('project-view-members');
  const { token } = theme.useToken();

  const isLinkedToClient = Boolean(clientId) || Boolean(clientName);
  const accessQuery = useGetProjectAccessQuery(projectId, {
    skip: !projectId || !isLinkedToClient,
  });

  const access = accessQuery.data?.body;
  const organizationId = access?.organization_id ?? clientId ?? null;
  const assigned = access?.assigned ?? [];
  const hasOrganization = Boolean(organizationId);

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
  const clientPath = organizationId ? clientWorkspacePath(organizationId, 'users') : null;
  const displayClientName =
    clientName || t('clientPortal.unknownClient', { defaultValue: 'Client' });

  if (!isLinkedToClient || (accessQuery.isSuccess && !hasOrganization)) {
    return (
      <Card style={{ width: '100%' }}>
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
              <Link to={portalPaths.projects}>
                <Button type="primary" size="small">
                  {t('clientPortal.goToClientPortal', {
                    defaultValue: 'Go to Client Portal',
                  })}
                </Button>
              </Link>
            </Flex>
          }
        />
      </Card>
    );
  }

  return (
    <Card
      style={{ width: '100%' }}
      title={
        <Flex justify="space-between" align="center" gap={12} wrap="wrap">
          <Flex vertical gap={2}>
            <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
              {t('clientPortal.title', { defaultValue: "Client's team" })}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12.5, fontWeight: 400 }}>
              {t('clientPortal.summary', {
                count: assigned.length,
                client: displayClientName,
                defaultValue:
                  '{{count}} user(s) at {{client}} can open this project in the Client Portal.',
              })}
            </Typography.Text>
          </Flex>
        </Flex>
      }
    >
      {accessQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : accessQuery.isError ? (
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
      ) : (
        <Table<ProjectAccessUser>
          aria-label={t('clientPortal.tableLabel', {
            defaultValue: 'Client portal users with access to this project',
          })}
          className="custom-two-colors-row-table"
          size="middle"
          columns={columns}
          dataSource={assigned}
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
                      {t('clientPortal.empty', {
                        defaultValue:
                          'No client users are assigned to this project yet. Assign them from Client Portal.',
                      })}
                    </Typography.Text>
                    <Link to={manageAccessPath}>
                      <Button type="link" size="small" style={{ padding: 0 }}>
                        {t('clientPortal.manageAccess', { defaultValue: 'Manage access' })}
                      </Button>
                    </Link>
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
      )}
    </Card>
  );
};
