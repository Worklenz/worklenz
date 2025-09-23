import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
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
  Flex,
  Input,
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
import { AssignManagerDrawer } from '@/components/settings/assign-manager-drawer';
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
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const auth = useAuthService();
  const refreshTeamMembers = useAppSelector(state => state.memberReducer.refreshTeamMembers); // Listen to refresh flag

  useDocumentTitle(t('title') || 'Team Members');

  const [model, setModel] = useState<ITeamMembersViewModel>({ total: 0, data: [] });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDrawerVisible, setDrawerVisible] = useState(false);
  const [isManagerDrawerVisible, setManagerDrawerVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<ITeamMemberViewModel | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<ITeamMemberViewModel[]>([]);
  const [isBulkAssignDrawerVisible, setBulkAssignDrawerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'asc',
  });

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

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    getTeamMembers().finally(() => setIsLoading(false));
  }, [getTeamMembers]);

  const handleMemberClick = useCallback(
    (memberId: string) => {
      setSelectedMemberId(memberId);
      dispatch(toggleUpdateMemberDrawer());
    },
    [dispatch]
  );

  const handleAssignManager = (record: ITeamMemberViewModel) => {
    setSelectedMember(record);
    setManagerDrawerVisible(true);
  };

  const handleBulkAssignManager = () => {
    setBulkAssignDrawerVisible(true);
  };

  const handleMemberSelection = (selectedRowKeys: React.Key[], selectedRows: ITeamMemberViewModel[]) => {
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

  
  const handleTableChange = useCallback((newPagination: any, filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize,
      field: sorter.field || 'name',
      order: sorter.order === 'ascend' ? 'asc' : 'desc',
    }));
  }, []);

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
  const currentUserRoleName: string | undefined = (currentUser as unknown as { role_name?: string })?.role_name;
  const canManageUser = useCallback(
    (targetRole: string | undefined) => {
      return canManageUserRole(currentUserRoleName, targetRole, currentUser?.owner);
    },
    [currentUserRoleName, currentUser?.owner]
  );
  const effectiveRole = (currentUserRoleName || auth.role || '').toLowerCase();
  const isPrivilegedUser = !!currentUser?.owner || ['admin', 'owner', 'team lead'].includes(effectiveRole);

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('nameColumn'),
        defaultSortOrder: 'ascend',
        sorter: true,
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => handleMemberClick(record.id || ''),
          style: { cursor: 'pointer' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <Typography.Text
            style={{
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Avatar size={28} src={record.avatar_url} style={{ backgroundColor: record.color_code }}>
              {record.name?.charAt(0)}
            </Avatar>
            {record.name}
            {record.is_online && <Badge color={colors.limeGreen} />}
            {!record.active && (
              <Typography.Text style={{ color: colors.vibrantOrange, fontWeight: 500 }}>
                {t('deactivatedText')}
              </Typography.Text>
            )}
          </Typography.Text>
        ),
      },
      {
        key: 'projects_count',
        dataIndex: 'projects_count',
        title: t('projectsColumn'),
        sorter: true,
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => handleMemberClick(record.id || ''),
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
          onClick: () => handleMemberClick(record.id || ''),
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
          onClick: () => handleMemberClick(record.id || ''),
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
          if (record.role_name === 'Team Lead' || record.role_name === 'Admin' || record.role_name === 'Owner') {
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
                    onClick={(e) => {
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
        width: 120,
        render: (record: ITeamMemberViewModel) => {
          const canManage = canManageUser(record.role_name);
          return (
            isPrivilegedUser && (
              <Flex gap={8} style={{ padding: 0 }} className="action-buttons">
                <Tooltip title={t('editTooltip')}>
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    disabled={!canManage}
                    onClick={() => canManage && record.id && handleMemberClick(record.id)}
                  />
                </Tooltip>
                <Tooltip title={record.active ? t('deactivateTooltip') : t('activateTooltip')}>
                  <Popconfirm
                    title={t('confirmActivateTitle')}
                    icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                    okText={t('okText')}
                    cancelText={t('cancelText')}
                    onConfirm={() => canManage && handleStatusChange(record)}
                  >
                    <Button size="small" icon={<UserSwitchOutlined />} disabled={!canManage} />
                  </Popconfirm>
                </Tooltip>
                <Tooltip title={t('deleteTooltip')}>
                  <Popconfirm
                    title={t('confirmDeleteTitle')}
                    icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                    okText={t('okText')}
                    cancelText={t('cancelText')}
                    onConfirm={() => canManage && record.id && handleDeleteMember(record)}
                  >
                    <Button size="small" icon={<DeleteOutlined />} disabled={!canManage} />
                  </Popconfirm>
                </Tooltip>
                {record.role_name !== 'Owner' && record.role_name !== 'Admin' && record.role_name !== 'Team Lead' && (
                  <Tooltip title={t('assign_team_lead')}>
                    <Button
                      size='small'
                      icon={<UsergroupAddOutlined />}
                      onClick={() => handleAssignManager(record)}
                      disabled={!canManageUserRole(currentUserRoleName, record.role_name, currentUser?.owner)}
                    />
                  </Tooltip>
                )}
              </Flex>
            )
          );
        },
      },
    ],
    [t, isPrivilegedUser, currentUserRoleName, currentUser?.owner]
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
            <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 500 }}>
              <Tooltip title={t('pinTooltip')}>
                <Button shape="circle" icon={<SyncOutlined />} onClick={handleRefresh} />
              </Tooltip>
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                style={{ maxWidth: 250 }}
                suffix={<SearchOutlined />}
              />
              <Button type="primary" onClick={() => dispatch(toggleInviteMemberDrawer())}>
                {t('addMemberButton')}
              </Button>
              <Tooltip title={t('pinTooltip')} trigger={'hover'}>
                <PinRouteToNavbarButton
                  name="teamMembers"
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
            selectedRowKeys: selectedMembers.map(member => member.id).filter((id): id is string => Boolean(id)),
            onChange: handleMemberSelection,
            getCheckboxProps: (record) => ({
              disabled: record.role_name === 'Owner' || record.role_name === 'Admin' || record.role_name === 'Team Lead',
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
      
      <AssignManagerDrawer
        open={isManagerDrawerVisible}
        onClose={() => setManagerDrawerVisible(false)}
        member={selectedMember}
        onManagerAssigned={getTeamMembers}
      />
      <BulkAssignManagerDrawer
        open={isBulkAssignDrawerVisible}
        onClose={() => setBulkAssignDrawerVisible(false)}
        selectedMembers={selectedMembers}
        onAssignmentComplete={handleBulkAssignComplete}
      />
      {createPortal(
        <UpdateMemberDrawer selectedMemberId={selectedMemberId} onRoleUpdate={handleRoleUpdate} />,
        document.body
      )}
    </>
  );
};

export default TeamMembersSettings;
