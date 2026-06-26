import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Input,
  Avatar,
  theme,
  Space,
  CaretDownFilled,
  FilterOutlined,
  CheckCircleFilled,
  CheckboxChangeEvent,
  Select,
  Typography,
  Tag,
  Tooltip,
  Spin,
  Alert,
  Empty,
  Badge,
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import {
  setSelectOrDeselectAllMembers,
  setSelectOrDeselectMember,
} from '@/features/reporting/time-reports/time-reports-overview.slice';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import {
  teamLeadMembersApiService,
  TeamLeadWithMembers,
} from '@/api/reporting/team-lead-members.api.service';
import { isCurrentUserAdmin } from '@/utils/team-lead-utils';

// Removed unused interface - using TeamLeadWithMembers from API service instead

const Members: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('time-report');
  const auth = useAuthService();
  const currentSession = auth.getCurrentSession();
  const { members, loadingMembers } = useAppSelector(state => state.timeReportsOverviewReducer);
  const { token } = theme.useToken();

  const [searchText, setSearchText] = useState('');
  const [selectAll, setSelectAll] = useState(true);
  const [selectedTeamLead, setSelectedTeamLead] = useState<string | null>(null);
  const [teamLeadsWithMembers, setTeamLeadsWithMembers] = useState<TeamLeadWithMembers[]>([]);
  const [loadingTeamLeads, setLoadingTeamLeads] = useState(false);
  const [teamLeadError, setTeamLeadError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Check if current user is admin
  const isAdmin = isCurrentUserAdmin(currentSession);

  // Fetch team leads with their managed members if user is admin
  const fetchTeamLeadsWithMembers = useCallback(async () => {
    if (!isAdmin) return;

    try {
      setLoadingTeamLeads(true);
      setTeamLeadError(null);

      // Try the new Team Lead API first
      try {
        const response = await teamLeadMembersApiService.getTeamLeadsWithManagedMembers();
        if (response.done && response.body) {
          setTeamLeadsWithMembers(response.body);
          return; // Success, exit early
        }
      } catch (apiError) {
        console.warn('Team Lead API not available yet, using fallback:', apiError);
      }

      // Fallback: Get team leads from team members API
      const fallbackResponse = await teamMembersApiService.get(1, 1000, 'name', 'asc', '');
      if (fallbackResponse.done && fallbackResponse.body?.data) {
        const teamLeadMembers = fallbackResponse.body.data.filter(
          member => member.role_name?.toLowerCase() === 'team lead'
        );

        // Create fallback data structure with empty managed members
        const fallbackTeamLeads: TeamLeadWithMembers[] = teamLeadMembers.map(tl => ({
          team_lead_id: tl.id || '',
          team_lead_name: tl.name || '',
          team_lead_email: tl.email || '',
          team_lead_avatar_url: tl.avatar_url,
          managed_members: [], // Empty - filtering won't work yet
        }));

        setTeamLeadsWithMembers(fallbackTeamLeads);

        if (fallbackTeamLeads.length === 0) {
          setTeamLeadError('No Team Leads found in your organization');
        }
      } else {
        setTeamLeadError('Unable to load Team Lead data');
      }
    } catch (error) {
      console.error('Error fetching team leads:', error);
      setTeamLeadError('Failed to load Team Lead data. Please try again.');
      setTeamLeadsWithMembers([]);
    } finally {
      setLoadingTeamLeads(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchTeamLeadsWithMembers();
  }, [fetchTeamLeadsWithMembers]);

  // Filter members based on selected team lead
  const membersByTeamLead = useMemo(() => {
    if (!selectedTeamLead || !isAdmin) {
      return members; // Show all members if no team lead selected or not admin
    }

    const teamLead = teamLeadsWithMembers.find(tl => tl.team_lead_id === selectedTeamLead);
    if (!teamLead) {
      return members;
    }

    // Filter members to show only those managed by selected team lead
    const managedMemberIds = teamLead.managed_members.map(m => m.member_id);
    return members.filter(member => managedMemberIds.includes(member.id));
  }, [members, selectedTeamLead, teamLeadsWithMembers, isAdmin]);

  // Calculate active filters count based on filtered members
  const activeFiltersCount = useMemo(() => {
    return membersByTeamLead.filter(member => member.selected).length;
  }, [membersByTeamLead]);

  // Check if all options are selected (from filtered members)
  const isAllSelected =
    membersByTeamLead.length > 0 && membersByTeamLead.every(member => member.selected);
  const isNoneSelected =
    membersByTeamLead.length > 0 && !membersByTeamLead.some(member => member.selected);

  // Apply search filter to the team-lead-filtered members
  const filteredMembers = membersByTeamLead.filter(member =>
    member.name?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Theme-aware colors matching improved task filters
  const isDark = token.colorBgContainer !== '#ffffff';
  const colors = {
    headerText: isDark ? '#8c8c8c' : '#595959',
    borderColor: isDark ? '#404040' : '#f0f0f0',
    linkActive: isDark ? '#d9d9d9' : '#1890ff',
    linkDisabled: isDark ? '#8c8c8c' : '#d9d9d9',
    successColor: isDark ? '#52c41a' : '#52c41a',
    errorColor: isDark ? '#ff4d4f' : '#ff4d4f',
    buttonBorder: isDark ? '#303030' : '#d9d9d9',
    buttonText:
      activeFiltersCount > 0 ? (isDark ? 'white' : '#262626') : isDark ? '#d9d9d9' : '#595959',
    buttonBg:
      activeFiltersCount > 0 ? (isDark ? '#434343' : '#f5f5f5') : isDark ? '#141414' : 'white',
    dropdownBg: isDark ? '#1f1f1f' : 'white',
    dropdownBorder: isDark ? '#303030' : '#d9d9d9',
  };

  // Handle checkbox change for individual members
  const handleCheckboxChange = (id: string, checked: boolean) => {
    dispatch(setSelectOrDeselectMember({ id, selected: checked }));
  };

  // Handle "Select All" checkbox change
  const handleSelectAllChange = (e: CheckboxChangeEvent) => {
    const isChecked = e.target.checked;
    setSelectAll(isChecked);

    // Apply to filtered members only
    membersByTeamLead.forEach(member => {
      dispatch(setSelectOrDeselectMember({ id: member.id, selected: isChecked }));
    });
  };

  // Handle select all button click
  const handleSelectAllClick = () => {
    const newValue = !isAllSelected;
    setSelectAll(newValue);

    // Apply to filtered members only
    membersByTeamLead.forEach(member => {
      dispatch(setSelectOrDeselectMember({ id: member.id, selected: newValue }));
    });
  };

  // Handle clear all
  const handleClearAll = () => {
    setSelectAll(false);

    // Apply to filtered members only
    membersByTeamLead.forEach(member => {
      dispatch(setSelectOrDeselectMember({ id: member.id, selected: false }));
    });
  };

  // Handle team lead selection change
  const handleTeamLeadChange = (teamLeadId: string | null) => {
    setSelectedTeamLead(teamLeadId);
    setSearchText(''); // Clear search when changing team lead filter

    // First, deselect all members
    dispatch(setSelectOrDeselectAllMembers(false));

    // Then select only the relevant members
    const targetMembers = teamLeadId
      ? members.filter(member => {
          const teamLead = teamLeadsWithMembers.find(tl => tl.team_lead_id === teamLeadId);
          return teamLead?.managed_members.some(m => m.member_id === member.id);
        })
      : members;

    targetMembers.forEach(member => {
      dispatch(setSelectOrDeselectMember({ id: member.id, selected: true }));
    });
    setSelectAll(true);
  };

  // Retry loading team leads
  const handleRetryTeamLeads = () => {
    fetchTeamLeadsWithMembers();
  };

  const getButtonText = () => {
    const selectedTeamLeadName = teamLeadsWithMembers.find(
      tl => tl.team_lead_id === selectedTeamLead
    )?.team_lead_name;

    if (isNoneSelected) {
      if (selectedTeamLeadName) {
        return `${selectedTeamLeadName}'s ${t('teamMembers')}`;
      }
      return t('members');
    }

    if (isAllSelected) {
      if (selectedTeamLeadName) {
        return `All ${selectedTeamLeadName}'s ${t('teamMembers')}`;
      }
      return `All ${t('members')}`;
    }

    if (selectedTeamLeadName) {
      return `${selectedTeamLeadName}'s ${t('teamMembers')} (${activeFiltersCount})`;
    }
    return `${t('members')} (${activeFiltersCount})`;
  };

  return (
    <Dropdown
      menu={undefined}
      placement="bottomLeft"
      trigger={['click']}
      open={isDropdownOpen}
      onOpenChange={setIsDropdownOpen}
      dropdownRender={() => (
        <div
          style={{
            background: colors.dropdownBg,
            borderRadius: '8px',
            boxShadow: isDark
              ? '0 6px 16px 0 rgba(0, 0, 0, 0.32), 0 3px 6px -4px rgba(0, 0, 0, 0.32), 0 9px 28px 8px rgba(0, 0, 0, 0.20)'
              : '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
            border: `1px solid ${colors.dropdownBorder}`,
            padding: '4px 0',
            maxHeight: '330px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '4px 4px 2px',
              fontWeight: 600,
              fontSize: '12px',
              color: colors.headerText,
              borderBottom: `1px solid ${colors.borderColor}`,
              marginBottom: '2px',
            }}
          >
            {t('filterMembers')}
          </div>

          {/* Team Lead Filter - Only show for Admins */}
          {isAdmin && (
            <div style={{ padding: '4px 8px', flexShrink: 0 }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}
              >
                <Typography.Text
                  style={{
                    fontSize: '11px',
                    color: colors.headerText,
                    fontWeight: 500,
                  }}
                >
                  {t('filterByTeamLead')}
                </Typography.Text>
                {loadingTeamLeads && <Spin size="small" style={{ fontSize: '10px' }} />}
                {teamLeadError && (
                  <Tooltip title={teamLeadError}>
                    <Button
                      type="link"
                      size="small"
                      onClick={handleRetryTeamLeads}
                      style={{
                        fontSize: '10px',
                        height: 'auto',
                        padding: '0 4px',
                        color: colors.errorColor,
                      }}
                    >
                      Retry
                    </Button>
                  </Tooltip>
                )}
              </div>

              {teamLeadError ? (
                <Alert
                  message={teamLeadError}
                  type="warning"
                  showIcon
                  style={{ fontSize: '11px', marginBottom: '8px', padding: '4px 8px' }}
                  action={
                    <Button size="small" type="text" onClick={handleRetryTeamLeads}>
                      Retry
                    </Button>
                  }
                />
              ) : teamLeadsWithMembers.length === 0 && !loadingTeamLeads ? (
                <div
                  style={{
                    padding: '12px',
                    textAlign: 'center',
                    color: colors.headerText,
                    fontSize: '11px',
                  }}
                >
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No Team Leads found"
                    style={{ margin: 0 }}
                  />
                </div>
              ) : (
                <Select
                  style={{ width: '100%' }}
                  placeholder={loadingTeamLeads ? 'Loading Team Leads...' : t('selectTeamLead')}
                  value={selectedTeamLead}
                  onChange={handleTeamLeadChange}
                  allowClear
                  loading={loadingTeamLeads}
                  size="small"
                  dropdownStyle={{ fontSize: '12px' }}
                  optionLabelProp="title"
                >
                  <Select.Option key="all" value={null} title={t('allMembers')}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '2px 0',
                      }}
                    >
                      <Badge count={members.length} size="small" color="default">
                        <Avatar
                          size={16}
                          icon={<FilterOutlined />}
                          style={{ backgroundColor: '#f0f0f0', color: '#666' }}
                        />
                      </Badge>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{t('allMembers')}</div>
                        <div
                          style={{ fontSize: '10px', color: colors.headerText, lineHeight: 1.2 }}
                        >
                          {t('noFilter')}
                        </div>
                      </div>
                    </div>
                  </Select.Option>
                  {teamLeadsWithMembers.map(tl => (
                    <Select.Option
                      key={tl.team_lead_id}
                      value={tl.team_lead_id}
                      title={tl.team_lead_name}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '2px 0',
                        }}
                      >
                        <Badge count={tl.managed_members.length} size="small" color="blue">
                          <Avatar src={tl.team_lead_avatar_url} size={16}>
                            {tl.team_lead_name.charAt(0)}
                          </Avatar>
                        </Badge>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 500 }}>
                            {tl.team_lead_name}
                          </div>
                          <div
                            style={{ fontSize: '10px', color: colors.headerText, lineHeight: 1.2 }}
                          >
                            {tl.managed_members.length} managed{' '}
                            {tl.managed_members.length === 1 ? 'member' : 'members'}
                          </div>
                        </div>
                        <Tag
                          color="blue"
                          style={{
                            fontSize: '8px',
                            margin: 0,
                            padding: '0 4px',
                            lineHeight: '14px',
                          }}
                        >
                          {t('teamLead')}
                        </Tag>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              )}
            </div>
          )}

          {/* Show selected Team Lead info */}
          {selectedTeamLead && (
            <div
              style={{
                padding: '6px 8px',
                background: isDark
                  ? 'linear-gradient(135deg, #1a237e 0%, #283593 100%)'
                  : 'linear-gradient(135deg, #e8eaf6 0%, #f3e5f5 100%)',
                margin: '4px',
                borderRadius: '6px',
                border: `1px solid ${isDark ? '#3949ab' : '#d1c4e9'}`,
                position: 'relative',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}
              >
                <Avatar
                  src={
                    teamLeadsWithMembers.find(tl => tl.team_lead_id === selectedTeamLead)
                      ?.team_lead_avatar_url
                  }
                  size={20}
                >
                  {teamLeadsWithMembers
                    .find(tl => tl.team_lead_id === selectedTeamLead)
                    ?.team_lead_name?.charAt(0)}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <Typography.Text
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isDark ? '#e8eaf6' : '#3f51b5',
                    }}
                  >
                    {
                      teamLeadsWithMembers.find(tl => tl.team_lead_id === selectedTeamLead)
                        ?.team_lead_name
                    }
                  </Typography.Text>
                  <div
                    style={{
                      fontSize: '10px',
                      color: isDark ? '#c5cae9' : '#5c6bc0',
                      marginTop: '1px',
                    }}
                  >
                    {membersByTeamLead.length}{' '}
                    {membersByTeamLead.length === 1 ? 'member' : 'members'} • {activeFiltersCount}{' '}
                    selected
                  </div>
                </div>
                <Button
                  type="text"
                  size="small"
                  onClick={() => handleTeamLeadChange(null)}
                  style={{
                    fontSize: '10px',
                    height: '20px',
                    width: '20px',
                    padding: 0,
                    color: isDark ? '#c5cae9' : '#5c6bc0',
                  }}
                >
                  ×
                </Button>
              </div>

              {/* Show warning if using fallback mode (no managed members data) */}
              {teamLeadsWithMembers.find(tl => tl.team_lead_id === selectedTeamLead)
                ?.managed_members.length === 0 && (
                <Alert
                  message={t('fallbackModeWarning')}
                  type="warning"
                  showIcon
                  style={{
                    fontSize: '10px',
                    margin: '4px 0 0 0',
                    padding: '4px 8px',
                  }}
                />
              )}
            </div>
          )}

          <Divider style={{ margin: '4px 0', flexShrink: 0 }} />

          {/* Search */}
          <div style={{ padding: '4px 8px', flexShrink: 0 }}>
            <Input
              onClick={e => e.stopPropagation()}
              placeholder={t('searchByMember')}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ fontSize: '14px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ padding: '2px 8px', marginBottom: '2px' }}>
            <Space size="small">
              <Button
                type="link"
                size="small"
                onClick={handleSelectAllClick}
                disabled={isAllSelected}
                style={{
                  padding: '0 2px',
                  height: 'auto',
                  fontSize: '11px',
                  color: isAllSelected ? colors.linkDisabled : colors.linkActive,
                }}
              >
                {t('selectAll')}
              </Button>
              <Divider type="vertical" style={{ margin: '0 2px' }} />
              <Button
                type="link"
                size="small"
                onClick={handleClearAll}
                disabled={isNoneSelected}
                style={{
                  padding: '0 2px',
                  height: 'auto',
                  fontSize: '11px',
                  color: isNoneSelected ? colors.linkDisabled : colors.errorColor,
                }}
              >
                {t('clearAll')}
              </Button>
            </Space>
          </div>

          <Divider style={{ margin: '2px 0', flexShrink: 0 }} />

        {/* Items */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {filteredMembers.map(member => {
              
              const hasAvatar = !!member.avatar_url && member.avatar_url.trim() !== '';
              return (
                <div
                  key={member.id}
                  style={{
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <Avatar
                    src={hasAvatar ? member.avatar_url : undefined}
                    size="small"
                   style={
  !hasAvatar
    ? { backgroundColor: member.color_code?.slice(0, 7), fontSize: '12px' }
    : undefined
}
                  >
                    {!hasAvatar ? member.name?.charAt(0).toUpperCase() : null}
                  </Avatar>
                  <Checkbox
                    onClick={e => e.stopPropagation()}
                    checked={member.selected}
                    onChange={e => handleCheckboxChange(member.id, e.target.checked)}
                    style={{ fontSize: '14px' }}
                  >
                    <span style={{ marginLeft: '2px', fontSize: '14px' }}>{member.name}</span>
                  </Checkbox>
                  {member.selected && (
                    <CheckCircleFilled
                      style={{ color: colors.successColor, fontSize: '10px', marginLeft: 'auto' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    >
      <Badge count={selectedTeamLead ? 1 : 0} size="small" color="blue" offset={[-6, 6]}>
        <Button
          loading={loadingMembers}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '32px',
            fontSize: '12px',
            borderColor: selectedTeamLead ? (isDark ? '#1890ff' : '#1890ff') : colors.buttonBorder,
            color: selectedTeamLead ? (isDark ? '#1890ff' : '#1890ff') : colors.buttonText,
            fontWeight: activeFiltersCount > 0 || selectedTeamLead ? 600 : 400,
            transition: 'all 0.2s ease-in-out',
            backgroundColor: selectedTeamLead ? (isDark ? '#001529' : '#f6ffed') : colors.buttonBg,
            borderRadius: '8px',
            padding: '4px 12px',
            boxShadow: selectedTeamLead
              ? `0 2px 4px ${isDark ? 'rgba(24, 144, 255, 0.2)' : 'rgba(24, 144, 255, 0.1)'}`
              : 'none',
          }}
          onMouseEnter={e => {
            if (!selectedTeamLead) {
              e.currentTarget.style.backgroundColor = isDark ? '#262626' : '#f0f0f0';
            }
          }}
          onMouseLeave={e => {
            if (!selectedTeamLead) {
              e.currentTarget.style.backgroundColor = colors.buttonBg;
            }
          }}
        >
          <FilterOutlined
            style={{
              fontSize: '14px',
              color: selectedTeamLead ? (isDark ? '#1890ff' : '#1890ff') : colors.buttonText,
            }}
          />
          <span>{getButtonText()}</span>
          {loadingTeamLeads && isAdmin && <Spin size="small" style={{ marginLeft: '4px' }} />}
          <CaretDownFilled
            style={{
              fontSize: '10px',
              marginLeft: '2px',
              color: selectedTeamLead ? (isDark ? '#1890ff' : '#1890ff') : colors.buttonText,
              transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease-in-out',
            }}
          />
        </Button>
      </Badge>
    </Dropdown>
  );
};

export default Members;
