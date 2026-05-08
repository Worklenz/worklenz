import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  MoreOutlined,
  SearchOutlined,
  SyncOutlined,
  UserSwitchOutlined,
  UsergroupAddOutlined,
} from '@/shared/antd-imports';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dropdown,
  Flex,
  Input,
  MenuProps,
  Popconfirm,
  Table,
  TableProps,
  Tag,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import UpdateMemberDrawer from '@/components/settings/update-member-drawer';
import { BulkAssignManagerDrawer } from '@/components/settings/bulk-assign-manager-drawer';
import {
  toggleInviteMemberDrawer,
  toggleUpdateMemberDrawer,
} from '@features/settings/member/memberSlice';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { teamManagementApiService } from '@/api/team-management/team-management.api.service';
import { colors } from '@/styles/colors';
import { getRoleColor } from '@/types/roles/role.types';
import { canManageUserRole } from '@/utils/role-permissions.utils';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import './team-members-settings.css';

const TeamMembersSettings = () => {
  const { t } = useTranslation('settings/team-members');
  const { t: tCommon } = useTranslation('common');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const isInviteRestricted = Boolean(currentSession?.is_expired);
  const refreshTeamMembers = useAppSelector(state => state.memberReducer.refreshTeamMembers);

  useDocumentTitle(t('title') || 'Team Members');

  const [model, setModel] = useState<ITeamMembersViewModel>({ total: 0, data: [] });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberRole, setSelectedMemberRole] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<ITeamMemberViewModel[]>([]);
  const [isBulkAssignDrawerVisible, setBulkAssignDrawerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'asc',
  });

  // ── Inline name editing state ────────────────────────────────────────────
  // Which row is currently being edited (by member id)
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  // Live value of the name input
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  // Prevents blur from double-committing after Enter/Escape
  const committingRef = useRef(false);
  // ────────────────────────────────────────────────────────────────────────

  const getTeamMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.get(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (res.done) {
        setModel(res.body);
      }
    } catch (error) {
      console.error('Error fetching team members:', error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination, searchQuery]);

  const handleStatusChange = async (record: ITeamMemberViewModel) => {
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.toggleMemberActiveStatus(
        record.id || '',
        record.active as boolean,
        record.email || ''
      );
      if (res.done) {
        await getTeamMembers();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMember = async (record: ITeamMemberViewModel) => {
    if (!record.id) return;
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.delete(record.id);
      if (res.done) {
        await getTeamMembers();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleUpdate = useCallback((memberId: string, newRoleName: string) => {
    setModel(prevModel => ({
      ...prevModel,
      data: prevModel.data?.map(member =>
        member.id === memberId ? { ...member, role_name: newRoleName } : member
      ),
    }));
  }, []);

  const handleJobTitleUpdate = useCallback((memberId: string, newJobTitle: string) => {
    setModel(prevModel => ({
      ...prevModel,
      data: prevModel.data?.map(member =>
        member.id === memberId ? { ...member, job_title: newJobTitle } : member
      ),
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    getTeamMembers().finally(() => setIsLoading(false));
  }, [getTeamMembers]);

  const handleMemberClick = useCallback(
    (memberId: string, roleName?: string, memberName?: string) => {
      // Don't open the drawer if we're currently editing a name inline
      if (editingNameId) return;
      setSelectedMemberId(memberId);
      setSelectedMemberRole(roleName || null);
      setSelectedMemberName(memberName || null);
      dispatch(toggleUpdateMemberDrawer());
    },
    [dispatch, editingNameId]
  );

  // ── Inline name editing helpers ──────────────────────────────────────────

  const commitNameEdit = useCallback(
    async (memberId: string) => {
      committingRef.current = true;
      const trimmed = editingNameValue.trim();

      if (trimmed) {
        try {
          // Optimistically update the local model for instant feedback
          setModel(prev => ({
            ...prev,
            data: prev.data?.map(m => (m.id === memberId ? { ...m, name: trimmed } : m)),
          }));

          const res = await teamMembersApiService.updateMemberName(memberId, trimmed);

          // Always refresh from server so the persisted value (from team_member_info_view)
          // is what's shown — the optimistic update above just prevents a visible flash
          if (res.done) {
            await getTeamMembers();
          } else {
            // API returned done: false — revert to server state
            await getTeamMembers();
          }
        } catch (err) {
          console.error('Failed to update member name', err);
          // Revert on any error
          await getTeamMembers();
        }
      }

      setEditingNameId(null);
      setEditingNameValue('');
      setTimeout(() => {
        committingRef.current = false;
      }, 0);
    },
    [editingNameValue, getTeamMembers]
  );

  const cancelNameEdit = useCallback(() => {
    committingRef.current = true;
    setEditingNameId(null);
    setEditingNameValue('');
    setTimeout(() => {
      committingRef.current = false;
    }, 0);
  }, []);

  const handleNameBlur = useCallback(
    (memberId: string) => {
      if (committingRef.current) return;
      commitNameEdit(memberId);
    },
    [commitNameEdit]
  );

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent, memberId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitNameEdit(memberId);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelNameEdit();
      }
    },
    [commitNameEdit, cancelNameEdit]
  );

  // ────────────────────────────────────────────────────────────────────────

  const handleBulkAssignManager = () => {
    setBulkAssignDrawerVisible(true);
  };

  const handleMemberSelection = (
    selectedRowKeys: React.Key[],
    selectedRows: ITeamMemberViewModel[]
  ) => {
    setSelectedMembers(selectedRows);
  };

  const handleBulkAssignComplete = () => {
    setSelectedMembers([]);
    getTeamMembers();
  };

  const handleRemoveTeamLeadAssignment = async (member: ITeamMemberViewModel) => {
    if (!member.id) return;

    try {
      setIsLoading(true);
      const res = await teamManagementApiService.removeManagerAssignment(member.id);
      if (res.done) {
        await getTeamMembers();
      }
    } catch (error) {
      console.error('Error removing team lead assignment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableChange = useCallback(
    (newPagination: any, filters: any, sorter: any) => {
      let field = 'name';
      if (sorter.field) {
        field = Array.isArray(sorter.field) ? sorter.field[0] : sorter.field;
      }

      const order = sorter.order ? (sorter.order === 'ascend' ? 'asc' : 'desc') : pagination.order;

      setPagination(prev => ({
        ...prev,
        current: newPagination.current,
        pageSize: newPagination.pageSize,
        field: field,
        order: order,
      }));
    },
    [pagination]
  );

  useEffect(() => {
    if (socket) {
      const handleRoleChange = (data: { memberId: string; role_name: string }) => {
        handleRoleUpdate(data.memberId, data.role_name);
      };
      socket.on(SocketEvents.TEAM_MEMBER_ROLE_CHANGE.toString(), handleRoleChange);
      return () => {
        socket.off(SocketEvents.TEAM_MEMBER_ROLE_CHANGE.toString(), handleRoleChange);
      };
    }
  }, [socket, handleRoleUpdate]);

  useEffect(() => {
    handleRefresh();
  }, [refreshTeamMembers, handleRefresh]);

  useEffect(() => {
    getTeamMembers();
  }, [getTeamMembers]);

  const getColor = useCallback((role: string | undefined) => {
    return getRoleColor(role || '');
  }, []);

  const currentUser = auth.getCurrentSession();
  const currentUserRoleName: string | undefined = (currentUser as unknown as { role_name?: string })
    ?.role_name;
  const effectiveRole = (currentUserRoleName || auth.role || '').toLowerCase();
  const canManageUser = useCallback(
    (targetRole: string | undefined) => {
      if (currentUser?.is_admin && !currentUser?.owner) {
        return targetRole?.toLowerCase() !== 'owner';
      }
      return canManageUserRole(effectiveRole, targetRole, currentUser?.owner);
    },
    [effectiveRole, currentUser?.owner, currentUser?.is_admin]
  );
  const isPrivilegedUser =
    !!currentUser?.owner || ['admin', 'owner', 'team lead'].includes(effectiveRole);

  const startEditingName = useCallback(
    (e: React.MouseEvent, record: ITeamMemberViewModel) => {
      // Only owners and admins can edit names
      if (!isPrivilegedUser) return;
      // Pending invitations have no confirmed name to edit yet
      if (record.pending_invitation) return;

      e.stopPropagation();
      setEditingNameId(record.id || null);
      setEditingNameValue(record.name || '');
    },
    [isPrivilegedUser]
  );

  const getActionMenuItems = useCallback(
    (record: ITeamMemberViewModel): MenuProps['items'] => {
      const canManage = canManageUser(record.role_name);

      const menuItems = [
        {
          key: 'edit',
          label: t('editTooltip'),
          icon: <EditOutlined />,
          disabled: !canManage,
          onClick: () => canManage && record.id && handleMemberClick(record.id, record.role_name),
        },
        {
          key: 'status',
          label: record.active ? t('deactivateTooltip') : t('activateTooltip'),
          icon: <UserSwitchOutlined />,
          disabled: !canManage,
          onClick: () => {
            if (canManage) {
              return;
            }
          },
        },
        {
          key: 'delete',
          label: t('deleteTooltip'),
          icon: <DeleteOutlined />,
          disabled: !canManage,
          danger: true,
          onClick: () => {
            if (canManage && record.id) {
              return;
            }
          },
        },
      ];

      return menuItems;
    },
    [t, canManageUser, handleMemberClick]
  );

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('nameColumn'),
        defaultSortOrder: 'ascend',
        sorter: true,
        // Row-level click is handled inside the cell to avoid conflicts with inline editing
        render: (_, record: ITeamMemberViewModel) => {
          const isEditing = editingNameId === record.id;
          const isPending = record.pending_invitation;
          const canEdit = isPrivilegedUser && !isPending;

          return (
            <Typography.Text
              style={{
                textTransform: 'capitalize',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
              // Open drawer when clicking non-editable parts of the row
              onClick={() => !isEditing && handleMemberClick(record.id || '', record.role_name, record.name)}
            >
              <Avatar
                size={28}
                src={record.avatar_url}
                style={{ backgroundColor: record.color_code }}
              >
                {record.name?.charAt(0)}
              </Avatar>

              {isEditing ? (
                // ── Inline edit input ──
                <Input
                  autoFocus
                  size="small"
                  value={editingNameValue}
                  style={{ width: 160, textTransform: 'none' }}
                  onChange={e => setEditingNameValue(e.target.value)}
                  onBlur={() => handleNameBlur(record.id || '')}
                  onKeyDown={e => handleNameKeyDown(e, record.id || '')}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                // ── Display name (click to edit if privileged) ──
                <Tooltip
                  title={
                    canEdit
                      ? t('clickToEditName', { defaultValue: 'Click name to edit' })
                      : isPending
                        ? t('pendingInvitationText')
                        : undefined
                  }
                  mouseEnterDelay={0.6}
                >
                  <span
                    style={{
                      cursor: canEdit ? 'text' : 'pointer',
                      borderBottom: canEdit ? '1px dashed #d9d9d9' : 'none',
                      paddingBottom: canEdit ? 1 : 0,
                    }}
                    onClick={e => canEdit && startEditingName(e, record)}
                  >
                    {record.name}
                  </span>
                </Tooltip>
              )}

              {record.is_online && <Badge color={colors.limeGreen} />}
              {!record.active && (
                <Typography.Text style={{ color: colors.vibrantOrange, fontWeight: 500 }}>
                  {t('deactivatedText')}
                </Typography.Text>
              )}
            </Typography.Text>
          );
        },
      },
      {
        key: 'projects_count',
        dataIndex: 'projects_count',
        title: t('projectsColumn'),
        sorter: true,
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: 'pointer' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <Typography.Text>{record.projects_count}</Typography.Text>
        ),
      },
      {
        key: 'email',
        dataIndex: 'email',
        title: t('emailColumn'),
        sorter: true,
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: 'pointer' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <div>
            <Typography.Text>{record.email}</Typography.Text>
            {record.pending_invitation && (
              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {t('pendingInvitationText')}
              </Typography.Text>
            )}
          </div>
        ),
      },
      {
        key: 'job_title',
        dataIndex: 'job_title',
        title: t('jobTitleColumn'),
        sorter: true,
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: 'pointer' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <Typography.Text>
            {record.job_title || (
              <Typography.Text type="secondary">Select a Job Title</Typography.Text>
            )}
          </Typography.Text>
        ),
      },
      {
        key: 'role_name',
        dataIndex: 'role_name',
        title: t('teamAccessColumn'),
        sorter: true,
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: 'pointer' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <Flex gap={16} align="center">
            <Typography.Text
              style={{
                color: getColor(record.role_name),
                textTransform: 'capitalize',
              }}
            >
              {record.role_name}
            </Typography.Text>
          </Flex>
        ),
      },
      {
        key: 'team_lead_assignment',
        title: 'Team Lead',
        render: (_, record: ITeamMemberViewModel) => {
          if (
            record.role_name === 'Team Lead' ||
            record.role_name === 'Admin' ||
            record.role_name === 'Owner'
          ) {
            return <Typography.Text type="secondary">-</Typography.Text>;
          }

          if (record.reports_to_member_id && record.current_team_lead_name) {
            return (
              <Flex align="center" gap={8}>
                <Tag color="blue" style={{ margin: 0 }}>
                  {record.current_team_lead_name}
                </Tag>
                {isPrivilegedUser && (
                  <Button
                    size="small"
                    type="text"
                    danger
                    onClick={e => {
                      e.stopPropagation();
                      handleRemoveTeamLeadAssignment(record);
                    }}
                    style={{ padding: '0 4px', height: 'auto' }}
                  >
                    ×
                  </Button>
                )}
              </Flex>
            );
          }

          return (
            <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
              Unassigned
            </Typography.Text>
          );
        },
      },
      {
        key: 'actionBtns',
        width: 60,
        render: (record: ITeamMemberViewModel) => {
          const canManage = canManageUser(record.role_name);

          if (!isPrivilegedUser) return null;

          const menuItems = getActionMenuItems(record);

          const customMenuItems =
            menuItems?.map(item => {
              if (item?.key === 'status') {
                return {
                  ...item,
                  label: (
                    <Popconfirm
                      title={t('confirmActivateTitle')}
                      icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                      okText={t('okText')}
                      cancelText={t('cancelText')}
                      onConfirm={() => canManage && handleStatusChange(record)}
                      disabled={!canManage}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {record.active ? t('deactivateTooltip') : t('activateTooltip')}
                      </div>
                    </Popconfirm>
                  ),
                  onClick: undefined,
                };
              }

              if (item?.key === 'delete') {
                return {
                  ...item,
                  label: (
                    <Popconfirm
                      title={t('confirmDeleteTitle')}
                      icon={<ExclamationCircleFilled />}
                      okText={t('okText')}
                      cancelText={t('cancelText')}
                      onConfirm={() => canManage && record.id && handleDeleteMember(record)}
                      disabled={!canManage}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {t('deleteTooltip')}
                      </div>
                    </Popconfirm>
                  ),
                  onClick: undefined,
                };
              }

              return item;
            }) || [];

          return (
            <Dropdown menu={{ items: customMenuItems }} trigger={['click']} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
            </Dropdown>
          );
        },
      },
    ],
    [
      t,
      isPrivilegedUser,
      effectiveRole,
      currentUser?.owner,
      getActionMenuItems,
      canManageUser,
      handleStatusChange,
      handleDeleteMember,
      handleMemberClick,
      editingNameId,
      editingNameValue,
      startEditingName,
      handleNameBlur,
      handleNameKeyDown,
    ]
  );

  return (
    <>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="space-between" align="center">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {model.total} {model.total !== 1 ? t('membersCountPlural') : t('memberCount')}
            </Typography.Title>
            <Flex
              gap={8}
              align="center"
              justify="flex-end"
              style={{ width: '100%', maxWidth: 500 }}
            >
              <Tooltip title={t('pinTooltip')}>
                <Button shape="circle" icon={<SyncOutlined />} onClick={handleRefresh} />
              </Tooltip>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('search', { defaultValue: 'Search' })}
                style={{ maxWidth: 250 }}
                suffix={<SearchOutlined />}
              />
              <Tooltip
                title={
                  isInviteRestricted
                    ? tCommon('license-expired-subtitle', {
                      defaultValue:
                        'Your Worklenz subscription has ended. Please renew to continue enjoying all features.',
                    })
                    : ''
                }
              >
                <Button
                  type="primary"
                  disabled={isInviteRestricted}
                  onClick={() => {
                    if (isInviteRestricted) return;
                    dispatch(toggleInviteMemberDrawer());
                  }}
                >
                  {t('addMemberButton', { defaultValue: 'Add New Member' })}
                </Button>
              </Tooltip>
              <Tooltip title={t('pinTooltip')} trigger={'hover'}>
                <PinRouteToNavbarButton
                  name={t('title')}
                  path="/worklenz/settings/team-members"
                  adminOnly
                />
              </Tooltip>
            </Flex>
          </Flex>
        }
      >
        <Table
          columns={columns}
          size="small"
          dataSource={model.data}
          rowKey={record => record.id}
          rowClassName={() => 'team-member-row'}
          onChange={handleTableChange}
          loading={isLoading}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedMembers
              .map(member => member.id)
              .filter((id): id is string => Boolean(id)),
            onChange: handleMemberSelection,
            getCheckboxProps: record => ({
              disabled:
                record.role_name === 'Owner' ||
                record.role_name === 'Admin' ||
                record.role_name === 'Team Lead',
              name: record.name,
            }),
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            showSizeChanger: true,
            defaultPageSize: DEFAULT_PAGE_SIZE,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            size: 'small',
            total: model.total,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* Floating Action Button for Bulk Assign */}
      {isPrivilegedUser && selectedMembers.length > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            borderRadius: '8px',
          }}
        >
          <Button
            type="primary"
            size="large"
            icon={<UsergroupAddOutlined />}
            onClick={handleBulkAssignManager}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '16px',
              paddingRight: '16px',
              height: '48px',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            {t('bulk_assign_team_lead')} ({selectedMembers.length})
          </Button>
        </div>
      )}

      <BulkAssignManagerDrawer
        open={isBulkAssignDrawerVisible}
        onClose={() => setBulkAssignDrawerVisible(false)}
        selectedMembers={selectedMembers}
        onAssignmentComplete={handleBulkAssignComplete}
      />
      {createPortal(
        <UpdateMemberDrawer
          selectedMemberId={selectedMemberId}
          selectedMemberName={selectedMemberName}
          onRoleUpdate={handleRoleUpdate}
          onJobTitleUpdate={handleJobTitleUpdate}
          initialRoleName={selectedMemberRole || undefined}
        />,
        document.body
      )}
    </>
  );
};

export default TeamMembersSettings;