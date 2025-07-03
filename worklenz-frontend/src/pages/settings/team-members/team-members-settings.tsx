import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  SearchOutlined,
  SyncOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
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
  Tooltip,
  Typography,
} from 'antd';
import { createPortal } from 'react-dom';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import UpdateMemberDrawer from '@/components/settings/update-member-drawer';
import {
  toggleInviteMemberDrawer,
  toggleUpdateMemberDrawer,
} from '@features/settings/member/memberSlice';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { colors } from '@/styles/colors';

const TeamMembersSettings = () => {
  const { t } = useTranslation('settings/team-members');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const refreshTeamMembers = useAppSelector(state => state.memberReducer.refreshTeamMembers); // Listen to refresh flag

  const [model, setModel] = useState<ITeamMembersViewModel>({ total: 0, data: [] });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
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
    switch (role?.toLowerCase()) {
      case 'owner':
        return colors.skyBlue;
      case 'member':
        return colors.lightGray;
      case 'admin':
        return colors.yellow;
      default:
        return colors.darkGray;
    }
  }, []);

  const columns: TableProps['columns'] = [
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
            <Typography.Text style={{ color: colors.yellow }}>
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
      key: 'actionBtns',
      width: 120,
      render: (record: ITeamMemberViewModel) =>
        record.role_name !== 'owner' && (
          <Flex gap={8} style={{ padding: 0 }}>
            <Tooltip title={t('editTooltip')}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => record.id && handleMemberClick(record.id)}
              />
            </Tooltip>
            <Tooltip title={record.active ? t('deactivateTooltip') : t('activateTooltip')}>
              <Popconfirm
                title={t('confirmActivateTitle')}
                icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                okText={t('okText')}
                cancelText={t('cancelText')}
                onConfirm={() => handleStatusChange(record)}
              >
                <Button size="small" icon={<UserSwitchOutlined />} />
              </Popconfirm>
            </Tooltip>
            <Tooltip title={t('deleteTooltip')}>
              <Popconfirm
                title={t('confirmDeleteTitle')}
                icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                okText={t('okText')}
                cancelText={t('cancelText')}
                onConfirm={() => record.id && handleDeleteMember(record)}
              >
                <Button size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Flex>
        ),
    },
  ];

  return (
    <div style={{ width: '100%' }}>
      <Flex align="center" justify="space-between" style={{ marginBlockEnd: 24 }}>
        <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
          {model.total} {model.total !== 1 ? t('membersCountPlural') : t('memberCount')}
        </Typography.Title>
        <Flex gap={8} align="center" justify="flex-end" style={{ width: '100%', maxWidth: 400 }}>
          <Tooltip title={t('pinTooltip')}>
            <Button shape="circle" icon={<SyncOutlined />} onClick={handleRefresh} />
          </Tooltip>
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            style={{ maxWidth: 232 }}
            suffix={<SearchOutlined />}
          />
          <Button type="primary" onClick={() => dispatch(toggleInviteMemberDrawer())}>
            {t('addMemberButton')}
          </Button>
        </Flex>
      </Flex>
      <Card style={{ width: '100%' }}>
        <Table
          columns={columns}
          size="small"
          dataSource={model.data}
          rowKey={record => record.id}
          onChange={handleTableChange}
          loading={isLoading}
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
      {createPortal(
        <UpdateMemberDrawer selectedMemberId={selectedMemberId} onRoleUpdate={handleRoleUpdate} />,
        document.body
      )}
    </div>
  );
};

export default TeamMembersSettings;
