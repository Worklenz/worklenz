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
import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { teamManagementApiService } from '@/api/team-management/team-management.api.service';
import { colors } from '@/styles/colors';
import { getRoleColor, ROLE_DEFINITIONS, ROLE_NAMES } from '@/types/roles/role.types';
import {
  canManageUserRole,
  getSessionRoleName,
  normalizeRoleName,
} from '@/utils/role-permissions.utils';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import { message } from '@/shared/antd-imports';
import { SeatLimitModal } from '@/components/common/seat-limit-modal/SeatLimitModal';
import { toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
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

  useDocumentTitle(t('title', { defaultValue: 'Team Members' }));

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
  const [seatLimitModalOpen, setSeatLimitModalOpen] = useState(false);
  const [seatLimitData, setSeatLimitData] = useState<{
    current_members: number;
    plan_seat_limit: number;
    business_plan_limit: number;
    is_appsumo_user: boolean;
  } | null>(null);

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
      // Error fetching team members
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

      // When re-activating a member, the backend may reject due to seat limit
      if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
        setSeatLimitData(res.body);
        setSeatLimitModalOpen(true);
        return;
      }

      if (res.done) {
        await getTeamMembers();
        
        // Check for pending team invite and auto-send after deactivation
        const pendingTeamInvite = localStorage.getItem('pendingTeamInvite');
        if (pendingTeamInvite && !record.active) {
          try {
            const inviteData = JSON.parse(pendingTeamInvite);
            const inviteRes = await teamMembersApiService.createTeamMember(inviteData);
            if (inviteRes.done) {
              message.success(t('memberDeactivatedInviteSent', { 
                defaultValue: 'Member deactivated. Your invite has been sent.' 
              }));
              localStorage.removeItem('pendingTeamInvite');
            }
          } catch (error) {
            // Error sending pending invite
            localStorage.removeItem('pendingTeamInvite');
          }
        }
        
        // Check for pending project invite and auto-send after deactivation
        const pendingProjectInvite = localStorage.getItem('pendingProjectInvite');
        if (pendingProjectInvite && !record.active) {
          try {
            const inviteData = JSON.parse(pendingProjectInvite);
            // Send invites for each email in the pending project invite
            const invitePromises = inviteData.emails.map((email: string) => 
              projectMembersApiService.inviteByEmail({
                email: email.trim(),
                project_id: inviteData.projectId,
                role_name: inviteData.access === 'team-lead' ? 'TEAM_LEAD' : 
                          inviteData.access === 'admin' ? 'ADMIN' : 'MEMBER',
                is_admin: inviteData.access === 'admin',
              })
            );
            await Promise.all(invitePromises);
            message.success(t('memberDeactivatedProjectInviteSent', { 
              defaultValue: `Member deactivated. Project invite sent for "${inviteData.projectName}".` 
            }));
            localStorage.removeItem('pendingProjectInvite');
          } catch (error) {
            // Error sending pending project invite
            localStorage.removeItem('pendingProjectInvite');
          }
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeatLimitUpgrade = () => {
    setSeatLimitModalOpen(false);
    setSeatLimitData(null);
    dispatch(toggleUpgradeModal());
  };

  const handleSeatLimitDeactivate = () => {
    setSeatLimitModalOpen(false);
    setSeatLimitData(null);
    // Scroll to the members table so the user can deactivate someone
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeatLimitModalClose = () => {
    setSeatLimitModalOpen(false);
    setSeatLimitData(null);
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
      setSelectedMemberId(memberId);
      setSelectedMemberRole(roleName || null);
      setSelectedMemberName(memberName || null);
      dispatch(toggleUpdateMemberDrawer());
    },
    [dispatch]
  );

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
      // Error removing team lead assignment
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
  const effectiveRole = getSessionRoleName(currentUser);
  const canManageUser = useCallback(
    (targetRole: string | undefined) => {
      if (effectiveRole === ROLE_NAMES.ADMIN) {
        return targetRole?.toLowerCase() !== 'owner';
      }
      return canManageUserRole(effectiveRole, targetRole, currentUser?.owner);
    },
    [effectiveRole, currentUser?.owner]
  );
  const isPrivilegedUser = effectiveRole === ROLE_NAMES.OWNER || effectiveRole === ROLE_NAMES.ADMIN;

  const getRoleLabel = useCallback(
    (roleName?: string) => {
      const roleDefinition = ROLE_DEFINITIONS[normalizeRoleName(roleName)];
      return t(roleDefinition.labelKey, { defaultValue: roleDefinition.labelDefaultValue });
    },
    [t]
  );

  const handleMemberNameUpdate = useCallback(
    (memberId: string, newName: string) => {
      setModel(prevModel => ({
        ...prevModel,
        data: prevModel.data?.map(member =>
          member.id === memberId ? { ...member, name: newName } : member
        ),
      }));
      setSelectedMemberName(currentName => (selectedMemberId === memberId ? newName : currentName));
    },
    [selectedMemberId]
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
        render: (_, record: ITeamMemberViewModel) => {
          const isPending = record.pending_invitation;
          const canEdit = isPrivilegedUser && !isPending;

          return (
            <Flex
              align="center"
              gap={8}
              style={{
                display: 'flex',
                width: '100%',
              }}
              onClick={() => handleMemberClick(record.id || '', record.role_name, record.name)}
            >
              <Avatar
                size={28}
                src={record.avatar_url}
                style={{ backgroundColor: record.color_code }}
              >
                {record.name?.charAt(0)}
              </Avatar>

              <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
                <Flex align="center" gap={4} className="team-member-name-row">
                  <Tooltip
                    title={
                      isPending
                        ? t('pendingInvitationText', { defaultValue: '(Invitation pending)' })
                        : undefined
                    }
                    mouseEnterDelay={0.6}
                  >
                    <span
                      style={{
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                        width: 'fit-content',
                      }}
                    >
                      {record.name}
                    </span>
                  </Tooltip>
                  {canEdit ? (
                    <Tooltip
                      title={t('renameMemberTooltip', {
                        defaultValue: 'Rename member',
                      })}
                    >
                      <Button
                        size="small"
                        type="text"
                        className="team-member-name-edit-button"
                        icon={<EditOutlined />}
                        onClick={event => {
                          event.stopPropagation();
                          handleMemberClick(record.id || '', record.role_name, record.name);
                        }}
                      />
                    </Tooltip>
                  ) : null}
                </Flex>

                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {record.job_title || t('jobTitleEmpty', { defaultValue: 'Select a job title' })}
                </Typography.Text>

                {!record.active && (
                  <Typography.Text style={{ color: colors.vibrantOrange, fontWeight: 500 }}>
                    {t('deactivatedText')}
                  </Typography.Text>
                )}
              </Flex>

              {record.is_online && <Badge color={colors.limeGreen} />}
            </Flex>
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
              {getRoleLabel(record.role_name)}
            </Typography.Text>
          </Flex>
        ),
      },
      {
        key: 'team_lead_assignment',
        title: t('teamLeadColumn', { defaultValue: 'Team Lead' }),
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
              {t('unassignedText', { defaultValue: 'Unassigned' })}
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
      currentUser?.owner,
      getActionMenuItems,
      canManageUser,
      getRoleLabel,
      handleStatusChange,
      handleDeleteMember,
      handleMemberClick,
    ]
  );

  return (
    <Flex vertical gap={16}>
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
                <Button
                  shape="circle"
                  icon={<SyncOutlined spin={isLoading} />}
                  onClick={handleRefresh}
                />
              </Tooltip>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder', {
                  defaultValue: 'Search members by name',
                })}
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
                  adminOnly={false}
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
            showTotal: (total, range) =>
              t('paginationTotal', {
                defaultValue: '{{start}}-{{end}} of {{total}} items',
                start: range[0],
                end: range[1],
                total,
              }),
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
          onNameUpdate={handleMemberNameUpdate}
          onRoleUpdate={handleRoleUpdate}
          onJobTitleUpdate={handleJobTitleUpdate}
          initialRoleName={selectedMemberRole || undefined}
        />,
        document.body
      )}

      {seatLimitData && (
        <SeatLimitModal
          open={seatLimitModalOpen}
          onClose={handleSeatLimitModalClose}
          currentMembers={seatLimitData.current_members}
          planLimit={seatLimitData.plan_seat_limit}
          businessLimit={seatLimitData.business_plan_limit}
          isAppSumoUser={seatLimitData.is_appsumo_user}
          onUpgrade={handleSeatLimitUpgrade}
          onDeactivate={handleSeatLimitDeactivate}
        />
      )}
    </Flex>
  );
};

export default TeamMembersSettings;
