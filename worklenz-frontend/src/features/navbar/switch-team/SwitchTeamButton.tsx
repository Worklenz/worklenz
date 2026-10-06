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
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';

// Hooks & Services
import { useAuthService } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { createAuthService } from '@/services/auth/auth.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_common_switch_team } from '@/shared/worklenz-analytics-events';
import { navigateAfterTeamSwitch } from '@/utils/team-switch-navigation';

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
  const navigate = useNavigate();
  const location = useLocation();
  const authService = createAuthService(navigate);
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const { t } = useTranslation(['navbar', 'common']);
  const { setIdentity, trackMixpanelEvent } = useMixpanelTracking();
  const { tooltipProps } = useTooltipTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<InputRef>(null);

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

  const handleVerifyAuth = async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      dispatch(setUser(result.user));
      authService.setCurrentSession(result.user);
      setIdentity(result.user);
    }
  };

  const handleTeamSelect = async (id: string) => {
    if (!id) return;

    try {
      trackMixpanelEvent(evt_common_switch_team);
      
      // Switch team and wait for backend to complete the activation
      await dispatch(setActiveTeam(id)).unwrap();
      
      // Add a small delay to ensure database transaction is committed
      // and session is properly updated before verifying
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify authentication to get the updated user session with new team
      await handleVerifyAuth();

      // Shared pages reload in place. Project detail / task short-link pages
      // must leave the old project — reloading them would auto-switch the
      // session back to that project's team via verify-project-access.
      navigateAfterTeamSwitch(location.pathname);
    } catch (error) {
      console.error('Failed to switch team:', error);
      // Optionally show error message to user
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) setSearchQuery('');
  };

  const renderTeamCard = (team: ITeamGetResponse, index: number, total: number) => (
    <Card
      className="switch-team-card"
      onClick={() => team.id && handleTeamSelect(team.id)}
      bordered={false}
      style={{ width: 230 }}
    >
      <Flex vertical>
        <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
          <Flex gap={8} align="center">
            <CustomAvatar avatarName={team.name || ''} />
            <Flex vertical>
              <Typography.Text style={{ fontSize: 11, fontWeight: 300 }}>
                {t('owned-by', { ns: 'common', defaultValue: 'Owned by' })} {team.owns_by}
              </Typography.Text>
              <Typography.Text>{team.name}</Typography.Text>
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

  const dropdownItems = filteredTeams.map((team, index) => ({
    key: team.id || '',
    label: renderTeamCard(team, index, filteredTeams.length),
    type: 'item' as const,
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
      overlayClassName="switch-team-dropdown"
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title={t('switchTeamTooltip')} trigger={'hover'} {...tooltipProps}>
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
