import { teamsApiService } from '@/api/teams/teams.api.service';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { setActiveTeam } from '@/features/teams/teamSlice';
import { setUser } from '@/features/user/userSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { createAuthService } from '@/services/auth/auth.service';
import { ITeamInvitationViewModel } from '@/types/notifications/notifications.types';
import { IAcceptTeamInvite } from '@/types/teams/team.type';
import logger from '@/utils/errorLogger';
import { TFunction } from 'i18next';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface InvitationItemProps {
  item: ITeamInvitationViewModel;
  isUnreadNotifications: boolean;
  t: TFunction;
}

const InvitationItem: React.FC<InvitationItemProps> = ({ item, isUnreadNotifications, t }) => {
  const [accepting, setAccepting] = useState(false);
  const [joining, setJoining] = useState(false);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const authService = createAuthService(navigate);

  const inProgress = () => accepting || joining;

  const acceptInvite = async (showAlert?: boolean) => {
    if (!item.team_member_id) return;

    try {
      setAccepting(true);
      const body: IAcceptTeamInvite = {
        team_member_id: item.team_member_id,
        show_alert: showAlert,
      };
      const res = await teamsApiService.acceptInvitation(body);
      setAccepting(false);
      if (res.done && res.body.id) {
        return res.body;
      }
    } catch (error) {
      logger.error('Error accepting invitation', error);
    }
    return null;
  };

  const handleVerifyAuth = async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      dispatch(setUser(result.user));
      authService.setCurrentSession(result.user);
    }
  };

  const acceptAndJoin = async () => {
    try {
      const res = await acceptInvite(true);
      if (res && res.id) {
        setJoining(true);
        await dispatch(setActiveTeam(res.id));
        await handleVerifyAuth();
        window.location.reload();
        setJoining(false);
      }
    } catch (error) {
      logger.error('Error accepting and joining invitation', error);
    } finally {
      setAccepting(false);
      setJoining(false);
    }
  };

  return (
    <div
      style={{ width: 'auto' }}
      className="ant-notification-notice worklenz-notification rounded-4"
    >
      <div className="ant-notification-notice-content">
        <div className="ant-notification-notice-description">
          You have been invited to work with <b>{item.team_name}</b>.
        </div>
        {isUnreadNotifications && (
          <div
            className="mt-2"
            style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}
          >
            <button
              onClick={() => acceptInvite(true)}
              disabled={inProgress()}
              className="p-0"
              style={{
                background: 'none',
                border: 'none',
                cursor: inProgress() ? 'not-allowed' : 'pointer',
              }}
            >
              {item.accepting ? 'Loading...' : <u>{t('notificationsDrawer.markAsRead')}</u>}
            </button>
            <button
              onClick={() => acceptAndJoin()}
              disabled={inProgress()}
              style={{
                background: 'none',
                border: 'none',
                cursor: inProgress() ? 'not-allowed' : 'pointer',
              }}
            >
              {item.joining ? 'Loading...' : <u>{t('notificationsDrawer.readAndJoin')}</u>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationItem;
