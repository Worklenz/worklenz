// Ant Design Icons
import { BankOutlined, CaretDownFilled, CheckCircleFilled } from '@/shared/antd-imports';

// Ant Design Components
import { Card, Divider, Dropdown, Flex, Tooltip, Typography } from '@/shared/antd-imports';

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
import { useNavigate } from 'react-router-dom';
import { createAuthService } from '@/services/auth/auth.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_common_switch_team } from '@/shared/worklenz-analytics-events';

// Components
import CustomAvatar from '@/components/CustomAvatar';

// Styles
import { colors } from '@/styles/colors';
import './switchTeam.css';
import { useEffect, memo } from 'react';
import { useTooltipTheme } from '@/hooks/useTooltipTheme';

const SwitchTeamButton = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authService = createAuthService(navigate);
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const { t } = useTranslation('navbar');
  const { setIdentity, trackMixpanelEvent } = useMixpanelTracking();
  const { tooltipProps } = useTooltipTheme();

  // Selectors
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

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
      
      // Reload the current page so the new team's session/data loads while
      // keeping the user where they were. Pages/routes that aren't valid for
      // the new team already redirect away via their own guards (e.g.
      // AdminGuard, LicenseExpiryGuard, project-view.tsx's 403 handling).
      window.location.reload();
    } catch (error) {
      console.error('Failed to switch team:', error);
      // Optionally show error message to user
    }
  };

  const renderTeamCard = (team: any, index: number) => (
    <Card
      className="switch-team-card"
      onClick={() => handleTeamSelect(team.id)}
      bordered={false}
      style={{ width: 230 }}
    >
      <Flex vertical>
        <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
          <Flex gap={8} align="center">
            <CustomAvatar avatarName={team.name || ''} />
            <Flex vertical>
              <Typography.Text style={{ fontSize: 11, fontWeight: 300 }}>
                Owned by {team.owns_by}
              </Typography.Text>
              <Typography.Text>{team.name}</Typography.Text>
            </Flex>
          </Flex>
          <CheckCircleFilled
            style={{
              fontSize: 16,
              color: isActiveTeam(team.id) ? colors.limeGreen : colors.lightGray,
            }}
          />
        </Flex>
        {index < teamsList.length - 1 && <Divider style={{ margin: 0 }} />}
      </Flex>
    </Card>
  );

  const dropdownItems =
    teamsList?.map((team, index) => ({
      key: team.id || '',
      label: renderTeamCard(team, index),
      type: 'item' as const,
    })) || [];

  return (
    <Dropdown
      overlayClassName="switch-team-dropdown"
      menu={{ items: dropdownItems }}
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
