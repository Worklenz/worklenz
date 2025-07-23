import { useMemo, useRef, useState } from 'react';
import {
  InputRef,
  PlusOutlined,
  UsergroupAddOutlined,
  Card,
  Flex,
  Input,
  List,
  Typography,
  Checkbox,
  Divider,
  Button,
  Empty,
  Dropdown,
  CheckboxChangeEvent,
} from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@features/projects/singleProject/members/projectMembersSlice';
import { colors } from '@/styles/colors';
import { useTranslation } from 'react-i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

interface BoardAssigneeSelectorProps {
  task: IProjectTask;
  groupId: string | null;
}

const BoardAssigneeSelector = ({ task, groupId = null }: BoardAssigneeSelectorProps) => {
  const membersInputRef = useRef<InputRef>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();

  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);

  const filteredMembersData = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  const handleInviteProjectMemberDrawer = () => {
    dispatch(toggleProjectMemberDrawer());
  };

  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      const assignees = task?.assignees?.map(assignee => assignee.team_member_id);
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: assignees?.includes(member.id),
      }));
      let sortedMembers = sortTeamMembers(membersData);

      setTeamMembers({ data: sortedMembers });

      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    } else {
      setTeamMembers(members || { data: [] });
    }
  };

  const handleMemberChange = (e: CheckboxChangeEvent | null, memberId: string) => {
    if (!memberId || !projectId || !task?.id || !currentSession?.id) return;
    const checked =
      e?.target.checked ||
      !task?.assignees?.some(assignee => assignee.team_member_id === memberId) ||
      false;

    const body = {
      team_member_id: memberId,
      project_id: projectId,
      task_id: task.id,
      reporter_id: currentSession?.id,
      mode: checked ? 0 : 1,
      parent_task: task.parent_task_id,
    };

    socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
  };

  const checkMemberSelected = (memberId: string) => {
    if (!memberId) return false;
    const assignees = task?.assignees?.map(assignee => assignee.team_member_id);
    return assignees?.includes(memberId);
  };

  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={{ padding: 0, height: 250, overflow: 'auto' }}>
          {filteredMembersData?.length ? (
            filteredMembersData.map(member => (
              <List.Item
                className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'} ${member.pending_invitation ? 'disabled cursor-not-allowed' : ''}`}
                key={member.id}
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={e => handleMemberChange(null, member.id || '')}
              >
                <Checkbox
                  id={member.id}
                  checked={checkMemberSelected(member.id || '')}
                  onChange={e => handleMemberChange(e, member.id || '')}
                  disabled={member.pending_invitation}
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
                    {member.pending_invitation && (
                      <Typography.Text type="danger" style={{ fontSize: 10 }}>
                        ({t('pendingInvitation')})
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

        <Divider style={{ marginBlock: 0 }} />

        <Button
          icon={<UsergroupAddOutlined />}
          type="text"
          style={{
            color: colors.skyBlue,
            border: 'none',
            backgroundColor: colors.transparent,
            width: '100%',
          }}
          onClick={handleInviteProjectMemberDrawer}
        >
          {t('assigneeSelectorInviteButton')}
        </Button>

        {/* <Divider style={{ marginBlock: 8 }} /> */}

        {/* <Button
          type="primary"
          style={{ alignSelf: 'flex-end' }}
          size="small"
          onClick={handleAssignMembers}
        >
          {t('okButton')}
        </Button> */}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
    >
      <Button
        type="dashed"
        shape="circle"
        size="small"
        onClick={e => e.stopPropagation()}
        icon={
          <PlusOutlined
            style={{
              fontSize: 12,
              width: 22,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        }
      />
    </Dropdown>
  );
};

export default BoardAssigneeSelector;
