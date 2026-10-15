import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Typography, theme, UserAddOutlined, type MenuProps } from '@/shared/antd-imports';
import CustomAvatar from '@/components/CustomAvatar';
import { useAuthService } from '@/hooks/useAuth';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleInviteMemberDrawer } from '@/features/settings/member/memberSlice';
import { ROLE_DEFINITIONS } from '@/types/roles/role.types';
import { getSessionRoleName } from '@/utils/role-permissions.utils';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import type { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import {
  HomeWidgetCard,
  WidgetEmpty,
  WidgetError,
  WidgetLoading,
} from '../home-widgets/HomeWidgetCard';
import { WIDGET_DATA_ATTRIBUTE } from '../home-widgets/widgetInteraction';

const MEMBER_LIMIT = 6;
const MY_TEAM_PATH = '/worklenz/home/my-team';

type MembersState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; members: ITeamMemberViewModel[] };

/** The people on the user's team, with a way through to the full team page. */
export const HomeTeamMembersWidget: React.FC = () => {
  const { t } = useTranslation('home');
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [state, setState] = useState<MembersState>({ status: 'loading' });
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    teamMembersApiService
      .get(1, MEMBER_LIMIT, null, null, null)
      .then(response => {
        if (isCancelled) return;
        setState(
          response.done
            ? {
                status: 'ready',
                members: (response.body?.data ?? []).filter(member => member.active !== false || member.pending_invitation),
              }
            : { status: 'error' }
        );
      })
      .catch(() => {
        if (!isCancelled) setState({ status: 'error' });
      });
    return () => {
      isCancelled = true;
    };
  }, [reloadCount]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setReloadCount(count => count + 1);
  }, []);

  // A member who has just been invited shows up as pending: look again once the invite drawer closes.
  const isInviteDrawerOpen = useAppSelector(state => state.memberReducer.isInviteMemberDrawerOpen);
  const wasInviteDrawerOpen = useRef(false);
  useEffect(() => {
    if (wasInviteDrawerOpen.current && !isInviteDrawerOpen) setReloadCount(count => count + 1);
    wasInviteDrawerOpen.current = isInviteDrawerOpen;
  }, [isInviteDrawerOpen]);

  // Who can invite is the same rule the navbar's "Invite Member" action follows, and the drawer
  // that action opens (mounted by the navbar) is the one used here.
  const session = useAuthService().getCurrentSession();
  const canInviteMembers = ROLE_DEFINITIONS[getSessionRoleName(session)]?.canInviteMembers ?? false;
  const isInviteRestricted = Boolean(session?.is_expired);
  const menuItems = useMemo<MenuProps['items']>(
    () =>
      canInviteMembers
        ? [
            {
              key: 'invite',
              icon: <UserAddOutlined aria-hidden />,
              label: t('myTeam.inviteMember', { defaultValue: 'Invite Member' }),
              disabled: isInviteRestricted,
              onClick: () => dispatch(toggleInviteMemberDrawer()),
            },
          ]
        : undefined,
    [canInviteMembers, isInviteRestricted, dispatch, t]
  );

  const goToTeam = () => navigate(MY_TEAM_PATH);

  return (
    <HomeWidgetCard
      menuItems={menuItems}
      title={t('customize.widgets.teamMembers', { defaultValue: 'Team members' })}
    >
      {state.status === 'loading' && <WidgetLoading />}
      {state.status === 'error' && <WidgetError onRetry={retry} />}
      {state.status === 'ready' &&
        (state.members.length === 0 ? (
          <WidgetEmpty
            text={t('teamMembers.empty', { defaultValue: 'No team members yet.' })}
            action={
              <Button size="small" onClick={goToTeam}>
                {t('teamMembers.viewTeam', { defaultValue: 'View team' })}
              </Button>
            }
          />
        ) : (
          <>
            <div {...{ [WIDGET_DATA_ATTRIBUTE]: '' }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.members.map(member => (
                <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <CustomAvatar avatarName={member.name || member.email || '?'} avatarUrl={member.avatar_url} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Typography.Text ellipsis style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>
                      {member.name || member.email}
                    </Typography.Text>
                    <Typography.Text ellipsis style={{ display: 'block', fontSize: 12, color: token.colorTextSecondary }}>
                      {member.pending_invitation
                        ? t('myTeam.pendingInvitation', { defaultValue: 'Pending invitation' })
                        : member.job_title || member.role_name || t('myTeam.defaultRole', { defaultValue: 'Member' })}
                    </Typography.Text>
                  </div>
                </div>
              ))}
            </div>
            <Button type="link" size="small" onClick={goToTeam} style={{ padding: 0, marginTop: 12 }}>
              {t('teamMembers.viewTeam', { defaultValue: 'View team' })}
            </Button>
          </>
        ))}
    </HomeWidgetCard>
  );
};

export default HomeTeamMembersWidget;
