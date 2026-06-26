import { PlusOutlined, CrownOutlined } from '@/shared/antd-imports';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputRef,
  List,
  Typography,
  Tooltip,
  theme,
} from '@/shared/antd-imports';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TFunction } from 'i18next';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateTaskCounts } from '@/features/task-management/task-management.slice';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { teamMembersApiService } from '@/api/team-members/teamMembers.api.service';
import logger from '@/utils/errorLogger';
import { useBusinessFeatures } from '@/worklenz-ee/hooks/use-business-features';
import { useUpgradePrompt } from '@/worklenz-ee/hooks/use-upgrade-prompt';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import Avatars from '@/components/avatars/avatars';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { setTaskSubscribers } from '@/features/task-drawer/task-drawer.slice';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';

interface NotifyMemberSelectorProps {
  task: ITaskViewModel;
  t: TFunction;
}

const NotifyMemberSelector = ({ task, t }: NotifyMemberSelectorProps) => {
  const { token } = theme.useToken();
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const dispatch = useAppDispatch();
  const { tab } = useTabSearchParam();
  const { isFreeUser: isFree } = useBusinessFeatures();
  const { promptUpgrade } = useUpgradePrompt();

  const membersInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const [members, setMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { subscribers } = useAppSelector(state => state.taskDrawerReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const addNotifyButtonStyles = {
    width: 28,
    height: 28,
    minWidth: 28,
    marginBottom: 4,
    borderRadius: token.borderRadiusSM,
    borderColor: token.colorPrimary,
    color: token.colorPrimary,
    background: token.colorPrimaryBg,
    boxShadow: `0 0 0 1px ${token.colorPrimaryBorder}`,
  };

  const fetchTeamMembers = async () => {
    if (!projectId) return;

    try {
      setTeamMembersLoading(true);
      const response = await teamMembersApiService.getAll(projectId);
      if (response.done) {
        let sortedMembers = sortTeamMembers(response.body || []);

        setMembers({ data: sortedMembers });
      }
    } catch (error) {
      logger.error('Error fetching team members:', error);
    } finally {
      setTeamMembersLoading(false);
    }
  };

  const getSubscribers = async () => {
    if (!task || !task.id) return;
    try {
      const response = await tasksApiService.getSubscribers(task.id);
      if (response.done) {
        dispatch(setTaskSubscribers(response.body || []));
      }
    } catch (error) {
      logger.error('Error fetching subscribers:', error);
    }
  };

  // used useMemo hook for re render the list when searching
  const filteredMembersData = useMemo(() => {
    return members.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  const handleMemberClick = (member: ITeamMemberViewModel, checked: boolean) => {
    if (!task || !connected || !currentSession?.id || !member.id) return;
    try {
      const body = {
        team_member_id: member.id,
        task_id: task.id,
        user_id: member.user_id || null,
        mode: checked ? 0 : 1,
      };
      socket?.emit(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), body);
      socket?.once(SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString(), (data: InlineMember[]) => {
        dispatch(setTaskSubscribers(data));

        // Update Redux state with subscriber status
        dispatch(
          updateTaskCounts({
            taskId: task.id,
            counts: {
              has_subscribers: data && data.length > 0,
            },
          })
        );
      });
    } catch (error) {
      logger.error('Error notifying member:', error);
    }
  };

  // custom dropdown content
  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('taskInfoTab.searchInputPlaceholder')}
        />
        <List
          style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}
          loading={teamMembersLoading}
          size="small"
        >
          {filteredMembersData?.length ? (
            filteredMembersData.map(member => (
              <List.Item
                className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'} ${member.pending_invitation || member.is_pending ? 'disabled' : ''}`}
                key={member.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                  cursor:
                    member.pending_invitation || member.is_pending ? 'not-allowed' : 'pointer',
                  pointerEvents: member.pending_invitation || member.is_pending ? 'none' : 'auto',
                  opacity: member.pending_invitation || member.is_pending ? 0.6 : 1,
                }}
                onClick={e => {
                  if (member.pending_invitation || member.is_pending) return;
                  handleMemberClick(
                    member,
                    !subscribers?.some(sub => sub.team_member_id === member.id)
                  );
                }}
              >
                <Checkbox
                  id={member.id}
                  checked={subscribers?.some(sub => sub.team_member_id === member.id)}
                  onChange={e => e.stopPropagation()}
                  disabled={member.pending_invitation || member.is_pending}
                />
                <div>
                  <SingleAvatar
                    avatarUrl={member.avatar_url}
                    name={member.name}
                    email={member.email}
                  />
                </div>
                <Flex vertical>
                  <Typography.Text>{member.name}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {member.email}&nbsp;
                    {member.is_pending && (
                      <Typography.Text type="danger" style={{ fontSize: 10 }}>
                        ({t('taskInfoTab.pendingInvitation')})
                      </Typography.Text>
                    )}
                  </Typography.Text>
                </Flex>
              </List.Item>
            ))
          ) : (
            <Empty />
          )}
        </List>
      </Flex>
    </Card>
  );

  // function to focus members input
  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      fetchTeamMembers();
      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    }
  };

  useEffect(() => {
    getSubscribers();
  }, [task?.id]);

  const hasSubscribers = Boolean(subscribers?.length);

  if (isFree) {
    return (
      <Flex gap={8}>
        {hasSubscribers ? <Avatars members={subscribers || []} /> : null}
        <Tooltip title={t('common:upgrade-plan')} placement="top">
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
            onClick={() => promptUpgrade()}
          >
            <Button
              type="dashed"
              size="small"
              aria-label={t('taskInfoTab.notify.addSubscriber', {
                defaultValue: 'Add notified member',
              })}
              disabled
              style={addNotifyButtonStyles}
              icon={
                <PlusOutlined
                  style={{
                    fontSize: 13,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              }
            />
            <CrownOutlined style={{ fontSize: '14px', color: '#faad14' }} />
          </div>
        </Tooltip>
      </Flex>
    );
  }

  return (
    <Flex gap={8}>
      {hasSubscribers ? <Avatars members={subscribers || []} /> : null}
      <Dropdown
        overlayClassName="custom-dropdown"
        trigger={['click']}
        dropdownRender={() => membersDropdownContent}
        onOpenChange={handleMembersDropdownOpen}
      >
        <Button
          type="dashed"
          size="small"
          aria-label={t('taskInfoTab.notify.addSubscriber', {
            defaultValue: 'Add notified member',
          })}
          title={t('taskInfoTab.notify.addSubscriber', {
            defaultValue: 'Add notified member',
          })}
          style={addNotifyButtonStyles}
          icon={
            <PlusOutlined
              style={{
                fontSize: 13,
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          }
        />
      </Dropdown>
    </Flex>
  );
};

export default NotifyMemberSelector;
