import {
  CalendarOutlined,
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
  Popover,
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
import TimeOffCalendar from '@/components/schedule/task-timeline/TimeOffCalendar';
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
import { fetchBillingInfo, toggleUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { hasBusinessFeatureAccess } from '@/ee/utils/subscription-utils';
import { SeatLimitModal } from '@/components/common/seat-limit-modal/SeatLimitModal';
import { useAppSumoTracking } from '@/ee/hooks/useAppSumoTracking';
import { AppSumoUpsellEvents } from '@/types/mixpanel-events.types';
import './team-members-settings.css';

// Maps a role name to its sort level: Owner (1) → Admin (2) → Team Lead (3) → everyone
// else (4). Must stay in sync with the role_level CASE in
// worklenz-backend/src/controllers/team-members-controller.ts (get()) — unknown/custom
// roles fall back to level 4 there, so mirror that fallback here to keep the inline
// re-sort (sortTeamMembersByRole) consistent with a fresh server fetch.
const ROLE_LEVELS: Record<string, number> = {
  Owner: 1,
  Admin: 2,
  'Team Lead': 3,
  Member: 4,
};

const getRoleLevel = (roleName?: string): number => ROLE_LEVELS[roleName ?? ''] ?? 4;

// Prefer the server-computed role_level (handles custom admin roles); fall back to
// deriving it from the role name for optimistic rows that predate a refetch.
const resolveRoleLevel = (member: ITeamMemberViewModel): number =>
  typeof member.role_level === 'number' ? member.role_level : getRoleLevel(member.role_name);

// Re-sorts members by role level (Owner → Admin → Team Lead → others), keeping names
// alphabetical within each group regardless of direction — mirrors the backend ORDER BY.
const sortTeamMembersByRole = (
  data: ITeamMemberViewModel[],
  order: 'asc' | 'desc'
): ITeamMemberViewModel[] => {
  const dir = order === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    const levelDiff = (resolveRoleLevel(a) - resolveRoleLevel(b)) * dir;
    if (levelDiff !== 0) return levelDiff;
    return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
  });
};

// Generic inline re-sort used after optimistic row edits. Mirrors the server-side
// ORDER BY for each sortable column (see fieldMapping in the backend get()) so a
// changed value lands on the right spot until the reconciling refetch lands.
// Role-level sorting keeps the name tiebreaker pinned to ASC (see above).
const sortMembersByField = (
  data: ITeamMemberViewModel[],
  field: string,
  order: 'asc' | 'desc'
): ITeamMemberViewModel[] => {
  if (field === 'role_level') {
    return sortTeamMembersByRole(data, order);
  }

  const dir = order === 'desc' ? -1 : 1;
  return [...data].sort((a, b) => {
    switch (field) {
      case 'projects_count':
        return (Number(a.projects_count || 0) - Number(b.projects_count || 0)) * dir;
      case 'email':
        return (a.email || '').toLowerCase().localeCompare((b.email || '').toLowerCase()) * dir;
      case 'name':
      default:
        return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()) * dir;
    }
  });
};

const TEAM_MEMBERS_SORT_STORAGE_KEY = 'teamMembersSortPreference';

// Only these fields can be sorted via the column headers. Anything else in the
// persisted preference (e.g. a stale value from a previously sortable column) is
// rejected so the table never loads into an unsortable/invisible sort state.
const SORTABLE_FIELDS = ['role_level', 'name', 'email', 'projects_count'];

const readTeamMembersSortPreference = (): { field: string; order: string } | null => {
  try {
    const raw = localStorage.getItem(TEAM_MEMBERS_SORT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { field?: unknown; order?: unknown };
    if (
      typeof parsed.field === 'string' &&
      (parsed.order === 'asc' || parsed.order === 'desc') &&
      SORTABLE_FIELDS.includes(parsed.field)
    ) {
      return { field: parsed.field, order: parsed.order };
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
};

const writeTeamMembersSortPreference = (field: string, order: string): void => {
  try {
    localStorage.setItem(TEAM_MEMBERS_SORT_STORAGE_KEY, JSON.stringify({ field, order }));
  } catch {
    // Ignore storage write errors
  }
};

const TeamMembersSettings = () => {
  const { t } = useTranslation('settings/team-members');
  const { t: tCommon } = useTranslation('common');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const isInviteRestricted = Boolean(currentSession?.is_expired);
  const refreshTeamMembers = useAppSelector(state => state.memberReducer.refreshTeamMembers);
  const billingInfo = useAppSelector(state => state.adminCenterReducer.billingInfo);

  useDocumentTitle(t('title', { defaultValue: 'Team Members' }));

  const [model, setModel] = useState<ITeamMembersViewModel>({ total: 0, data: [] });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberRole, setSelectedMemberRole] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<ITeamMemberViewModel[]>([]);
  const [isBulkAssignDrawerVisible, setBulkAssignDrawerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeatLimitPopoverOpen, setIsSeatLimitPopoverOpen] = useState(false);
  const [timeOffModalVisible, setTimeOffModalVisible] = useState(false);
  const [timeOffTargetMember, setTimeOffTargetMember] = useState<{
    id: string;
    name: string;
    email?: string;
  } | null>(null);
  const { trackAppSumoEvent } = useAppSumoTracking();
  const isAppSumoUser = billingInfo?.subscription_type?.toLowerCase().includes('appsumo') ?? false;
  const [pagination, setPagination] = useState(() => {
    const savedSort = readTeamMembersSortPreference();
    return {
      current: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      field: savedSort?.field ?? 'role_level',
      order: savedSort?.order ?? 'asc',
    };
  });
  const [seatLimitModalOpen, setSeatLimitModalOpen] = useState(false);
  const [seatLimitData, setSeatLimitData] = useState<{
    current_members: number;
    plan_seat_limit: number;
    business_plan_limit: number;
    is_appsumo_user: boolean;
  } | null>(null);

  const totalUsedSeats = billingInfo?.total_used ?? 0;
  const totalAvailableSeats = billingInfo?.total_seats ?? 0;
  const hasReachedSeatLimit =
    !hasBusinessFeatureAccess(currentSession) &&
    totalAvailableSeats > 0 &&
    totalUsedSeats >= totalAvailableSeats;
  const isSeatUsageOverLimit =
    totalAvailableSeats > 0 && (model.total ?? 0) > totalAvailableSeats;

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

  useEffect(() => {
    dispatch(fetchBillingInfo());
  }, [dispatch]);

  const handleStatusChange = async (record: ITeamMemberViewModel) => {
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.toggleMemberActiveStatus(
        record.id || '',
        record.active as boolean,
        record.email || ''
      );

      if (!res.done && res.body?.error_code === 'SEAT_LIMIT_EXCEEDED') {
        setSeatLimitData(res.body);
        setSeatLimitModalOpen(true);
        return;
      }

      if (res.done) {
        await getTeamMembers();
        dispatch(fetchBillingInfo());
        const pendingTeamInvite = localStorage.getItem('pendingTeamInvite');
        if (pendingTeamInvite && !record.active) {
          try {
            const inviteData = JSON.parse(pendingTeamInvite);
            const inviteRes = await teamMembersApiService.createTeamMember(inviteData);
            if (inviteRes.done) {
              message.success(t('memberDeactivatedInviteSent', {
                defaultValue: 'Member deactivated. Invitation sent successfully.'
              }));
              localStorage.removeItem('pendingTeamInvite');
            }
          } catch (error) {
            localStorage.removeItem('pendingTeamInvite');
          }
        }

        const pendingProjectInvite = localStorage.getItem('pendingProjectInvite');
        if (pendingProjectInvite && !record.active) {
          try {
            const inviteData = JSON.parse(pendingProjectInvite);
            const invitePromises = inviteData.emails.map((email: string) =>
              projectMembersApiService.inviteByEmail({
                email: email.trim(),
                project_id: inviteData.projectId,
                role_name: inviteData.access === 'team-lead' ? 'TEAM_LEAD' :
                          inviteData.access === 'admin' ? 'ADMIN' : 'MEMBER',
                is_admin: inviteData.access === 'admin',
                access_level: inviteData.access === 'guest' ? 'GUEST' : undefined,
              })
            );
            await Promise.all(invitePromises);
            message.success(t('memberDeactivatedProjectInviteSent', {
              defaultValue: 'Member deactivated. Project invitation sent for {projectName}.',
              projectName: inviteData.projectName,
            }));
            localStorage.removeItem('pendingProjectInvite');
          } catch (error) {
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
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.SEAT_LIMIT_DEACTIVATE_CHOSEN, { feature: 'team_members' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSeatLimitModalClose = () => {
    setSeatLimitModalOpen(false);
    setSeatLimitData(null);
    if (isAppSumoUser) {
      trackAppSumoEvent(AppSumoUpsellEvents.SEAT_LIMIT_INVITE_CANCELLED, { feature: 'team_members' });
    }
  };

  const handleDeleteMember = async (record: ITeamMemberViewModel) => {
    if (!record.id) return;
    try {
      setIsLoading(true);
      const res = await teamMembersApiService.delete(record.id);
      if (res.done) {
        await getTeamMembers();
        dispatch(fetchBillingInfo());
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleUpdate = useCallback((memberId: string, newRoleName: string) => {
    setModel(prevModel => {
      const data = (prevModel.data ?? []).map(member =>
        member.id === memberId
          // Drop the stale server role_level so the sort falls back to the name
          // mapping for this row until the reconciling refetch lands.
          ? { ...member, role_name: newRoleName, role_level: undefined }
          : member
      );
      return {
        ...prevModel,
        data: pagination.field === 'role_level' ? sortTeamMembersByRole(data, pagination.order as 'asc' | 'desc') : data,
      };
    });
    // The optimistic reorder above uses the name-based fallback for the edited row
    // (a custom admin role can't be levelled from its name) and only touches the
    // current page. Under a role sort, reconcile with the server for the authoritative
    // role_level and cross-page position.
    if (pagination.field === 'role_level') {
      void getTeamMembers();
    }
  }, [pagination.field, pagination.order, getTeamMembers]);

  const handleJobTitleUpdate = useCallback((memberId: string, newJobTitle: string) => {
    setModel(prevModel => ({
      ...prevModel,
      data: prevModel.data?.map(member =>
        member.id === memberId ? { ...member, job_title: newJobTitle } : member
      ),
    }));
  }, []);

  // Updates the team lead columns in the table row immediately after the drawer
  // saves, without waiting for a full getTeamMembers() refetch.
  const handleTeamLeadUpdate = useCallback(
    (memberId: string, teamLeadId: string | null, teamLeadName: string | null) => {
      setModel(prevModel => {
        const data = prevModel.data?.map(member =>
          member.id === memberId
            ? ({
                ...member,
                reports_to_member_id: teamLeadId,
                current_team_lead_name: teamLeadName,
              } as ITeamMemberViewModel)
            : member
        );
        return {
          ...prevModel,
          data: data
            ? sortMembersByField(data, pagination.field ?? 'role_level', pagination.order as 'asc' | 'desc')
            : data,
        };
      });
    },
    [pagination.field, pagination.order]
  );

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
        // Update the row immediately instead of refetching the whole list
        handleTeamLeadUpdate(member.id, null, null);
      }
    } catch (error) {
      // Error removing team lead assignment
    } finally {
      setIsLoading(false);
    }
  };

  const handleTableChange = useCallback(
    (newPagination: any, filters: any, sorter: any) => {
      if (sorter.order) {
        // Column-header sort event (ascend / descend). Every sortable column uses
        // sortDirections ['ascend', 'descend', 'ascend'], so a header click always
        // toggles between the two directions and cycles BACK to ascending instead of
        // emitting a null (toggled-off) order — which, with a controlled sortOrder,
        // would otherwise silently freeze the column on the last direction.
        const field = (Array.isArray(sorter.field) ? sorter.field[0] : sorter.field) as string;
        const order = sorter.order === 'ascend' ? 'asc' : 'desc';
        const isNewSort = field !== pagination.field || order !== pagination.order;

        if (isNewSort) {
          // A genuine header sort → persist it and restart from the first page so
          // the new order is visible immediately instead of a stale deep page.
          writeTeamMembersSortPreference(field, order);
          setPagination(prev => ({ ...prev, current: 1, field, order }));
          return;
        }

        // The sorter matches the current sort, so this is really a pagination /
        // page-size change (antd re-reports the active sorter on every change).
        // Keep the same sort and just forward the requested page.
        setPagination(prev => ({
          ...prev,
          current: newPagination.current,
          pageSize: newPagination.pageSize,
          field,
          order,
        }));
        return;
      }

      // Not a sort event → keep the current sort and just forward the requested page.
      setPagination(prev => ({
        ...prev,
        current: newPagination.current,
        pageSize: newPagination.pageSize,
        field: pagination.field ?? 'role_level',
        order: pagination.order ?? 'asc',
      }));
    },
    [pagination.field, pagination.order]
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
    dispatch(fetchBillingInfo());
  }, [refreshTeamMembers, handleRefresh, dispatch]);

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
      let isPaginated = false;
      setModel(prevModel => {
        isPaginated = (prevModel.total ?? 0) > (prevModel.data?.length ?? 0);
        const data = (prevModel.data ?? []).map(member =>
          member.id === memberId ? { ...member, name: newName } : member
        );
        return {
          ...prevModel,
          data: sortMembersByField(data, pagination.field ?? 'role_level', pagination.order as 'asc' | 'desc'),
        };
      });
      setSelectedMemberName(currentName => (selectedMemberId === memberId ? newName : currentName));
      // A rename only moves the row when the list is ordered by name (directly, or
      // as the role-sort tiebreaker). Reconcile the global order with the server
      // for a paginated list in those cases; other sorts are unaffected.
      if (isPaginated && (pagination.field === 'name' || pagination.field === 'role_level')) {
        void getTeamMembers();
      }
    },
    [selectedMemberId, pagination.field, pagination.order, getTeamMembers]
  );

  const getActionMenuItems = useCallback(
    (record: ITeamMemberViewModel): MenuProps['items'] => {
      const canManage = canManageUser(record.role_name);
      // Team Owner can edit their own details
      const isCurrentUser = currentUser?.team_member_id === record.id;
      const isOwnerEditingOwnDetails = effectiveRole === ROLE_NAMES.OWNER && isCurrentUser;
      // Admin cannot manage team owners, but owner can manage non-owners
      const isTargetOwner = record.role_name?.toLowerCase() === 'owner';
      
      // Edit: Admin can't edit owners, but owners can edit themselves and others (except owners)
      const canEdit = isOwnerEditingOwnDetails || (canManage && !isTargetOwner);

      // Owner can deactivate/delete non-owner members, Admin can only do it for non-owners
      const canDeactivateOrDelete = canManage && !isTargetOwner;

      const menuItems = [
        {
          key: 'edit',
          label: t('editTooltip', { defaultValue: 'Edit member' }),
          icon: <EditOutlined />,
          disabled: !canEdit,
          onClick: () => canEdit && record.id && handleMemberClick(record.id, record.role_name, record.name),
        },
        {
          key: 'time-off',
          label: t('manageTimeOff', { defaultValue: 'Manage Time Off' }),
          icon: <CalendarOutlined />,
          onClick: () => {
            if (record.id) {
              setTimeOffTargetMember({
                id: record.id,
                name: record.name || '',
                email: record.email,
              });
              setTimeOffModalVisible(true);
            }
          },
        },
        {
          key: 'status',
          label: record.active ? t('deactivateTooltip', { defaultValue: 'Deactivate member' }) : t('activateTooltip', { defaultValue: 'Activate member' }),
          icon: <UserSwitchOutlined />,
          disabled: !canDeactivateOrDelete,
          onClick: () => {
            if (canDeactivateOrDelete) {
              return;
            }
          },
        },
        {
          key: 'delete',
          label: t('deleteTooltip', { defaultValue: 'Delete member' }),
          icon: <DeleteOutlined />,
          disabled: !canDeactivateOrDelete,
          danger: true,
          onClick: () => {
            if (canDeactivateOrDelete && record.id) {
              return;
            }
          },
        },
      ];

      return menuItems;
    },
    [t, canManageUser, handleMemberClick, effectiveRole, currentUser?.team_member_id]
  );

  const getColumnSortOrder = (field: string): 'ascend' | 'descend' | null =>
    pagination.field === field
      ? pagination.order === 'asc'
        ? 'ascend'
        : 'descend'
      : null;

  const columns: TableProps['columns'] = useMemo(
    () => [
      {
        key: 'name',
        dataIndex: 'name',
        title: t('nameColumn', { defaultValue: 'Name' }),
        sorter: true,
        sortDirections: ['ascend', 'descend', 'ascend'],
        sortOrder: getColumnSortOrder('name'),
        render: (_, record: ITeamMemberViewModel) => {
          const isPending = record.pending_invitation;
          const isTargetOwner = record.role_name?.toLowerCase() === 'owner';
          const isCurrentUser = currentUser?.team_member_id === record.id;
          const isOwnerEditingOwnDetails = effectiveRole === ROLE_NAMES.OWNER && isCurrentUser;
          // Admin cannot edit team owners, but owners can edit themselves
          const canEdit = isPrivilegedUser && !isPending && (!isTargetOwner || isOwnerEditingOwnDetails);
          const canManage = canManageUser(record.role_name);

          return (
            <Flex
              align="center"
              gap={8}
              style={{
                display: 'flex',
                width: '100%',
              }}
              onClick={() => canManage && handleMemberClick(record.id || '', record.role_name, record.name)}
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
                    {t('deactivatedText', { defaultValue: '(Currently deactivated)' })}
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
        title: t('projectsColumn', { defaultValue: 'Projects' }),
        sorter: true,
        sortDirections: ['ascend', 'descend', 'ascend'],
        sortOrder: getColumnSortOrder('projects_count'),
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => canManageUser(record.role_name) && handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: canManageUser(record.role_name) ? 'pointer' : 'default' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <Typography.Text>{record.projects_count}</Typography.Text>
        ),
      },
      {
        key: 'email',
        dataIndex: 'email',
        title: t('emailColumn', { defaultValue: 'Email' }),
        sorter: true,
        sortDirections: ['ascend', 'descend', 'ascend'],
        sortOrder: getColumnSortOrder('email'),
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => canManageUser(record.role_name) && handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: canManageUser(record.role_name) ? 'pointer' : 'default' },
        }),
        render: (_, record: ITeamMemberViewModel) => (
          <div>
            <Typography.Text>{record.email}</Typography.Text>
            {record.pending_invitation && (
              <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                {t('pendingInvitationText', { defaultValue: '(Invitation pending)' })}
              </Typography.Text>
            )}
          </div>
        ),
      },
      {
        key: 'role_name',
        // dataIndex is role_level (not role_name) so the header sorter emits the
        // role_level field, which the backend maps to the Owner → Admin → Team Lead →
        // others level ordering (mirrors sortTeamMembersByRole above).
        dataIndex: 'role_level',
        title: t('teamAccessColumn', { defaultValue: 'Team Access' }),
        sorter: true,
        sortDirections: ['ascend', 'descend', 'ascend'],
        sortOrder: getColumnSortOrder('role_level'),
        onCell: (record: ITeamMemberViewModel) => ({
          onClick: () => canManageUser(record.role_name) && handleMemberClick(record.id || '', record.role_name, record.name),
          style: { cursor: canManageUser(record.role_name) ? 'pointer' : 'default' },
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
                      title={t('confirmActivateTitle', { defaultValue: 'Are you sure you want to change this member\'s status?' })}
                      icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
                      okText={t('okText', { defaultValue: 'Yes, proceed' })}
                      cancelText={t('cancelText', { defaultValue: 'No, cancel' })}
                      onConfirm={() => canManage && handleStatusChange(record)}
                      disabled={!canManage}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {record.active ? t('deactivateTooltip', { defaultValue: 'Deactivate member' }) : t('activateTooltip', { defaultValue: 'Activate member' })}
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
                      title={t('confirmDeleteTitle', { defaultValue: 'Are you sure you want to delete this member?' })}
                      icon={<ExclamationCircleFilled />}
                      okText={t('okText', { defaultValue: 'Yes, proceed' })}
                      cancelText={t('cancelText', { defaultValue: 'No, cancel' })}
                      onConfirm={() => canManage && record.id && handleDeleteMember(record)}
                      disabled={!canManage}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        {t('deleteTooltip', { defaultValue: 'Delete member' })}
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
      pagination,
    ]
  );

  return (
    <Flex vertical gap={16}>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex justify="space-between" align="center">
              <Typography.Title level={4} style={{ margin: 0 }}>
                {model.total}{' '}
                {t('membersCount', {
                  count: model.total,
                  defaultValue: 'Members',
                  defaultValue_one: 'Member',
                  defaultValue_other: 'Members',
                })}
              </Typography.Title>
            <Flex
              gap={8}
              align="center"
              justify="flex-end"
              style={{ width: '100%', maxWidth: 620 }}
            >
              <Flex align="center" gap={4}>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {totalAvailableSeats && totalAvailableSeats > 0
                    ? t('seatUsageWithLimitText', {
                        defaultValue: '{{used}} of {{total}} seats used',
                        used: Math.min(totalUsedSeats, totalAvailableSeats),
                        total: totalAvailableSeats,
                      })
                    : totalUsedSeats >= 0
                      ? t('seatUsageText', {
                          defaultValue: '{{used}} seats used',
                          used: totalUsedSeats,
                        })
                      : t('seatUsageLoading', {
                          defaultValue: 'Loading seat usage...',
                        })}
                </Typography.Text>
                {isSeatUsageOverLimit && (
                  <Tooltip
                    title={t('seatUsageOverLimitTooltip', {
                      defaultValue:
                        'Current members exceed your plan limit. Deactivated members are not counted toward your seat usage.',
                    })}
                  >
                    <ExclamationCircleFilled style={{ color: colors.vibrantOrange, fontSize: 14 }} />
                  </Tooltip>
                )}
              </Flex>
              <Tooltip title={t('pinTooltip', { defaultValue: 'Refresh member list' })}>
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
                style={{ maxWidth: 320, width: '100%' }}
                suffix={<SearchOutlined />}
              />
              <Popover
                trigger="click"
                placement="bottomRight"
                open={isSeatLimitPopoverOpen}
                onOpenChange={open => {
                  if (!open || hasReachedSeatLimit) {
                    setIsSeatLimitPopoverOpen(open);
                    if (isAppSumoUser) {
                      trackAppSumoEvent(
                        open ? AppSumoUpsellEvents.UPGRADE_PROMPT_SHOWN : AppSumoUpsellEvents.UPGRADE_PROMPT_DISMISSED,
                        { feature: 'seat_limit_team_members' }
                      );
                    }
                  }
                }}
                title={
                  <Flex align="center" justify="space-between" style={{ width: '100%' }}>
                    <Typography.Text strong>
                      {t('seatLimitPopoverTitle', { defaultValue: 'Seat Limit Reached' })}
                    </Typography.Text>
                    <Button
                      type="text"
                      size="small"
                      aria-label={t('closePopover', { defaultValue: 'Close popover' })}
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
                      {t('workspaceSeatLimitPopoverBody', {
                        defaultValue: 'Your workspace is using {{used}} of {{total}} available seats. Upgrade your plan to add more members.',
                        used: totalUsedSeats,
                        total: totalAvailableSeats,
                      })}
                    </Typography.Text>
                    <Button
                      type="primary"
                      onClick={() => {
                        setIsSeatLimitPopoverOpen(false);
                        if (isAppSumoUser) {
                          trackAppSumoEvent(AppSumoUpsellEvents.UPGRADE_NOW_CLICKED, { feature: 'seat_limit_team_members' });
                          trackAppSumoEvent(AppSumoUpsellEvents.SEAT_LIMIT_ADD_MORE_CLICKED, { feature: 'team_members' });
                        }
                        dispatch(toggleUpgradeModal());
                      }}
                    >
                      {t('seatLimitPopoverCta', { defaultValue: 'Upgrade Now' })}
                    </Button>
                  </Flex>
                }
              >
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
                      if (!hasReachedSeatLimit) {
                        dispatch(toggleInviteMemberDrawer());
                      }
                    }}
                  >
                    {t('addMoreSeats', { defaultValue: 'Add More Seats' })}
                  </Button>
                </Tooltip>
              </Popover>
              <PinRouteToNavbarButton
                name={t('title', { defaultValue: 'Team Members' })}
                path="/worklenz/settings/team-members"
                adminOnly={false}
              />
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
          scroll={{ x: 900 }}
        />
      </Card>

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
            {t('bulk_assign_team_lead', { defaultValue: 'Assign Team Lead' })} ({selectedMembers.length})
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
          onTeamLeadUpdate={handleTeamLeadUpdate}
          onManageTimeOff={member => {
            setTimeOffTargetMember(member);
            setTimeOffModalVisible(true);
          }}
          initialRoleName={selectedMemberRole || undefined}
        />,
        document.body
      )}

      <TimeOffCalendar
        members={
          timeOffTargetMember
            ? [timeOffTargetMember]
            : (model.data || [])
                .filter(m => Boolean(m.id))
                .map(m => ({ id: m.id!, name: m.name || '', email: m.email }))
        }
        visible={timeOffModalVisible}
        onClose={() => {
          setTimeOffModalVisible(false);
          setTimeOffTargetMember(null);
        }}
        preselectedMemberId={timeOffTargetMember?.id || null}
        showEntriesTable={true}
      />

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