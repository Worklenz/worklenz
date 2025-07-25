import { BankOutlined, CaretDownFilled, CheckCircleFilled } from '@/shared/antd-imports';
import { Card, Divider, Dropdown, Flex, Tooltip, Typography } from '@/shared/antd-imports';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { fetchTeams, setActiveTeam } from '@/features/teams/teamSlice';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setUser } from '@/features/user/userSlice';
import { useAuthService } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createAuthService } from '@/services/auth/auth.service';
import CustomAvatar from '@/components/CustomAvatar';
import { colors } from '@/styles/colors';
import './SwitchTeamButton.css';
import { useEffect, memo, useCallback, useMemo } from 'react';

const SwitchTeamButton = memo(() => {
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

  const isActiveTeam = useCallback(
    (teamId: string): boolean => {
      if (!teamId || !session?.team_id) return false;
      return teamId === session.team_id;
    },
    [session?.team_id]
  );

  const handleVerifyAuth = useCallback(async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      dispatch(setUser(result.user));
      authService.setCurrentSession(result.user);
    }
  }, [dispatch, authService]);

  const handleTeamSelect = useCallback(
    async (id: string) => {
      if (!id) return;

      await dispatch(setActiveTeam(id));
      await handleVerifyAuth();
      window.location.reload();
    },
    [dispatch, handleVerifyAuth]
  );

  const renderTeamCard = useCallback(
    (team: any, index: number) => (
    <Card
      className="switch-team-card"
      onClick={() => handleTeamSelect(team.id)}
      variant='borderless'
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
  ),
  [handleTeamSelect, isActiveTeam, teamsList.length]
  );

  const dropdownItems = useMemo(
    () =>
      teamsList?.map((team, index) => ({
        key: team.id || '',
        label: renderTeamCard(team, index),
        type: 'item' as const,
      })) || [],
    [teamsList, renderTeamCard]
  );

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
});

SwitchTeamButton.displayName = 'SwitchTeamButton';

export default SwitchTeamButton;
