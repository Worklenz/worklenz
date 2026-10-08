// Ant Design Components
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Flex,
  Input,
  message,
  Modal,
  Popover,
  Popconfirm,
  Progress,
  Skeleton,
  Table,
  TableProps,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';

// Icons
import { ExclamationCircleFilled, MoreOutlined, SyncOutlined } from '@/shared/antd-imports';

// React & Router
import { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Services & API
import { projectsApiService } from '@/api/projects/projects.api.service';
import { projectMembersApiService } from '@/api/project-members/project-members.api.service';
import UpdateMemberDrawer from '@/components/settings/update-member-drawer';
import TimeOffCalendar from '@/components/schedule/task-timeline/TimeOffCalendar';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { useAuthService } from '@/hooks/useAuth';

// Types
import { IProjectMembersViewModel, IProjectMemberViewModel } from '@/types/projectMember.types';

// Constants & Utils
import { DEFAULT_PAGE_SIZE } from '@/shared/constants';
import { colors } from '../../../../styles/colors';
import logger from '@/utils/errorLogger';

// Components
import EmptyListPlaceholder from '../../../../components/EmptyListPlaceholder';
import { useAppSelector } from '@/hooks/useAppSelector';
import { evt_project_members_visit } from '@/shared/worklenz-analytics-events';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { getRoleColor, isTeamLeadRole, ROLE_NAMES } from '@/types/roles/role.types';
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { toggleUpdateMemberDrawer } from '@/features/settings/member/memberSlice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { fetchEnhancedKanbanGroups } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { fetchBoardTaskGroups } from '@/features/board/board-slice';
import { hasBusinessFeatureAccess } from '@/utils/subscription-utils';
import {
  canManageUserRole,
  getSessionRoleName,
} from '@/utils/role-permissions.utils';
import { useAppSumoTracking } from '@/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import useProjectPermissions from '@/hooks/useProjectPermissions';

interface PaginationType {
  current: number;
  pageSize: number;
  field: string;
  order: string;
  total: number;
  pageSizeOptions: string[];
  size: 'small' | 'default';
}

const ProjectViewMembers = () => {
  // Hooks
  const { projectId } = useParams();
  const { t } = useTranslation('project-view-members');
  const auth = useAuthService();
  const user = auth.getCurrentSession();
  const isOwnerOrAdmin = auth.isOwnerOrAdmin();
  const isTeamLead = isTeamLeadRole(auth.role);
  const { permissions } = useProjectPermissions(projectId);

  const effectiveRole = getSessionRoleName(user);

  const canManageUser = useCallback(
    (targetRole: string | undefined) => {
      if (effectiveRole === ROLE_NAMES.ADMIN) {
        return targetRole?.toLowerCase() !== 'owner';
      }

      return canManageUserRole(effectiveRole, targetRole, user?.owner);
    },
    [effectiveRole, user?.owner]
  );

  const { trackMixpanelEvent } = useMixpanelTracking();
  const dispatch = useAppDispatch();

  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const membersRefreshCount = useAppSelector(state => state.projectMemberReducer.membersRefreshCount);
  const billingInfo = useAppSelector(state => state.adminCenterReducer.billingInfo);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<IProjectMembersViewModel>();
  const [pagination, setPagination] = useState<PaginationType>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    field: 'role_level',
    order: 'ascend',
    total: 0,
    pageSizeOptions: ['10', '20', '50', '100'],
    size: 'small',
  });
  const [searchQuery, setSearchQuery] = useState(''); // <-- Add search state
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberRole, setSelectedMemberRole] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);

  const [timeOffModalVisible, setTimeOffModalVisible] = useState(false);
  const [timeOffTargetMember, setTimeOffTargetMember] = useState<{
    id: string;
    name: string;
    email?: string;
  } | null>(null);
  const [isSeatLimitPopoverOpen, setIsSeatLimitPopoverOpen] = useState(false);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = billingInfo?.subscription_type?.toLowerCase().includes('appsumo') ?? false;

  const totalUsedSeats = billingInfo?.total_used ?? members?.total ?? 0;
  const totalAvailableSeats = billingInfo?.total_seats ?? 0;
  const remainingSeats = Math.max(0, totalAvailableSeats - totalUsedSeats);
  const hasReachedSeatLimit =
    !hasBusinessFeatureAccess(user) && totalAvailableSeats > 0 && totalUsedSeats >= totalAvailableSeats;
  const seatUsageText = useMemo(() => {
    if (!totalAvailableSeats) {
      return t('seatUsageText', {
        defaultValue: t('seatUsageText'),
        used: totalUsedSeats,
      });
    }

    return t('seatUsageWithLimitText', {
      defaultValue: t('seatUsageWithLimitText'),
      used: Math.min(totalUsedSeats, totalAvailableSeats),
      total: totalAvailableSeats,
    });
  }, [totalAvailableSeats, totalUsedSeats, t]);

  // API Functions
  const getProjectMembers = async (search: string = searchQuery) => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const offset = (pagination.current - 1) * pagination.pageSize;
      const res = await projectsApiService.getMembers(
        projectId,
        pagination.current,
        pagination.pageSize,
        pagination.field,
        pagination.order,
        search
      );
      if (res.done) {
        setMembers(res.body);
        setPagination(p => ({ ...p, total: res.body.total ?? 0 }));
        if (isOwnerOrAdmin) dispatch(fetchBillingInfo());
      }
    } catch (error) {
      logger.error('Error fetching members:', error);
    } finally {
      setIsLoading(false);
    }
  };
  const handleEditMember = (record: IProjectMemberViewModel) => {
    if (!record.team_member_id) {
      message.error(
        t('memberNotFound', {
          defaultValue: 'Team member information not found',
        })
      );
      return;
    }

    setSelectedMemberId(record.team_member_id);
    setSelectedMemberRole(record.access_level || record.access || null);
    setSelectedMemberName(record.name || null);

    dispatch(toggleUpdateMemberDrawer());
  };

  const handleManageTimeOff = (record: IProjectMemberViewModel) => {
    if (!record.team_member_id) {
      message.error(
        t('memberNotFound', {
          defaultValue: 'Team member information not found',
        })
      );
      return;
    }

    setTimeOffTargetMember({
      id: record.team_member_id,
      name: record.name || '',
      email: record.email,
    });

    setTimeOffModalVisible(true);
  };
  const handleStatusChange = async (record: IProjectMemberViewModel) => {
    if (!record.team_member_id || !record.email) {
      message.error(
        t('memberNotFound', {
          defaultValue: 'Team member information not found',
        })
      );
      return;
    }

    try {
      setIsLoading(true);

      const memberRes = await teamMembersApiService.getById(
        record.team_member_id
      );

      if (!memberRes.done || !memberRes.body) {
        message.error(
          t('memberNotFound', {
            defaultValue: 'Team member information not found',
          })
        );
        return;
      }

      const teamMember = memberRes.body;

      const res = await teamMembersApiService.toggleMemberActiveStatus(
        record.team_member_id,
        teamMember.active as boolean,
        record.email
      );

      if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
        message.error(
          t('seatLimitReached', {
            defaultValue: 'Seat limit reached',
          })
        );
        return;
      }

      if (res.done) {
        message.success(
          teamMember.active
            ? t('memberDeactivated', {
              defaultValue: 'Member deactivated successfully',
            })
            : t('memberActivated', {
              defaultValue: 'Member activated successfully',
            })
        );

        await getProjectMembers();
        dispatch(fetchBillingInfo());
      } else {
        message.error(
          res.message ||
          t('statusChangeError', {
            defaultValue: 'Failed to change member status',
          })
        );
      }
    } catch (error) {
      logger.error('Error changing member status:', error);
      message.error(
        t('statusChangeError', {
          defaultValue: 'Failed to change member status',
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMember = async (memberId: string | undefined, memberName?: string) => {
    if (!memberId || !projectId) return;

    try {
      const res = await projectMembersApiService.deleteProjectMember(memberId, projectId);
      if (res.done) {
        message.success(t('removeSuccess', { name: memberName || '', defaultValue: `${memberName || 'Member'} removed from project` }));
        void getProjectMembers();
        dispatch(fetchTasksV3({ projectId, silent: true }));
        dispatch(fetchEnhancedKanbanGroups(projectId));
        dispatch(fetchBoardTaskGroups(projectId));
      } else {
        message.error(
          res.message ||
          t('removeError', {
            defaultValue: 'Failed to remove member',
          })
        );
      }
    } catch (error) {
      logger.error('Error deleting member:', error);
      message.error(t('removeError', { defaultValue: 'Failed to remove member' }));
    }
  };

  // Helper Functions
  const canRemoveMember = (record: IProjectMemberViewModel): boolean => {
    if (user?.team_member_id === record.team_member_id) return false;

    if (!permissions.members.removeMember) return false;

    const access = (record.access_level || record.access || '').toLowerCase();

    // Without assignPm, cannot remove another PM or a team Owner/Admin.
    if (!permissions.assignPm) {
      if (
        access === 'project_manager' ||
        access === 'project manager' ||
        access === 'admin' ||
        access === 'owner' ||
        access === 'team owner'
      ) {
        return false;
      }
    }

    if (isOwnerOrAdmin) return true;

    if (isTeamLead && access === 'member') return true;

    // PM with removeMember: Members and Guests only (server enforces the rest).
    return access === 'member' || access === 'guest' || access === '';
  };

  const calculateProgressPercent = (completed: number = 0, total: number = 0): number => {
    if (total === 0) return 0;
    return Math.floor((completed / total) * 100);
  };

  const handleTableChange = (tablePagination: any, filters: any, sorter: any) => {
    setPagination(prev => ({
      ...prev,
      current: tablePagination.current,
      pageSize: tablePagination.pageSize,
      field: sorter.order ? sorter.field : 'role_level',   // reset to default field when sort cancelled
      order: sorter.order ?? 'ascend',               // reset to default order when sort cancelled
    }));
  };

  // Effects
  useEffect(() => {
    void getProjectMembers();
  }, [
    refreshTimestamp,
    membersRefreshCount,
    projectId,
    pagination.current,
    pagination.pageSize,
    pagination.field,
    pagination.order,
    // searchQuery, // <-- Do NOT include here, search is triggered manually
  ]);

  useEffect(() => {
    if (isOwnerOrAdmin && !billingInfo) {
      dispatch(fetchBillingInfo());
    }
  }, [billingInfo, dispatch]);

  useEffect(() => {
    trackMixpanelEvent(evt_project_members_visit, {
      project_id: projectId || '',
    });
  }, [trackMixpanelEvent, projectId]);

  // Table Configuration
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('nameColumn'),
      dataIndex: 'name',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'name'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'name'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Flex gap={8} align="center">
          <Avatar size={28} src={record.avatar_url}>
            {record.name?.charAt(0)}
          </Avatar>
          <Typography.Text>{record.name}</Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'job_title',
      title: t('jobTitleColumn'),
      dataIndex: 'job_title',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'job_title'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'job_title'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text style={{ marginInlineStart: 12 }}>
          {record?.job_title || '-'}
        </Typography.Text>
      ),
    },
    {
      key: 'email',
      title: t('emailColumn'),
      dataIndex: 'email',
      sorter: true,
      sortOrder:
        pagination.order === 'ascend' && pagination.field === 'email'
          ? 'ascend'
          : pagination.order === 'descend' && pagination.field === 'email'
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text>{record.email}</Typography.Text>
      ),
    },
    {
      key: 'tasks',
      title: t('tasksColumn'),
      width: 90,
      render: (_, record: IProjectMemberViewModel) => (
        <Typography.Text style={{ marginInlineStart: 12 }}>
          {`${record.completed_tasks_count}/${record.all_tasks_count}`}
        </Typography.Text>
      ),
    },
    {
      key: 'taskProgress',
      title: t('taskProgressColumn'),
      render: (_, record: IProjectMemberViewModel) => (
        <Progress
          percent={calculateProgressPercent(record.completed_tasks_count, record.all_tasks_count)}
        />
      ),
    },
    {
      key: 'access',
      title: t('roleLevelColumn', { defaultValue: 'Role' }),
      dataIndex: 'access',
      sorter: true,
      sortOrder:
        (pagination.order === 'ascend' && (pagination.field === 'access' || pagination.field === 'role_level'))
          ? 'ascend'
          : (pagination.order === 'descend' && (pagination.field === 'access' || pagination.field === 'role_level'))
            ? 'descend'
            : null,
      render: (_, record: IProjectMemberViewModel) => {
        const access = record.access_level || record.access || '';
        const displayAccess = access.toLowerCase() === 'owner' ? 'Team Owner' : access;
        return (
          <Typography.Text
            style={{ textTransform: 'capitalize', color: getRoleColor(access, themeMode === 'dark') }}
          >
            {displayAccess}
          </Typography.Text>
        );

      },
    },
    {
      key: 'actionBtns',
      width: 80,
      render: (record: IProjectMemberViewModel) => {
        const canRemove = canRemoveMember(record);

        if (!canRemove) return null;

        const canManage = canManageUser(
          record.access_level || record.access
        );

        const isCurrentUser = user?.team_member_id === record.team_member_id;
        const isTargetOwner =
          (record.access_level || record.access || '').toLowerCase() === 'owner';

        const canEdit =
          (effectiveRole === ROLE_NAMES.OWNER && isCurrentUser) ||
          (canManage && !isTargetOwner);

        const canChangeStatus = canManage && !isTargetOwner;

        const handleRemove = () => {
          Modal.confirm({
            title: t('removeConfirmationTitle', { name: record.name || '', defaultValue: `Remove ${record.name || 'Member'}?` }),
            content: t('removeConfirmationBody', { defaultValue: 'They will lose access to this project. Their assigned tasks will remain but become unassigned.' }),
            icon: <ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />,
            okText: t('removeButtonText', { defaultValue: 'Remove' }),
            cancelText: t('deleteConfirmationCancel'),
            okButtonProps: { danger: true },
            onOk: () => deleteMember(record.id, record.name),
          });
        };

        const items = [
          {
            key: 'edit',
            label: t('editTooltip', { defaultValue: 'Edit member' }),
            disabled: !canEdit,
            onClick: () => {
              if (canEdit) {
                handleEditMember(record);
              }
            },
          },

          {
            key: 'time-off',
            label: t('manageTimeOff', {
              defaultValue: 'Manage Time Off',
            }),
            disabled: !canManage,
            onClick: () => {
              if (canManage) {
                handleManageTimeOff(record);
              }
            },
          },

          // ADD STATUS HERE
          {
            key: 'status',
            label: (
              <Popconfirm
                title={t('changeMemberStatusConfirmation', {
                  defaultValue: "Are you sure you want to change this member's status?",
                })}
                okText={t('yesProceed', {
                  defaultValue: 'Yes, Proceed',
                })}
                cancelText={t('cancel', {
                  defaultValue: 'Cancel',
                })}
                onConfirm={() => {
                  if (canChangeStatus) {
                    handleStatusChange(record);
                  }
                }}
              >
                <span onClick={e => e.stopPropagation()}>
                  {record.active
                    ? t('deactivateTooltip', {
                      defaultValue: 'Deactivate member',
                    })
                    : t('activateTooltip', {
                      defaultValue: 'Activate member',
                    })}
                </span>
              </Popconfirm>
            ),
            disabled: !canChangeStatus,
          },

          {
            key: 'remove',
            label: t('removeFromProject', {
              defaultValue: 'Remove from Project',
            }),
            disabled: !canRemove,
            onClick: () => {
              if (canRemove) {
                handleRemove();
              }
            },
            danger: true,
          },
        ];
        return (
          <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} aria-label={t('moreOptions', { defaultValue: 'More options' })} />
          </Dropdown>
        );
      },
    },
  ];

  return (
    <>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="space-between" align="center">
            <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
              {members?.total} {members?.total !== 1 ? t('membersCountPlural') : t('memberCount')}
            </Typography.Text>

            <Flex gap={8} align="center">
              {isOwnerOrAdmin && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {seatUsageText}
                </Typography.Text>
              )}
              {permissions.members.add && (
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  open={isSeatLimitPopoverOpen}
                  onOpenChange={open => {
                    // Only allow opening via the button when seat limit is reached;
                    // always allow closing (open === false) so outside-click works.
                    if (!open || hasReachedSeatLimit) {
                      setIsSeatLimitPopoverOpen(open);
                      if (isAppSumoUser) {
                        trackAppSumoEvent(
                          open ? AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN : AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED,
                          { feature: 'seat_limit_project_members' }
                        );
                        if (!open) {
                          trackAppSumoEvent(AppSumoUpsellEvents.SEAT_LIMIT_INVITE_CANCELLED, { feature: 'project_members' });
                        }
                      }
                    }
                  }}
                  title={
                    <Flex align="center" justify="space-between" style={{ width: '100%' }}>
                      <Typography.Text strong>
                        {t('seatLimitPopoverTitle', { defaultValue: t('seatLimitPopoverTitle') })}
                      </Typography.Text>
                      <Button
                        type="text"
                        size="small"
                        aria-label={t('closePopover', { defaultValue: t('closePopover') })}
                        onClick={event => {
                          event.stopPropagation();
                          setIsSeatLimitPopoverOpen(false);
                        }}
                      >
                        ×
                      </Button>
                    </Flex>
                  }
                  content={
                    <Flex vertical gap={12} style={{ maxWidth: 280 }}>
                      <Typography.Text>
                        {t('seatLimitPopoverBody', {
                          defaultValue:
                            t('seatLimitPopoverBody'),
                          used: totalUsedSeats,
                          total: totalAvailableSeats,
                        })}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {t('seatRemainingText', {
                          defaultValue: t('seatRemainingText'),
                          remaining: remainingSeats,
                        })}
                      </Typography.Text>
                      <Button
                        type="primary"
                        onClick={() => {
                          setIsSeatLimitPopoverOpen(false);
                          if (isAppSumoUser) {
                            trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'seat_limit_project_members' });
                            trackAppSumoEvent(AppSumoUpsellEvents.SEAT_LIMIT_ADD_MORE_CLICKED, { feature: 'project_members' });
                          }
                          dispatch(toggleUpgradeModal());
                        }}
                      >
                        {t('seatLimitPopoverCta', { defaultValue: t('seatLimitPopoverCta') })}
                      </Button>
                    </Flex>
                  }
                >
                  <Button
                    onClick={() => {
                      if (hasReachedSeatLimit) {
                        setIsSeatLimitPopoverOpen(true);
                      } else {
                        dispatch(toggleProjectMemberDrawer());
                      }
                    }}
                  >
                    {t('Invite', { defaultValue: t('Invite') })}
                  </Button>
                </Popover>
              )}
              <Input.Search
                allowClear
                placeholder={t('searchPlaceholder', { defaultValue: t('searchPlaceholder') })}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onSearch={value => {
                  setPagination(p => ({ ...p, current: 1 })); // Reset to first page
                  void getProjectMembers(value);
                }}
                style={{ width: 220 }}
                enterButton
                size="middle"
              />
              <Tooltip title={t('refreshButtonTooltip')}>
                <Button
                  shape="circle"
                  icon={<SyncOutlined spin={isLoading} />}
                  onClick={() => void getProjectMembers()}
                />
              </Tooltip>
            </Flex>
          </Flex>
        }
      >
        {members?.total === 0 ? (
          <EmptyListPlaceholder
            imageSrc="https://s3.us-west-2.amazonaws.com/worklenz.com/assets/empty-box.webp"
            imageHeight={120}
            text={t('emptyText')}
          />
        ) : isLoading ? (
          <Skeleton />
        ) : (
          <Table
            className="custom-two-colors-row-table"
            dataSource={members?.data}
            columns={columns}
            rowKey={record => record.id}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: pagination.total,
              showSizeChanger: true,
              pageSizeOptions: pagination.pageSizeOptions,
              size: pagination.size,
            }}
            onChange={handleTableChange}
            onRow={record => ({
              style: {
                cursor: 'pointer',
                height: 42,
              },
            })}
          />
        )}
      </Card>
      <TimeOffCalendar
        members={
          timeOffTargetMember
            ? [timeOffTargetMember]
            : (members?.data || [])
              .filter(m => Boolean(m.id))
              .map(m => ({
                id: m.id!,
                name: m.name || '',
                email: m.email,
              }))
        }
        visible={timeOffModalVisible}
        onClose={() => {
          setTimeOffModalVisible(false);
          setTimeOffTargetMember(null);
        }}
        preselectedMemberId={timeOffTargetMember?.id || null}
        showEntriesTable={true}
      />
      {createPortal(
        <UpdateMemberDrawer
          selectedMemberId={selectedMemberId}
          selectedMemberName={selectedMemberName}
          initialRoleName={selectedMemberRole || undefined}
        />,
        document.body
      )}


    </>
  );
};

export default ProjectViewMembers;
