import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { Alert, Button, Card, Empty, Flex, Select, Table, Typography, message, theme } from '@/shared/antd-imports';
import { useGetPortalOrganizationsQuery } from '@/api/client-portal/portal-access-api';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useAssignProjectUserMutation,
  useGetProjectAccessQuery,
  useLinkProjectToClientMutation,
  useRemoveProjectUserMutation,
} from '@/api/client-portal/portal-projects-api';
import {
  ConfirmEffectModal,
  PortalAvatar,
  ROLE_LABEL_COPY,
  RoleTag,
  UserStatusTag,
  formatRelativeTime,
} from '@/components/client-portal/v2';
import type { PortalProject, ProjectAccessUser } from '@/types/client-portal/v2';
import { PortalLoader } from '@/components/client-portal/v2';

interface AccessTabProps {
  project: PortalProject;
}

/** Who at the client can open this project. A project with no client is linked to one here first. */
export const AccessTab = ({ project }: AccessTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  const [pickedUserId, setPickedUserId] = useState<string | undefined>();
  const [pickedOrganizationId, setPickedOrganizationId] = useState<string | undefined>();
  const [removing, setRemoving] = useState<ProjectAccessUser | null>(null);

  const accessQuery = useGetProjectAccessQuery(project.id);
  const organizationsQuery = useGetPortalOrganizationsQuery({ limit: 100 }, { skip: project.organization_id !== null });
  const [assignUser, { isLoading: isAssigning }] = useAssignProjectUserMutation();
  const [removeUser, { isLoading: isRemoving }] = useRemoveProjectUserMutation();
  const [linkClient, { isLoading: isLinking }] = useLinkProjectToClientMutation();

  if (project.organization_id === null) {
    return (
      <Card size="small" title={t('access.linkTitle', { defaultValue: 'Link this project to a client' })}>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
          {t('access.linkDescription', {
            defaultValue:
              'A project must belong to a client organization before the Client Portal can be switched on and users can be assigned.',
          })}
        </Typography.Paragraph>
        <Flex gap={10} wrap="wrap">
          <Select<string>
            showSearch
            optionFilterProp="label"
            style={{ width: 260 }}
            loading={organizationsQuery.isLoading}
            value={pickedOrganizationId}
            onChange={setPickedOrganizationId}
            placeholder={t('access.chooseClient', { defaultValue: 'Choose a client…' })}
            aria-label={t('access.chooseClient', { defaultValue: 'Choose a client…' })}
            options={(organizationsQuery.data?.body?.items ?? []).map(item => ({ value: item.id, label: item.name }))}
          />
          <Button
            type="primary"
            disabled={!pickedOrganizationId}
            loading={isLinking}
            onClick={async () => {
              if (!pickedOrganizationId) return;
              try {
                await linkClient({ projectId: project.id, organizationId: pickedOrganizationId }).unwrap();
                const name = organizationsQuery.data?.body?.items.find(item => item.id === pickedOrganizationId)?.name ?? '';
                message.success(
                  t('access.linked', {
                    project: project.name,
                    client: name,
                    defaultValue: '{{project}} now belongs to {{client}}. Switch the Client Portal on to share it.',
                  })
                );
              } catch (error) {
                message.error(
                  getPortalErrorMessage(error, t('access.linkFailed', { defaultValue: 'The project could not be linked.' }))
                );
              }
            }}
          >
            {t('access.link', { defaultValue: 'Link client' })}
          </Button>
        </Flex>
      </Card>
    );
  }

  if (accessQuery.isLoading) return <PortalLoader />;
  if (accessQuery.isError || !accessQuery.data?.body) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('access.loadFailed', { defaultValue: 'The client access list could not be loaded.' })}
        action={
          <Button size="small" onClick={() => accessQuery.refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  const access = accessQuery.data.body;

  const assign = async () => {
    if (!pickedUserId) return;
    const user = access.assignable.find(item => item.id === pickedUserId);
    try {
      await assignUser({ projectId: project.id, userId: pickedUserId }).unwrap();
      setPickedUserId(undefined);
      message.success(
        t('access.assigned', {
          name: user?.name ?? '',
          project: project.name,
          defaultValue: '{{name}} can now open {{project}}.',
        })
      );
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('access.assignFailed', { defaultValue: 'The user could not be assigned.' })));
    }
  };

  const remove = async () => {
    if (!removing) return;
    try {
      await removeUser({ projectId: project.id, userId: removing.id }).unwrap();
      message.success(
        t('access.removed', {
          name: removing.name,
          project: project.name,
          defaultValue: '{{name}} lost access to {{project}} immediately.',
        })
      );
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('access.removeFailed', { defaultValue: 'Access could not be removed.' })));
    } finally {
      setRemoving(null);
    }
  };

  const columns: ColumnsType<ProjectAccessUser> = [
    {
      key: 'user',
      title: t('access.columns.user', { defaultValue: 'User' }),
      render: (_value, user) => (
        <Flex align="center" gap={10}>
          <PortalAvatar name={user.name} />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
            <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>{user.email}</div>
          </div>
        </Flex>
      ),
    },
    {
      key: 'role',
      title: t('access.columns.role', { defaultValue: 'Role' }),
      render: (_value, user) => <RoleTag role={user.role} />,
    },
    {
      key: 'status',
      title: t('access.columns.status', { defaultValue: 'Status' }),
      render: (_value, user) => (
        <UserStatusTag
          user={{ status: user.status, invite_expired: false, invite_not_sent: false, new_link_requested: false, email_verified: true }}
        />
      ),
    },
    {
      key: 'last',
      title: t('access.columns.lastAccess', { defaultValue: 'Last access' }),
      render: (_value, user) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {formatRelativeTime(user.last_access_at, i18n.language) ?? t('access.never', { defaultValue: 'Never' })}
        </Typography.Text>
      ),
    },
    {
      key: 'actions',
      align: 'right',
      render: (_value, user) => (
        <Button size="small" onClick={() => setRemoving(user)}>
          {t('access.removeAccess', { defaultValue: 'Remove access' })}
        </Button>
      ),
    },
  ];

  return (
    <Card size="small" styles={{ body: { padding: 0 } }}>
      <Flex
        gap={10}
        align="center"
        wrap="wrap"
        style={{ padding: '14px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Typography.Text type="secondary" style={{ flex: 1, minWidth: 200, fontSize: 12.5 }}>
          {t('access.summary', {
            count: access.assigned.length,
            client: project.organization_name ?? '',
            defaultValue: '{{count}} user(s) at {{client}} can open this project.',
          })}
        </Typography.Text>
        <Select<string>
          showSearch
          optionFilterProp="label"
          style={{ width: 240 }}
          value={pickedUserId}
          onChange={setPickedUserId}
          placeholder={t('access.addUser', { defaultValue: 'Add a user…' })}
          aria-label={t('access.addUser', { defaultValue: 'Add a user…' })}
          notFoundContent={t('access.noAssignable', { defaultValue: 'Everyone at this client already has access.' })}
          options={access.assignable.map(user => ({
            value: user.id,
            label: `${user.name} (${tShared(ROLE_LABEL_COPY[user.role].key, { defaultValue: ROLE_LABEL_COPY[user.role].defaultValue })})`,
          }))}
        />
        <Button type="primary" size="small" disabled={!pickedUserId} loading={isAssigning} onClick={() => void assign()}>
          {t('access.assign', { defaultValue: 'Assign' })}
        </Button>
      </Flex>

      <Table<ProjectAccessUser>
        aria-label={t('access.tableLabel', { defaultValue: 'Users assigned to this project' })}
        size="middle"
        columns={columns}
        dataSource={access.assigned}
        rowKey={user => user.id}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('access.empty', { defaultValue: 'Nobody is assigned yet.' })}
            />
          ),
        }}
      />

      <ConfirmEffectModal
        open={removing !== null}
        danger
        title={t('access.removeTitle', { defaultValue: 'Remove access to this project?' })}
        confirmLabel={t('access.removeConfirm', { defaultValue: 'Remove access' })}
        loading={isRemoving}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
      >
        {removing &&
          t('access.removeBody', {
            name: removing.name,
            project: project.name,
            defaultValue:
              '{{name}} can no longer open {{project}}. This applies on their next request. Their history stays, and you can assign them again at any time.',
          })}
      </ConfirmEffectModal>
    </Card>
  );
};
