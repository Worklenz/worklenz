import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  MoreOutlined,
  SearchOutlined,
  SyncOutlined,
  UserSwitchOutlined,
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
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAuthService } from '@/hooks/useAuth';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '@/shared/constants';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import { colors } from '@/styles/colors';
import { ROLE_NAMES } from '@/types/roles/role.types';
import PinRouteToNavbarButton from '@components/PinRouteToNavbarButton';
import { message } from '@/shared/antd-imports';
import { fetchBillingInfo } from '@/features/admin-center/admin-center.slice';
import './guest-members-settings.css';

interface IGuestMemberViewModel extends ITeamMemberViewModel {
  project_name?: string;
  project_names?: string;
  project_id?: string;
  is_online?: boolean;
}

const GuestMembersSettings = () => {
  const { t } = useTranslation('settings/guest-members');
  const { t: tCommon } = useTranslation('common');
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();

  useDocumentTitle(t('title', { defaultValue: 'Guest Members' }));

  const [model, setModel] = useState<ITeamMembersViewModel>({ total: 0, data: [] });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'name',
    order: 'asc',
  });

  const getGuestMembers = useCallback(async () => {
    try {
      setIsLoading(true);
      // This will fetch all guest members across projects
      // Backend endpoint: GET /api/v1/project-members/guests
      const res = await projectMembersApiService.getGuestMembers(
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        searchQuery
      );
      if (res.done) {
        setModel(res.body);
      } else {
        // Handle error response from API
        message.error(res.message || 'Failed to fetch guest members');
        setModel({ total: 0, data: [] });
      }
    } catch (error: unknown) {
      console.error('Error fetching guest members:', error);
      const errorMessage = error instanceof Error ? error.message : undefined;
      message.error(errorMessage || t('fetchFailed', { defaultValue: 'Failed to fetch guest members' }));
      setModel({ total: 0, data: [] });
    } finally {
      setIsLoading(false);
    }
  }, [pagination, searchQuery, t]);

  useEffect(() => {
    dispatch(fetchBillingInfo());
  }, [dispatch]);

  const handleStatusChange = async (record: IGuestMemberViewModel) => {
    try {
      setIsLoading(true);
      
      // Toggle guest member status (deactivate/activate)
      const res = await projectMembersApiService.toggleGuestStatus(
        record.id || '',
        record.active as boolean,
        record.email || ''
      );

      if (res.done) {
        await getGuestMembers();
        dispatch(fetchBillingInfo());
        message.success(
          record.active
            ? t('guestDeactivatedSuccess', { defaultValue: 'Guest member deactivated successfully' })
            : t('guestActivatedSuccess', { defaultValue: 'Guest member activated successfully' })
        );
      } else {
        message.error(res.message || t('actionFailed', { defaultValue: 'Action failed' }));
      }
    } catch (error) {
      message.error(t('errorOccurred', { defaultValue: 'An error occurred' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMember = async (record: IGuestMemberViewModel) => {
    if (!record.id) return;
    try {
      setIsLoading(true);
      
      // Delete guest member
      const res = await projectMembersApiService.deleteGuestMember(record.id);
      if (res.done) {
        await getGuestMembers();
        dispatch(fetchBillingInfo());
        message.success(
          t('guestDeletedSuccess', { defaultValue: 'Guest member removed successfully' })
        );
      } else {
        message.error(res.message || t('actionFailed', { defaultValue: 'Action failed' }));
      }
    } catch (error) {
      message.error(t('errorOccurred', { defaultValue: 'An error occurred' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    getGuestMembers().finally(() => setIsLoading(false));
  }, [getGuestMembers]);

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
    getGuestMembers();
  }, [getGuestMembers]);

  const effectiveRole = currentSession?.role_name || ROLE_NAMES.MEMBER;
  const isPrivilegedUser =
    effectiveRole === ROLE_NAMES.OWNER || effectiveRole === ROLE_NAMES.ADMIN;

  const getActionMenuItems = useCallback(
    (record: IGuestMemberViewModel): MenuProps['items'] => {
      const menuItems = [
        {
          key: 'status',
          label: record.active
            ? t('deactivateTooltip', { defaultValue: 'Deactivate' })
            : t('activateTooltip', { defaultValue: 'Activate' }),
          icon: <UserSwitchOutlined />,
          disabled: !isPrivilegedUser,
        },
        {
          key: 'delete',
          label: t('deleteTooltip', { defaultValue: 'Delete' }),
          icon: <DeleteOutlined />,
          disabled: !isPrivilegedUser,
          danger: true,
        },
      ];

      return menuItems;
    },
    [t, isPrivilegedUser]
  );

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('nameColumn', { defaultValue: 'Name' }),
        defaultSortOrder: 'ascend',
        sorter: true,
        render: (_, record: IGuestMemberViewModel) => (
          <Flex
            align="center"
            gap={8}
            style={{
              display: 'flex',
              width: '100%',
            }}
          >
            <Avatar
              size={28}
              src={record.avatar_url}
              style={{ backgroundColor: record.color_code }}
            >
              {record.name?.charAt(0)}
            </Avatar>

            <Flex vertical gap={2} style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  width: 'fit-content',
                }}
              >
                {record.name}
              </span>

              {!record.active && (
                <Typography.Text style={{ color: colors.vibrantOrange, fontWeight: 500 }}>
                  {t('deactivatedText', { defaultValue: 'Deactivated' })}
                </Typography.Text>
              )}
            </Flex>

            {record.is_online && <Badge color={colors.limeGreen} />}
          </Flex>
        ),
      },
      {
        key: 'email',
        dataIndex: 'email',
        title: t('emailColumn', { defaultValue: 'Email' }),
        sorter: true,
        render: (_, record: IGuestMemberViewModel) => (
          <div>
            <Typography.Text>{record.email}</Typography.Text>
          </div>
        ),
      },
      {
        key: 'projects_count',
        dataIndex: 'projects_count',
        title: t('projectsColumn', { defaultValue: 'Projects' }),
        sorter: true,
        render: (_, record: IGuestMemberViewModel) => {
          const projectCount = Number(record.projects_count ?? 0);
          const projectNames = record.project_names || record.project_name || '';

          return (
            <Tooltip title={projectNames || t('noneText', { defaultValue: 'None' })}>
              <Typography.Text>{projectCount > 0 ? projectCount : t('noneText', { defaultValue: 'None' })}</Typography.Text>
            </Tooltip>
          );
        },
      },
      {
        key: 'team_access',
        dataIndex: 'team_access',
        title: t('teamAccessColumn', { defaultValue: 'Team Access' }),
        sorter: true,
        render: (_, record: IGuestMemberViewModel) => (
          <Typography.Text type="secondary">
            {record.team_access ? `${record.team_access} Access` : t('teamAccessEmpty', { defaultValue: 'Guest Access' })}
          </Typography.Text>
        ),
      },
      {
        key: 'actionBtns',
        width: 60,
        render: (record: IGuestMemberViewModel) => {
          if (!isPrivilegedUser) return null;

          const menuItems = getActionMenuItems(record);

          const customMenuItems =
            menuItems?.map(item => {
              if (item?.key === 'status') {
                return {
                  ...item,
                  label: (
                    <Popconfirm
                      title={t('confirmToggleTitle', { defaultValue: 'Confirm Status Change' })}
                      icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                      okText={t('okText', { defaultValue: 'OK' })}
                      cancelText={t('cancelText', { defaultValue: 'Cancel' })}
                      onConfirm={() => handleStatusChange(record)}
                      disabled={!isPrivilegedUser}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {record.active
                          ? t('deactivateTooltip', { defaultValue: 'Deactivate' })
                          : t('activateTooltip', { defaultValue: 'Activate' })}
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
                      title={t('confirmDeleteTitle', { defaultValue: 'Confirm Deletion' })}
                      description={t('confirmDeleteDescription', {
                        defaultValue: 'This action cannot be undone.',
                      })}
                      icon={<ExclamationCircleFilled />}
                      okText={t('okText', { defaultValue: 'OK' })}
                      cancelText={t('cancelText', { defaultValue: 'Cancel' })}
                      onConfirm={() => handleDeleteMember(record)}
                      disabled={!isPrivilegedUser}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {t('deleteTooltip', { defaultValue: 'Delete' })}
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
    [t, isPrivilegedUser, getActionMenuItems, handleStatusChange, handleDeleteMember]
  );

  return (
    <Flex vertical gap={16}>
      <PinRouteToNavbarButton />

      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="space-between" align="center">
            <Typography.Title level={4} style={{ margin: 0 }}>
              {model.total} {model.total !== 1 ? t('guestCountPlural', { defaultValue: 'Guest Members' }) : t('guestCount', { defaultValue: 'Guest Member' })}
            </Typography.Title>
            <Flex
              gap={8}
              align="center"
              justify="flex-end"
              style={{ width: '100%', maxWidth: 500 }}
            >
              <Tooltip title={t('refreshTooltip', { defaultValue: 'Refresh' })}>
                <Button
                  shape="circle"
                  icon={<SyncOutlined spin={isLoading} />}
                  onClick={handleRefresh}
                />
              </Tooltip>
              <Input
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPagination(prev => ({ ...prev, current: 1 }));
                }}
                placeholder={t('searchPlaceholder', {
                  defaultValue: 'Search by name or email...',
                })}
                style={{ maxWidth: 250 }}
                suffix={<SearchOutlined />}
              />
            </Flex>
          </Flex>
        }
      >
        <Table
          rowKey="id"
          dataSource={model.data || []}
          columns={columns}
          loading={isLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: model.total,
            showSizeChanger: true,
            showTotal: total => `Total ${total} items`,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
          }}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
        />
      </Card>
    </Flex>
  );
};

export default GuestMembersSettings;
