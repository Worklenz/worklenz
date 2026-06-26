import { InputRef } from 'antd/es/input';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import Dropdown from 'antd/es/dropdown';
import Empty from 'antd/es/empty';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Typography from 'antd/es/typography';
import Button from 'antd/es/button';
import { useMemo, useRef, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { PlusOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { useAuthService } from '@/hooks/useAuth';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { setTaskAssignee } from '@/features/task-drawer/task-drawer.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { updateTaskAssignees as updateBoardTaskAssignees } from '@/features/board/board-slice';
import { updateTaskAssignees as updateTasksListTaskAssignees } from '@/features/tasks/tasks.slice';
import { updateEnhancedKanbanTaskAssignees } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_task_assigned } from '@/shared/worklenz-analytics-events';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';
interface TaskDrawerAssigneeSelectorProps {
  task: ITaskViewModel;
}

const TaskDrawerAssigneeSelector = ({ task }: TaskDrawerAssigneeSelectorProps) => {
  const membersInputRef = useRef<InputRef>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const { projectId } = useAppSelector(state => state.projectReducer);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('task-list-table');
  const { tab } = useTabSearchParam();
  const { canCreateTask } = useTaskCreationPermission();

  const dispatch = useAppDispatch();
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const filteredMembersData = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  const handleMembersDropdownOpen = (open: boolean) => {
    if (open) {
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: task?.assignees?.some(assignee => assignee === member.id),
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

  // FIX: Improved handleMemberChange function with proper state checking
  const handleMemberChange = (e: CheckboxChangeEvent | null, memberId: string) => {
    if (!memberId || !projectId || !task?.id || !currentSession?.id) return;

    try {
      // Check if member is currently assigned
      const isCurrentlyAssigned = task?.assignees?.some(assignee => assignee === memberId);

      // Determine the new checked state
      // If event exists (checkbox clicked), use event's checked state
      // If no event (list item clicked), toggle the current state
      const checked = e ? e.target.checked : !isCurrentlyAssigned;

      const body = {
        team_member_id: memberId,
        project_id: projectId,
        task_id: task.id,
        reporter_id: currentSession?.id,
        mode: checked ? 0 : 1, // 0 = add assignee, 1 = remove assignee
        parent_task: task.parent_task_id,
      };

      socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
      socket?.once(
        SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(),
        (data: ITaskAssigneesUpdateResponse) => {
          // Track task assignment (only when adding, not removing)
          if (checked) {
            trackMixpanelEvent(evt_task_assigned, {
              task_id: task.id,
              project_id: projectId,
              assignee_id: memberId,
              assigned_by: currentSession?.id,
              assignment_method: 'task_drawer',
            });
          }

          dispatch(setTaskAssignee(data));
          if (tab === 'tasks-list') {
            dispatch(updateTasksListTaskAssignees(data));
          }
          if (tab === 'board') {
            dispatch(updateEnhancedKanbanTaskAssignees(data));
          }
        }
      );
    } catch (error) {
      console.error('Error updating assignee:', error);
    }
  };

  const checkMemberSelected = (memberId: string) => {
    if (!memberId) return false;

    return task?.assignees?.some(assignee => assignee === memberId);
  };

  // FIX: Prevent event propagation when clicking checkbox to avoid double-triggering
  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
                onClick={e => {
                  if (!member.pending_invitation) {
                    handleMemberChange(null, member.id || '');
                  }
                }}
              >
                <div onClick={handleCheckboxClick}>
                  <Checkbox
                    id={member.id}
                    checked={checkMemberSelected(member.id || '')}
                    onChange={e => handleMemberChange(e, member.id || '')}
                    disabled={member.pending_invitation}
                  />
                </div>
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
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
      disabled={!canCreateTask}
    >
      <Button
        type="dashed"
        shape="circle"
        size="small"
        style={{ display: canCreateTask ? undefined : 'none' }}
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

export default TaskDrawerAssigneeSelector;
