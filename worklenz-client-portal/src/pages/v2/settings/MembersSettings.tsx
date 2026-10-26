import React, { useEffect, useState } from 'react';
import {
  Alert,
  Avatar,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Modal,
  Select,
  Table,
  Tag,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  LinkOutlined,
  LockOutlined,
  MoreOutlined,
  SendOutlined,
  SwapOutlined,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { MenuProps, TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { useMessage } from '@/hooks/useMessage';
import {
  useGetOrgUserProjectsQuery,
  useGetOrgUsersQuery,
  useRemoveOrgUserMutation,
  useResendInviteMutation,
  useSetOrgUserProjectsMutation,
  useUpdateOrgUserMutation,
} from '@/store/api-v2';
import { useClientAccess } from '@/hooks/useClientAccess';
import { QueryState, StatusTag, errorMessage } from '@/components/v2';
import { InviteLinkModal } from '@/components/v2/InviteLinkModal';
import { decodeHtmlEntities } from '@/utils/html-entities';
import { TablePagination } from '@/components/v2/TablePagination';
import { useRoleLabel } from '@/components/v2/useRoleLabel';
import type { ClientOrgUserV2, ClientRole } from '@/types/v2';

const ROLES: ClientRole[] = ['admin', 'member', 'viewer'];

/** The people in the client's organization: paged list with per-row actions (edit, role, invite, remove). */
const MembersSettings: React.FC = () => {
  const { t } = useTranslation();
  const message = useMessage();
  const { token } = theme.useToken();
  const { me, can, adminsCanInvite, adminsCanRemove } = useClientAccess();
  const roleLabel = useRoleLabel();
  const users = useGetOrgUsersQuery();
  const [remove] = useRemoveOrgUserMutation();
  const [resendInvite] = useResendInviteMutation();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareLink, setShareLink] = useState<{ link: string; expires_in_days: number } | null>(null);
  const [editing, setEditing] = useState<{ user: ClientOrgUserV2; mode: 'edit' | 'role' } | null>(null);
  const [assigning, setAssigning] = useState<ClientOrgUserV2 | null>(null);
  const [removing, setRemoving] = useState<ClientOrgUserV2 | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const canInvite = can.manageUsers && adminsCanInvite;
  const canRemove = can.manageUsers && adminsCanRemove;
  const adminCount = users.data?.filter(user => user.role === 'admin').length ?? 0;
  const total = users.data?.length ?? 0;

  // Removing the only row on the last page would otherwise leave the table on an empty page.
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(total / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [total, page, pageSize]);

  const removeUser = async (user: ClientOrgUserV2) => {
    try {
      await remove(user.id).unwrap();
      void message.success(t('account.org.removed', { name: decodeHtmlEntities(user.name), defaultValue: '{{name}} was removed. Their access ended immediately.' }));
    } catch (error) {
      void message.error(errorMessage(error) ?? t('account.org.removeFailed', { defaultValue: 'We could not remove this person.' }));
    }
  };

  const sendInvite = async (user: ClientOrgUserV2, sendEmail: boolean) => {
    try {
      const result = await resendInvite({ id: user.id, send_email: sendEmail }).unwrap();
      if (sendEmail) {
        void message.success(t('account.org.inviteEmailed', { email: user.email, defaultValue: 'Invitation emailed to {{email}}.' }));
        return;
      }
      const link = result.link ?? '';
      // Copy it for them, and keep the link on screen in case the clipboard is blocked.
      try {
        await navigator.clipboard.writeText(link);
        void message.success(t('account.org.copied', { defaultValue: 'Link copied.' }));
      } catch {
        // The dialog below still lets them copy it by hand.
      }
      setShareLink({ link, expires_in_days: result.expires_in_days });
    } catch (error) {
      void message.error(errorMessage(error) ?? t('account.org.inviteFailed', { defaultValue: 'We could not create the invite link.' }));
    }
  };

  const actionItems = (user: ClientOrgUserV2): MenuProps['items'] => {
    const isLastAdmin = user.role === 'admin' && adminCount <= 1;
    const items: NonNullable<MenuProps['items']> = [
      {
        key: 'edit',
        icon: <EditOutlined />,
        label: t('account.org.edit', { defaultValue: 'Edit' }),
        onClick: () => setEditing({ user, mode: 'edit' }),
      },
      {
        key: 'role',
        icon: <SwapOutlined />,
        label: t('account.org.changeRole', { defaultValue: 'Change role' }),
        disabled: user.isYou || isLastAdmin,
        onClick: () => setEditing({ user, mode: 'role' }),
      },
    ];
    // A Client Admin opens every project already; only Members and Viewers are assigned.
    if (user.role !== 'admin') {
      items.push({
        key: 'projects',
        icon: <FolderOutlined />,
        label: t('account.org.assignProject', { defaultValue: 'Assign project' }),
        onClick: () => setAssigning(user),
      });
    }
    if (canInvite && user.status === 'Invited') {
      items.push(
        {
          key: 'email',
          icon: <SendOutlined />,
          label: t('account.org.sendInvite', { defaultValue: 'Send email invite' }),
          onClick: () => void sendInvite(user, true),
        },
        {
          key: 'copy',
          icon: <CopyOutlined />,
          label: t('account.org.copyInviteLink', { defaultValue: 'Copy invite link' }),
          onClick: () => void sendInvite(user, false),
        }
      );
    }
    if (canRemove) {
      items.push(
        { type: 'divider' },
        {
          key: 'remove',
          icon: <DeleteOutlined />,
          danger: true,
          label: t('account.org.remove', { defaultValue: 'Remove' }),
          disabled: user.isYou || isLastAdmin,
          onClick: () => setRemoving(user),
        }
      );
    }
    return items;
  };

  const roleFilters = [
    { value: 'admin', text: t('status.role.admin', { defaultValue: 'Client Admin' }) },
    { value: 'member', text: t('status.role.member', { defaultValue: 'Client Member' }) },
    { value: 'viewer', text: t('status.role.viewer', { defaultValue: 'Client Viewer' }) },
  ];
  const statusFilters = [
    { value: 'Active', text: t('status.user.Active', { defaultValue: 'Active' }) },
    { value: 'Invited', text: t('status.user.Invited', { defaultValue: 'Invited' }) },
    { value: 'Deactivated', text: t('status.user.Deactivated', { defaultValue: 'Deactivated' }) },
  ];

  const columns: TableColumnsType<ClientOrgUserV2> = [
    {
      title: t('account.org.user', { defaultValue: 'User' }),
      sorter: (a, b) => a.name.localeCompare(b.name),
      showSorterTooltip: false,
      render: (_: unknown, user) => (
        <Flex gap={8} align="center">
          <Avatar size={26} style={{ backgroundColor: token.colorPrimary }}>{decodeHtmlEntities(user.name)[0]}</Avatar>
          {decodeHtmlEntities(user.name)}
          {user.isYou && <Tag style={{ marginInlineEnd: 0 }}>{t('account.org.you', { defaultValue: 'You' })}</Tag>}
        </Flex>
      ),
    },
    { title: t('account.org.email', { defaultValue: 'Email' }), dataIndex: 'email',
      responsive: ['md'],
      sorter: (a, b) => a.email.localeCompare(b.email),
      showSorterTooltip: false,
    },
    {
      title: t('account.org.jobTitle', { defaultValue: 'Job title' }),
      dataIndex: 'jobTitle',
      responsive: ['lg'],
      sorter: (a, b) => a.jobTitle.localeCompare(b.jobTitle),
      showSorterTooltip: false,
      render: (value: string) => value || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: t('account.org.role', { defaultValue: 'Role' }),
      dataIndex: 'role',
      sorter: (a, b) => a.role.localeCompare(b.role),
      showSorterTooltip: false,
      filters: roleFilters,
      onFilter: (value, user) => user.role === value,
      render: (value: string) => <StatusTag kind="role" status={value} />,
    },
    {
      title: t('account.org.status', { defaultValue: 'Status' }),
      dataIndex: 'status',
      sorter: (a, b) => a.status.localeCompare(b.status),
      showSorterTooltip: false,
      filters: statusFilters,
      onFilter: (value, user) => user.status === value,
      responsive: ['sm'],
      render: (value: string) => <StatusTag kind="user" status={value} />,
    },
    ...(can.manageUsers
      ? [
          {
            title: '',
            key: 'actions',
            width: 56,
            align: 'center' as const,
            fixed: 'right' as const,
            render: (_: unknown, user: ClientOrgUserV2) => (
              <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: actionItems(user) }}>
                <Button
                  type="text"
                  size="small"
                  icon={<MoreOutlined />}
                  aria-label={t('account.org.actionsFor', { name: decodeHtmlEntities(user.name), defaultValue: 'Actions for {{name}}' })}
                />
              </Dropdown>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      {can.manageUsers && !canInvite && !canRemove && (
        <Alert
          type="info"
          showIcon
          icon={<LockOutlined />}
          style={{ marginBottom: 16 }}
          message={t('account.org.notEnabled', {
            defaultValue: "Inviting and removing colleagues isn't enabled for your portal yet. Ask your project contact to turn it on.",
          })}
        />
      )}

      <Card
        type="inner"
        title={
          users.data
            ? t('account.org.peopleCount', {
                count: users.data.length,
                name: decodeHtmlEntities(me?.organizationName),
                defaultValue_one: '{{count}} Member in {{name}}',
                defaultValue_other: '{{count}} Members in {{name}}',
              })
            : t('account.org.people', { name: decodeHtmlEntities(me?.organizationName), defaultValue: 'Members in {{name}}' })
        }
        extra={
          canInvite && (
            <Button type="primary" icon={<LinkOutlined />} onClick={() => setInviteOpen(true)}>
              {t('account.org.invite', { defaultValue: 'Invite Member' })}
            </Button>
          )
        }
        styles={{ body: { padding: 0 } }}
      >
        <QueryState {...users} refetch={users.refetch}>
          <Table<ClientOrgUserV2>
            rowKey="id"
            showSorterTooltip={false}
            tableLayout="auto"
            columns={columns}
            dataSource={users.data}
            pagination={{ current: page, pageSize, position: ['none'] }}
            onChange={(_pagination, _filters, _sorter, extra) => {
              if (extra.action !== 'paginate') setPage(1);
            }}
            scroll={{ x: 'max-content' }}
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            }}
          />
        </QueryState>
      </Card>
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        {t('account.org.ownOrgOnly', { defaultValue: 'You only ever see people from your own organization.' })}
      </Typography.Paragraph>

      <InviteLinkModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <InviteLinkModal open={shareLink !== null} existing={shareLink} onClose={() => setShareLink(null)} />
      <AssignProjectsModal user={assigning} onClose={() => setAssigning(null)} />
      <EditMemberModal target={editing} roleLabel={roleLabel} onClose={() => setEditing(null)} />

      <Modal
        open={removing !== null}
        onCancel={() => setRemoving(null)}
        title={t('account.org.removeTitle', { name: decodeHtmlEntities(removing?.name), defaultValue: 'Remove {{name}}?' })}
        okText={t('account.org.remove', { defaultValue: 'Remove' })}
        okButtonProps={{ danger: true }}
        cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
        onOk={() => {
          if (removing) void removeUser(removing);
          setRemoving(null);
        }}
      >
        {t('account.org.removeBody', { defaultValue: 'Their access ends immediately.' })}
      </Modal>
    </>
  );
};

/** Choose which of the organization's projects a Client Member or Client Viewer can open. */
const AssignProjectsModal: React.FC<{ user: ClientOrgUserV2 | null; onClose: () => void }> = ({ user, onClose }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const query = useGetOrgUserProjectsQuery(user?.id ?? '', { skip: !user });
  const [save, { isLoading: isSaving }] = useSetOrgUserProjectsMutation();
  const [selected, setSelected] = useState<string[]>([]);
  const projects = query.data?.projects ?? [];

  useEffect(() => {
    if (query.data) setSelected(query.data.projects.filter(project => project.assigned).map(project => project.id));
  }, [query.data, user?.id]);

  const submit = async () => {
    if (!user) return;
    try {
      await save({ id: user.id, project_ids: selected }).unwrap();
      void message.success(t('account.org.projectsSaved', { name: decodeHtmlEntities(user.name), defaultValue: 'Project access updated for {{name}}.' }));
      onClose();
    } catch (error) {
      void message.error(errorMessage(error) ?? t('account.org.saveFailed', { defaultValue: 'We could not save your changes.' }));
    }
  };

  return (
    <Modal
      open={user !== null}
      onCancel={onClose}
      width={460}
      title={t('account.org.assignTitle', { name: decodeHtmlEntities(user?.name), defaultValue: 'Assign projects to {{name}}' })}
      okText={t('common.save', { defaultValue: 'Save' })}
      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
      okButtonProps={{ loading: isSaving, disabled: query.isLoading || query.isError }}
      onOk={() => void submit()}
    >
      {query.isError ? (
        <Alert
          type="error"
          showIcon
          message={t('account.org.projectsLoadFailed', { defaultValue: 'We could not load the projects.' })}
          action={<Button size="small" onClick={() => void query.refetch()}>{t('common.retry', { defaultValue: 'Retry' })}</Button>}
        />
      ) : query.isLoading ? (
        <Typography.Text type="secondary">{t('common.loading', { defaultValue: 'Loading…' })}</Typography.Text>
      ) : projects.length === 0 ? (
        <Typography.Text type="secondary">
          {t('account.org.noProjectsToAssign', { defaultValue: 'There are no projects to assign yet. Your project contact can share a project with your organization.' })}
        </Typography.Text>
      ) : (
        <>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            {t('account.org.assignHint', { defaultValue: 'They can open only the projects you tick. Clearing a project ends their access to it straight away.' })}
          </Typography.Paragraph>
          <Checkbox.Group value={selected} onChange={values => setSelected(values as string[])} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {projects.map(project => (
              <Checkbox key={project.id} value={project.id}>{decodeHtmlEntities(project.name)}</Checkbox>
            ))}
          </Checkbox.Group>
        </>
      )}
    </Modal>
  );
};

interface EditMemberModalProps {
  target: { user: ClientOrgUserV2; mode: 'edit' | 'role' } | null;
  roleLabel: (role: ClientRole | undefined) => string;
  onClose: () => void;
}

/** One small dialog for both "Edit" (name) and "Change role". */
const EditMemberModal: React.FC<EditMemberModalProps> = ({ target, roleLabel, onClose }) => {
  const { t } = useTranslation();
  const message = useMessage();
  const [update, { isLoading }] = useUpdateOrgUserMutation();
  const [name, setName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [role, setRole] = useState<ClientRole>('viewer');
  const isRoleMode = target?.mode === 'role';

  useEffect(() => {
    if (target) {
      setName(decodeHtmlEntities(target.user.name));
      setJobTitle(target.user.jobTitle);
      setRole(target.user.role);
    }
  }, [target]);

  const save = async () => {
    if (!target) return;
    try {
      await update(isRoleMode ? { id: target.user.id, role } : { id: target.user.id, name: name.trim(), job_title: jobTitle.trim() }).unwrap();
      void message.success(t('account.org.saved', { defaultValue: 'Changes saved.' }));
      onClose();
    } catch (error) {
      void message.error(errorMessage(error) ?? t('account.org.saveFailed', { defaultValue: 'We could not save your changes.' }));
    }
  };

  return (
    <Modal
      open={target !== null}
      onCancel={onClose}
      width={420}
      title={
        isRoleMode
          ? t('account.org.changeRoleTitle', { name: decodeHtmlEntities(target?.user.name), defaultValue: 'Change role for {{name}}' })
          : t('account.org.editTitle', { defaultValue: 'Edit member' })
      }
      okText={t('common.save', { defaultValue: 'Save' })}
      cancelText={t('common.cancel', { defaultValue: 'Cancel' })}
      okButtonProps={{ loading: isLoading, disabled: isRoleMode ? role === target?.user.role : !name.trim() }}
      onOk={() => void save()}
    >
      {isRoleMode ? (
        <Select<ClientRole>
          style={{ width: '100%' }}
          value={role}
          onChange={setRole}
          aria-label={t('account.org.role', { defaultValue: 'Role' })}
          options={ROLES.map(value => ({ value, label: roleLabel(value) }))}
        />
      ) : (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
            {t('account.org.name', { defaultValue: 'Name' })}
          </Typography.Text>
          <Input
            value={name}
            aria-label={t('account.org.name', { defaultValue: 'Name' })}
            onChange={event => setName(event.target.value)}
            onPressEnter={() => name.trim() && void save()}
          />
          <Typography.Text strong style={{ display: 'block', margin: '12px 0 4px' }}>
            {t('account.org.jobTitle', { defaultValue: 'Job title' })}
          </Typography.Text>
          <Input value={jobTitle} aria-label={t('account.org.jobTitle', { defaultValue: 'Job title' })} onChange={event => setJobTitle(event.target.value)} />
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>
            {target?.user.email}
          </Typography.Text>
        </>
      )}
    </Modal>
  );
};

export default MembersSettings;
