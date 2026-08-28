import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Button,
  theme,
  Select,
  Dropdown,
  Popconfirm,
  MenuProps,
  message,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  UserSwitchOutlined,
  ExclamationCircleFilled,
} from '@/shared/antd-imports';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import CustomAvatar from '@/components/CustomAvatar';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  toggleInviteMemberDrawer,
  toggleUpdateMemberDrawer,
} from '@/features/settings/member/memberSlice';
import UpdateMemberDrawer from '@/components/settings/update-member-drawer';
import { useAuthService } from '@/hooks/useAuth';
import { getRoleColor, ROLE_NAMES } from '@/types/roles/role.types';
import { canManageUserRole, getSessionRoleName } from '@/utils/role-permissions.utils';
import { fetchBillingInfo } from '@/features/admin-center/admin-center.slice';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const HomeMyTeam: React.FC = () => {
  const { token } = theme.useToken();
  const dispatch = useAppDispatch();
  const auth = useAuthService();
  const { t } = useTranslation('home');

  const [members, setMembers] = useState<ITeamMemberViewModel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedMemberRole, setSelectedMemberRole] = useState<string | null>(null);
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null);

  const fetchMembers = useCallback(() => {
    setLoading(true);
    return teamMembersApiService
      .get(page, pageSize, null, null, null)
      .then(res => {
        if (res.done) {
          setMembers(res.body?.data || []);
          setTotal(res.body?.total || 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const currentUser = auth.getCurrentSession();
  const effectiveRole = getSessionRoleName(currentUser);
  const isPrivilegedUser = effectiveRole === ROLE_NAMES.OWNER || effectiveRole === ROLE_NAMES.ADMIN;
  const canManageUser = useCallback(
    (targetRole: string | undefined) => {
      if (effectiveRole === ROLE_NAMES.ADMIN) {
        return targetRole?.toLowerCase() !== 'owner';
      }
      return canManageUserRole(effectiveRole, targetRole, currentUser?.owner);
    },
    [effectiveRole, currentUser?.owner]
  );

  const handleStatusChange = async (record: ITeamMemberViewModel) => {
    try {
      setLoading(true);
      const res = await teamMembersApiService.toggleMemberActiveStatus(
        record.id || '',
        record.active as boolean,
        record.email || ''
      );
      if (res.done) {
        await fetchMembers();
        dispatch(fetchBillingInfo());
      } else {
        message.error(res.message || 'Unable to update member status.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (record: ITeamMemberViewModel) => {
    if (!record.id) return;
    try {
      setLoading(true);
      const res = await teamMembersApiService.delete(record.id);
      if (res.done) {
        await fetchMembers();
        dispatch(fetchBillingInfo());
      } else {
        message.error(res.message || 'Unable to remove member.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (record: ITeamMemberViewModel) => {
    setSelectedMemberId(record.id || null);
    setSelectedMemberRole(record.role_name || null);
    setSelectedMemberName(record.name || null);
    dispatch(toggleUpdateMemberDrawer());
  };

  const handleNameUpdate = useCallback((memberId: string, newName: string) => {
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, name: newName } : m)));
  }, []);

  const handleRoleUpdate = useCallback((memberId: string, newRoleName: string) => {
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, role_name: newRoleName } : m)));
  }, []);

  const handleJobTitleUpdate = useCallback((memberId: string, newJobTitle: string) => {
    setMembers(prev => prev.map(m => (m.id === memberId ? { ...m, job_title: newJobTitle } : m)));
  }, []);

  const handleTeamLeadUpdate = useCallback(
    (memberId: string, teamLeadId: string | null, teamLeadName: string | null) => {
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId
            ? { ...m, reports_to_member_id: teamLeadId, current_team_lead_name: teamLeadName }
            : m
        )
      );
    },
    []
  );

  const getActionMenuItems = (record: ITeamMemberViewModel): MenuProps['items'] => {
    const canManage = canManageUser(record.role_name);

    return [
      {
        key: 'edit',
        label: t('myTeam.actionEdit', { defaultValue: 'Edit' }),
        icon: <EditOutlined />,
        disabled: !canManage,
        onClick: () => canManage && handleEditClick(record),
      },
      {
        key: 'status',
        disabled: !canManage,
        label: (
          <Popconfirm
            title={record.active ? t('myTeam.statusToggleConfirmDeactivate', { defaultValue: 'Are you sure you want to deactivate this member?' }) : t('myTeam.statusToggleConfirmActivate', { defaultValue: 'Are you sure you want to activate this member?' })}
            icon={<ExclamationCircleFilled style={{ color: token.colorWarning }} />}
            okText={t('myTeam.statusToggleOk', { defaultValue: 'Yes' })}
            cancelText={t('myTeam.statusToggleCancel', { defaultValue: 'Cancel' })}
            disabled={!canManage}
            onConfirm={() => canManage && handleStatusChange(record)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
               <UserSwitchOutlined /> {record.active ? t('myTeam.statusToggleLabelDeactivate', { defaultValue: 'Deactivate' }) : t('myTeam.statusToggleLabelActivate', { defaultValue: 'Activate' })}
            </div>
          </Popconfirm>
        ),
      },
      {
        key: 'delete',
        danger: true,
        disabled: !canManage,
        label: (
          <Popconfirm
            title={t('myTeam.deleteConfirmTitle', { defaultValue: 'Are you sure you want to remove this member?' })}
            icon={<ExclamationCircleFilled style={{ color: token.colorError }} />}
            okText={t('myTeam.deleteOk', { defaultValue: 'Yes' })}
            cancelText={t('myTeam.deleteCancel', { defaultValue: 'Cancel' })}
            disabled={!canManage}
            onConfirm={() => canManage && handleDeleteMember(record)}
          >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <DeleteOutlined /> {t('myTeam.deleteLabel', { defaultValue: 'Remove' })}
            </div>
          </Popconfirm>
        ),
      },
    ];
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgContainer,
  };

  const thStyle: React.CSSProperties = {
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: 12,
    color: token.colorTextSecondary,
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '10px 16px',
    whiteSpace: 'nowrap',
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = 7;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{t('myTeam.pageTitle', { defaultValue: 'My Team' })}</h1>
          <p style={{ opacity: 0.5, fontSize: 13, margin: '4px 0 0' }}>{t('myTeam.pageSubtitle', { defaultValue: 'Manage your team members and their roles.' })}</p>
        </div>
        <Button type="primary" onClick={() => dispatch(toggleInviteMemberDrawer())}>
          {t('myTeam.inviteMember', { defaultValue: 'Invite Member' })}
        </Button>
      </div>

      <div style={cardStyle}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: token.colorFillTertiary }}>
                <th style={{ ...thStyle, minWidth: 220 }}>{t('myTeam.columnMember', { defaultValue: 'Member' })}</th>
                <th style={{ ...thStyle, minWidth: 200 }}>{t('myTeam.columnEmail', { defaultValue: 'Email' })}</th>
                <th style={{ ...thStyle, minWidth: 140 }}>{t('myTeam.columnJobTitle', { defaultValue: 'Job Title' })}</th>
                <th style={{ ...thStyle, minWidth: 120 }}>{t('myTeam.columnTeamAccess', { defaultValue: 'Team Access' })}</th>
                <th style={{ ...thStyle, minWidth: 140 }}>{t('myTeam.columnTeamLead', { defaultValue: 'Team Lead' })}</th>
                <th style={{ ...thStyle, minWidth: 110 }}>{t('myTeam.columnActiveProjects', { defaultValue: 'Active Projects' })}</th>
                <th style={{ ...thStyle, width: 56 }}></th>
              </tr>
            </thead>
            <tbody>
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={columnCount} style={{ padding: '48px 16px' }}>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{t('myTeam.emptyTitle', { defaultValue: 'No team members yet' })}</div>
                      <p style={{ opacity: 0.6, fontSize: 13, margin: 0, maxWidth: 360 }}>
                        {t('myTeam.emptySubtitle', { defaultValue: 'Get started by inviting your first team member.' })}
                      </p>
                      <Button type="primary" onClick={() => dispatch(toggleInviteMemberDrawer())}>
                        {t('myTeam.inviteMember', { defaultValue: 'Invite Member' })}
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {members.map(m => {
                const isTeamLeadRole =
                  m.role_name === 'Team Lead' || m.role_name === 'Admin' || m.role_name === 'Owner';
                const canManage = canManageUser(m.role_name);

                return (
                  <tr key={m.id} style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CustomAvatar avatarName={m.name || m.email || '?'} avatarUrl={m.avatar_url} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500 }}>{m.name || m.email}</div>
                           {m.pending_invitation && (
                             <div style={{ fontSize: 11, opacity: 0.5 }}>{t('myTeam.pendingInvitation', { defaultValue: 'Pending invitation' })}</div>
                           )}
                           {!m.active && !m.pending_invitation && (
                             <div style={{ fontSize: 11, color: token.colorWarning }}>{t('myTeam.deactivated', { defaultValue: 'Deactivated' })}</div>
                           )}
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, opacity: 0.75 }}>{m.email || '—'}</td>
                    <td style={{ ...tdStyle, opacity: 0.65 }}>{m.job_title || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{ color: getRoleColor(m.role_name || ''), fontWeight: 500 }}>
                         {m.role_name || t('myTeam.defaultRole', { defaultValue: 'Member' })}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, opacity: 0.75 }}>
                       {isTeamLeadRole ? '—' : m.current_team_lead_name || t('myTeam.noTeamLead', { defaultValue: 'No team lead' })}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{m.projects_count ?? 0}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {isPrivilegedUser && (
                        <Dropdown
                          menu={{ items: getActionMenuItems(m) }}
                          trigger={['click']}
                          placement="bottomRight"
                          disabled={!canManage}
                        >
                          <Button size="small" icon={<MoreOutlined />} disabled={!canManage} />
                        </Dropdown>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 16px',
            borderTop: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{t('myTeam.rowsPerPage', { defaultValue: 'Rows per page' })}</span>
            <Select
              size="small"
              style={{ width: 64 }}
              value={pageSize}
              onChange={v => { setPageSize(v); setPage(1); }}
              options={PAGE_SIZE_OPTIONS.map(n => ({ value: n, label: n }))}
            />
            <span style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 4 }}>
              {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Button size="small" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</Button>
            <span style={{ fontSize: 12 }}>{page} / {totalPages}</span>
            <Button size="small" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</Button>
          </div>
        </div>
      </div>

      {createPortal(
        <UpdateMemberDrawer
          selectedMemberId={selectedMemberId}
          selectedMemberName={selectedMemberName}
          initialRoleName={selectedMemberRole || undefined}
          onNameUpdate={handleNameUpdate}
          onRoleUpdate={handleRoleUpdate}
          onJobTitleUpdate={handleJobTitleUpdate}
          onTeamLeadUpdate={handleTeamLeadUpdate}
        />,
        document.body
      )}
    </div>
  );
};

export default HomeMyTeam;
