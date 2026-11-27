// Ant Design Icons
import {
  BankOutlined,
  CaretDownFilled,
  CheckCircleFilled,
  SearchOutlined,
} from '@/shared/antd-imports';

// Ant Design Components
import {
  Card,
  Divider,
  Dropdown,
  Flex,
  Input,
  Menu,
  Tooltip,
  Typography,
} from '@/shared/antd-imports';
import { InputRef } from 'antd/es/input';

// Redux Hooks
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';

// Redux Actions
import { fetchTeams, setActiveTeam } from '@/features/teams/teamSlice';
import { projectsApi } from '@/api/projects/projects.v1.api.service';

// Hooks & Services
import { useAuthService } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_common_switch_team } from '@/shared/worklenz-analytics-events';
import { navigateAfterTeamSwitch } from '@/utils/team-switch-navigation';
import worklenzLogo from '@/assets/images/worklenz-light-mode.png';

// Components
import CustomAvatar from '@/components/CustomAvatar';

// Types
import { ITeamGetResponse } from '@/types/teams/team.type';

// Styles
import { colors } from '@/styles/colors';
import './switchTeam.css';
import { useEffect, memo, useMemo, useRef, useState } from 'react';
import { useTooltipTheme } from '@/hooks/useTooltipTheme';

const SwitchTeamButton = () => {
  const dispatch = useAppDispatch();
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const { t } = useTranslation(['navbar', 'common']);
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { tooltipProps } = useTooltipTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<InputRef>(null);
  const isSwitchingRef = useRef(false);

  // Selectors
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const filteredTeams = useMemo(() => {
    const list = teamsList ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;

    return list.filter(team => team.name?.toLowerCase().includes(query));
  }, [teamsList, searchQuery]);

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  // Focus the search field once the dropdown overlay has mounted. An effect
  // (rather than a setTimeout in the open handler) runs after commit, so the
  // portalled input is guaranteed to exist.
  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  const isActiveTeam = (teamId: string): boolean => {
    if (!teamId || !session?.team_id) return false;
    return teamId === session.team_id;
  };

  const getRoleLabel = (roleName?: string) => {
    switch (roleName?.toLowerCase().trim()) {
      case 'owner':
        return t('ownerRole', { defaultValue: 'Owner' });
      case 'admin':
        return t('adminRole', { defaultValue: 'Admin' });
      case 'team lead':
      case 'teamlead':
        return t('teamLeadRole', { defaultValue: 'Team Lead' });
      case 'member':
        return t('memberRole', { defaultValue: 'Member' });
      default:
        return roleName;
    }
  };

  const handleTeamSelect = async (id: string) => {
    if (!id || isSwitchingRef.current) return;
    if (session?.team_id === id) {
      setIsOpen(false);
      return;
    }

    try {
      isSwitchingRef.current = true;
      setIsOpen(false);
      trackMixpanelEvent(evt_common_switch_team);

      // Drop cached/in-flight project queries from the current team before
      // activate. Hover-prefetches on the projects list otherwise complete
      // after activate and can race with the new session.
      dispatch(projectsApi.util.resetApiState());

      // Persist the active team on the server, then hard-navigate immediately.
      // Do NOT verify/setUser first: updating Redux/session while still on a
      // project-scoped page re-triggers verify-project-access, which can
      // auto-switch the session back to the previous team's project.
      await dispatch(setActiveTeam(id)).unwrap();
      navigateAfterTeamSwitch(window.location.pathname);
    } catch (error) {
      isSwitchingRef.current = false;
      console.error('Failed to switch team:', error);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setSearchQuery('');
  };

  const renderTeamCard = (team: ITeamGetResponse, index: number, total: number) => {
    const roleLabel = getRoleLabel(team.owner ? 'Owner' : team.role_name);

    return (
      <Card
        className="switch-team-card"
        bordered={false}
        style={{ width: 230, cursor: 'pointer' }}
      >
        <Flex vertical>
          <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
            <Flex gap={8} align="center">
              <CustomAvatar
                avatarName={team.name || ''}
                avatarUrl={team.logo_url || undefined}
                fallbackUrl={worklenzLogo}
              />
              <Flex vertical>
                <Typography.Text style={{ fontSize: 11, fontWeight: 300 }}>
                  {t('owned-by', { ns: 'common', defaultValue: 'Owned by' })} {team.owns_by}
                </Typography.Text>
                <Typography.Text>
                  {team.name}
                  {roleLabel && ` (${roleLabel})`}
                </Typography.Text>
              </Flex>
            </Flex>
            <CheckCircleFilled
              style={{
                fontSize: 16,
                color: isActiveTeam(team.id ?? '') ? colors.limeGreen : colors.lightGray,
              }}
            />
          </Flex>
          {index < total - 1 && <Divider style={{ margin: 0 }} />}
        </Flex>
      </Card>
    );
  };

  const dropdownItems = filteredTeams.map((team, index) => ({
    key: team.id || '',
    label: renderTeamCard(team, index, filteredTeams.length),
    type: 'item' as const,
    onClick: () => {
      if (team.id) void handleTeamSelect(team.id);
    },
  }));

  const dropdownContent = (
    <div className="switch-team-dropdown-panel">
      <div className="switch-team-search">
        <Input
          ref={searchInputRef}
          autoFocus
          size="small"
          allowClear
          prefix={<SearchOutlined style={{ opacity: 0.45 }} />}
          placeholder={t('searchTeams', { defaultValue: 'Search teams...' })}
          value={searchQuery}
          onChange={event => setSearchQuery(event.target.value)}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            // Keep Escape working as dismiss (the search input holds focus by
            // default, so it would otherwise be swallowed); let other keys
            // through untouched.
            if (event.key === 'Escape') setIsOpen(false);
          }}
          aria-label={t('searchTeams', { defaultValue: 'Search teams...' })}
        />
      </div>
      {filteredTeams.length === 0 ? (
        <div className="switch-team-empty">
          <Typography.Text type="secondary">
            {t('noTeamsFound', { defaultValue: 'No teams found' })}
          </Typography.Text>
        </div>
      ) : (
        <div className="switch-team-menu-scroll">
          <Menu className="switch-team-menu" selectable={false} items={dropdownItems} />
        </div>
      )}
    </div>
  );

  return (
    <Dropdown
      open={isOpen}
      onOpenChange={handleOpenChange}
      overlayClassName="navbar-switch-team-dropdown"
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      {/* Force-hide the tooltip while the menu is open — otherwise it sits on
          top of the dropdown and steals clicks on the first team rows. */}
      <Tooltip
        title={t('switchTeamTooltip')}
        trigger={['hover']}
        open={isOpen ? false : undefined}
        {...tooltipProps}
      >
        <Flex
          gap={12}
          align="center"
          justify="center"
          style={{
            color: themeMode === 'dark' ? '#e6f7ff' : colors.skyBlue,
            backgroundColor: themeMode === 'dark' ? '#153450' : colors.paleBlue,
            fontWeight: 500,
            borderRadius: '50rem',
            padding: '10px 16px',
            height: '39px',
            cursor: 'pointer',
          }}
        >
          <BankOutlined />
          <Typography.Text strong style={{ color: colors.skyBlue, cursor: 'pointer' }}>
            {session?.team_name}
          </Typography.Text>
          <CaretDownFilled />
        </Flex>
      </Tooltip>
    </Dropdown>
  );
};

export default memo(SwitchTeamButton);
