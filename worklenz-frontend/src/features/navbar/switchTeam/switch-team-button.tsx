// React
import React, { useEffect, useCallback, useMemo } from 'react';

// Ant Design Icons
import { BankOutlined, CaretDownFilled, CheckCircleFilled } from '@ant-design/icons';

// Ant Design Components
import { Card, Divider, Dropdown, Flex, Tooltip, Typography } from '@/components/ui';

// Redux Hooks
import { useAppDispatch } from '@/hooks/use-app-dispatch';
import { useAppSelector } from '@/hooks/use-app-selector';

// Redux Actions
import { fetchTeams, setActiveTeam } from '@/features/teams/team-slice';
import { verifyAuthentication } from '@/features/auth/auth-slice';
import { setUser } from '@/features/user/user-slice';

// Hooks & Services
import { useAuthService } from '@/hooks/use-auth';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createAuthService } from '@/services/auth/auth.service';

// Components
import CustomAvatar from '@/components/custom-avatar';

// Styles
import { colors } from '@/styles/colors';
import './switchTeam.css';

const SwitchTeamButton = React.memo(() => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authService = createAuthService(navigate);
  const { getCurrentSession } = useAuthService();
  const session = getCurrentSession();
  const { t } = useTranslation('navbar');

  // Selectors
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    dispatch(fetchTeams());
  }, [dispatch]);

  // Memoize active team check to prevent recreation
  const isActiveTeam = useCallback((teamId: string): boolean => {
    if (!teamId || !session?.team_id) return false;
    return teamId === session.team_id;
  }, [session?.team_id]);

  // Memoize auth verification handler
  const handleVerifyAuth = useCallback(async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      dispatch(setUser(result.user));
      authService.setCurrentSession(result.user);
    }
  }, [dispatch, authService]);

  // Memoize team selection handler
  const handleTeamSelect = useCallback(async (id: string) => {
    if (!id) return;

    await dispatch(setActiveTeam(id));
    await handleVerifyAuth();
    window.location.reload();
  }, [dispatch, handleVerifyAuth]);

  // Memoize team card renderer to prevent recreation
  const renderTeamCard = useCallback((team: any, index: number) => (
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
  ), [handleTeamSelect, isActiveTeam, teamsList.length]);

  // Memoize dropdown items to prevent recreation on every render
  const dropdownItems = useMemo(() =>
    teamsList?.map((team, index) => ({
      key: team.id || '',
      label: renderTeamCard(team, index),
      type: 'item' as const,
    })) || [],
    [teamsList, renderTeamCard]
  );

  // Memoize container styles based on theme
  const containerStyle = useMemo(() => ({
    color: themeMode === 'dark' ? '#e6f7ff' : colors.skyBlue,
    backgroundColor: themeMode === 'dark' ? '#153450' : colors.paleBlue,
    fontWeight: 500,
    borderRadius: '50rem',
    padding: '10px 16px',
    height: '39px',
    cursor: 'pointer',
  }), [themeMode]);

  // Memoize team name text style
  const teamNameStyle = useMemo(() => ({
    color: colors.skyBlue,
    cursor: 'pointer',
  }), []);

  return (
    <Dropdown
      overlayClassName="switch-team-dropdown"
      menu={{ items: dropdownItems }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title={t('switchTeamTooltip')} trigger={'hover'}>
        <Flex
          gap={12}
          align="center"
          justify="center"
          style={containerStyle}
        >
          <BankOutlined />
          <Typography.Text strong style={teamNameStyle}>
            {session?.team_name}
          </Typography.Text>
          <CaretDownFilled />
        </Flex>
      </Tooltip>
    </Dropdown>
  );
});

SwitchTeamButton.displayName = 'SwitchTeamButton';

export default SwitchTeamButton;
