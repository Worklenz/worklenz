// Ant Design Icons
import { BankOutlined, CaretDownFilled, CheckCircleFilled, PlusOutlined } from '@ant-design/icons';

// Ant Design Components
import { Card, Divider, Dropdown, Flex, Tooltip, Typography, message } from 'antd';

// React
import { useEffect, useState, useCallback, useMemo, memo } from 'react';

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

// Components
import CustomAvatar from '@/components/CustomAvatar';

// API Services
import { teamsApiService } from '@/api/teams/teams.api.service';

// Types
import { IOrganizationTeam } from '@/types/admin-center/admin-center.types';
import { ITeamGetResponse } from '@/types/teams/team.type';

// Styles
import { colors } from '@/styles/colors';
import './switchTeam.css';

// Memoized Team Card Component
const TeamCard = memo<{ 
  team: ITeamGetResponse; 
  index: number; 
  teamsList: ITeamGetResponse[]; 
  isActive: boolean; 
  onSelect: (id: string) => void; 
}>(({ team, index, teamsList, isActive, onSelect }) => {
  const handleClick = useCallback(() => {
    if (team.id) {
      onSelect(team.id);
    }
  }, [team.id, onSelect]);

  return (
    <Card
      className="switch-team-card"
      onClick={handleClick}
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
              color: isActive ? colors.limeGreen : colors.lightGray,
            }}
          />
        </Flex>
        {index < teamsList.length - 1 && <Divider style={{ margin: 0 }} />}
      </Flex>
    </Card>
  );
});

TeamCard.displayName = 'TeamCard';

// Memoized Create Organization Card Component
const CreateOrgCard = memo<{ 
  isCreating: boolean; 
  themeMode: string; 
  onCreateOrg: () => void; 
  t: (key: string) => string; 
}>(({ isCreating, themeMode, onCreateOrg, t }) => {
  const handleClick = useCallback(() => {
    if (!isCreating) {
      onCreateOrg();
    }
  }, [isCreating, onCreateOrg]);

  const avatarStyle = useMemo(() => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: themeMode === 'dark' ? colors.darkGray : colors.lightGray,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }), [themeMode]);

  const cardStyle = useMemo(() => ({
    width: 230,
    opacity: isCreating ? 0.7 : 1,
    cursor: isCreating ? 'not-allowed' : 'pointer'
  }), [isCreating]);

  return (
    <Card
      className="switch-team-card create-org-card"
      onClick={handleClick}
      bordered={false}
      style={cardStyle}
    >
      <Flex vertical>
        <Flex gap={12} align="center" justify="space-between" style={{ padding: '4px 12px' }}>
          <Flex gap={8} align="center">
            <div style={avatarStyle}>
              <PlusOutlined style={{ color: colors.skyBlue, fontSize: 16 }} />
            </div>
            <Flex vertical>
              <Typography.Text style={{ fontSize: 11, fontWeight: 300 }}>
                {t('createNewOrganizationSubtitle')}
              </Typography.Text>
              <Typography.Text style={{ fontWeight: 500 }}>
                {isCreating ? t('creatingOrganization') : t('createNewOrganization')}
              </Typography.Text>
            </Flex>
          </Flex>
        </Flex>
        <Divider style={{ margin: 0 }} />
      </Flex>
    </Card>
  );
});

CreateOrgCard.displayName = 'CreateOrgCard';

const SwitchTeamButton = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authService = useMemo(() => createAuthService(navigate), [navigate]);
  const { getCurrentSession } = useAuthService();
  const session = useMemo(() => getCurrentSession(), [getCurrentSession]);
  const { t } = useTranslation('navbar');

  // State
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Selectors with memoization
  const teamsList = useAppSelector(state => state.teamReducer.teamsList);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const teamsLoading = useAppSelector(state => state.teamReducer.loading);

  // Fetch teams only once on mount
  useEffect(() => {
    if (!teamsLoading && teamsList.length === 0) {
      dispatch(fetchTeams());
    }
  }, [dispatch, teamsLoading, teamsList.length]);

  // Check if user already owns an organization
  const userOwnsOrganization = useMemo(() => {
    return teamsList.some(team => team.owner === true);
  }, [teamsList]);

  // Memoized active team checker
  const isActiveTeam = useCallback((teamId: string): boolean => {
    if (!teamId || !session?.team_id) return false;
    return teamId === session.team_id;
  }, [session?.team_id]);

  // Memoized auth verification handler
  const handleVerifyAuth = useCallback(async () => {
    try {
      const result = await dispatch(verifyAuthentication()).unwrap();
      if (result.authenticated) {
        dispatch(setUser(result.user));
        authService.setCurrentSession(result.user);
      }
    } catch (error) {
      console.error('Auth verification failed:', error);
    }
  }, [dispatch, authService]);

  // Memoized team selection handler
  const handleTeamSelect = useCallback(async (id: string) => {
    if (!id || isCreatingTeam) return;

    try {
      await dispatch(setActiveTeam(id));
      await handleVerifyAuth();
      window.location.reload();
    } catch (error) {
      console.error('Team selection failed:', error);
      message.error(t('teamSwitchError') || 'Failed to switch team');
    }
  }, [dispatch, handleVerifyAuth, isCreatingTeam, t]);

  // Memoized organization creation handler
  const handleCreateNewOrganization = useCallback(async () => {
    if (isCreatingTeam) return;

    try {
      setIsCreatingTeam(true);
      
      const defaultOrgName = `${session?.name || 'User'}'s Organization`;
      const teamData: IOrganizationTeam = {
        name: defaultOrgName
      };

      const response = await teamsApiService.createTeam(teamData);
      
      if (response.done && response.body?.id) {
        message.success(t('organizationCreatedSuccess'));
        
        // Switch to the new team
        await handleTeamSelect(response.body.id);
        
        // Navigate to account setup for the new organization
        navigate('/account-setup');
      } else {
        message.error(response.message || t('organizationCreatedError'));
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || t('organizationCreatedError'));
    } finally {
      setIsCreatingTeam(false);
    }
  }, [isCreatingTeam, session?.name, t, handleTeamSelect, navigate]);

  // Memoized dropdown items
  const dropdownItems = useMemo(() => {
    const teamItems = teamsList?.map((team, index) => ({
      key: team.id || '',
      label: (
        <TeamCard
          team={team}
          index={index}
          teamsList={teamsList}
          isActive={isActiveTeam(team.id || '')}
          onSelect={handleTeamSelect}
        />
      ),
      type: 'item' as const,
    })) || [];

    // Only show create organization option if user doesn't already own one
    if (!userOwnsOrganization) {
      const createOrgItem = {
        key: 'create-new-org',
        label: (
          <CreateOrgCard
            isCreating={isCreatingTeam}
            themeMode={themeMode}
            onCreateOrg={handleCreateNewOrganization}
            t={t}
          />
        ),
        type: 'item' as const,
      };

      return [...teamItems, createOrgItem];
    }

    return teamItems;
  }, [teamsList, isActiveTeam, handleTeamSelect, isCreatingTeam, themeMode, handleCreateNewOrganization, t, userOwnsOrganization]);

  // Memoized button styles
  const buttonStyle = useMemo(() => ({
    color: themeMode === 'dark' ? '#e6f7ff' : colors.skyBlue,
    backgroundColor: themeMode === 'dark' ? '#153450' : colors.paleBlue,
    fontWeight: 500,
    borderRadius: '50rem',
    padding: '10px 16px',
    height: '39px',
    cursor: isCreatingTeam ? 'not-allowed' : 'pointer',
    opacity: isCreatingTeam ? 0.7 : 1,
  }), [themeMode, isCreatingTeam]);

  const textStyle = useMemo(() => ({
    color: colors.skyBlue,
    cursor: 'pointer' as const
  }), []);

  return (
    <Dropdown
      overlayClassName="switch-team-dropdown"
      menu={{ items: dropdownItems }}
      trigger={['click']}
      placement="bottomRight"
      disabled={isCreatingTeam}
    >
      <Tooltip title={t('switchTeamTooltip')} trigger={'hover'}>
        <Flex
          gap={12}
          align="center"
          justify="center"
          style={buttonStyle}
        >
          <BankOutlined />
          <Typography.Text strong style={textStyle}>
            {session?.team_name}
          </Typography.Text>
          <CaretDownFilled />
        </Flex>
      </Tooltip>
    </Dropdown>
  );
};

export default memo(SwitchTeamButton);
