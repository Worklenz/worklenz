import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { UserAddOutlined } from '@ant-design/icons';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { Avatar, Button, Checkbox } from '@/components';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { ILocalSession } from '@/types/auth/session.types';
import { Socket } from 'socket.io-client';
import { DefaultEventsMap } from '@socket.io/component-emitter';
import { ThunkDispatch } from '@reduxjs/toolkit';
import { Dispatch } from 'redux';

interface AssigneeDropdownContentProps {
  task: IProjectTask;
  groupId?: string | null;
  isDarkMode?: boolean;
  projectId: string | null;
  currentSession: ILocalSession | null;
  socket: Socket<DefaultEventsMap, DefaultEventsMap> | null;
  dispatch: ThunkDispatch<any, any, any> & Dispatch<any>;
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
}

const AssigneeDropdownContent: React.FC<AssigneeDropdownContentProps> = ({
  task,
  groupId = null,
  isDarkMode = false,
  projectId,
  currentSession,
  socket,
  dispatch,
  isOpen,
  onClose,
  position,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [optimisticAssignees, setOptimisticAssignees] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const members = useSelector((state: RootState) => state.teamMembersReducer.teamMembers);

  const filteredMembers = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  // Initialize team members data when component mounts
  useEffect(() => {
    if (isOpen) {
      const assignees = task?.assignees?.map(assignee => assignee.team_member_id);
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: assignees?.includes(member.id),
      }));
      const sortedMembers = sortTeamMembers(membersData);
      setTeamMembers({ data: sortedMembers });
      
      // Focus search input after opening
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen, members, task]);

  const handleMemberToggle = useCallback((memberId: string, checked: boolean) => {
    if (!memberId || !projectId || !task?.id || !currentSession?.id) return;

    // Add to pending changes for visual feedback
    setPendingChanges(prev => new Set(prev).add(memberId));

    // OPTIMISTIC UPDATE: Update local state immediately for instant UI feedback
    const currentAssignees = task?.assignees?.map(a => a.team_member_id) || [];
    let newAssigneeIds: string[];

    if (checked) {
      // Adding assignee
      newAssigneeIds = [...currentAssignees, memberId];
    } else {
      // Removing assignee
      newAssigneeIds = currentAssignees.filter(id => id !== memberId);
    }

    // Update optimistic state for immediate UI feedback in dropdown
    setOptimisticAssignees(newAssigneeIds);

    // Update local team members state for dropdown UI
    setTeamMembers(prev => ({
      ...prev,
      data: (prev.data || []).map(member => 
        member.id === memberId 
          ? { ...member, selected: checked }
          : member
      )
    }));

    const body = {
      team_member_id: memberId,
      project_id: projectId,
      task_id: task.id,
      reporter_id: currentSession.id,
      mode: checked ? 0 : 1,
      parent_task: task.parent_task_id,
    };

    // Emit socket event - the socket handler will update Redux with proper types
    socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));

    // Remove from pending changes after a short delay (optimistic)
    setTimeout(() => {
      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }, 500); // Remove pending state after 500ms
  }, [task, projectId, currentSession, socket]);

  const checkMemberSelected = useCallback((memberId: string) => {
    if (!memberId) return false;
    // Use optimistic assignees if available, otherwise fall back to task assignees
    const assignees = optimisticAssignees.length > 0 
      ? optimisticAssignees 
      : task?.assignees?.map(assignee => assignee.team_member_id) || [];
    return assignees.includes(memberId);
  }, [optimisticAssignees, task]);

  const handleInviteProjectMemberDrawer = useCallback(() => {
    onClose(); // Close the assignee dropdown first
    dispatch(toggleProjectMemberDrawer()); // Then open the invite drawer
  }, [onClose, dispatch]);

  return (
    <div
      ref={dropdownRef}
      className={`
        fixed z-9999 w-72 rounded-md shadow-lg border
        ${isDarkMode 
          ? 'bg-gray-800 border-gray-600' 
          : 'bg-white border-gray-200'
        }
      `}
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <div className={`p-2 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className={`
            w-full px-2 py-1 text-xs rounded border
            ${isDarkMode
              ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500'
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
            }
            focus:outline-none focus:ring-1 focus:ring-blue-500
          `}
        />
      </div>

      {/* Members List */}
      <div className="max-h-64 overflow-y-auto">
        {filteredMembers && filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <div
              key={member.id}
              className={`
                flex items-center gap-2 p-2 cursor-pointer transition-colors relative
                ${member.pending_invitation 
                  ? 'opacity-50 cursor-not-allowed' 
                  : isDarkMode 
                    ? 'hover:bg-gray-700' 
                    : 'hover:bg-gray-50'
                }
              `}
              onClick={() => {
                if (!member.pending_invitation) {
                  const isSelected = checkMemberSelected(member.id || '');
                  handleMemberToggle(member.id || '', !isSelected);
                }
              }}
            >
              <div className="relative">
                <Checkbox
                  checked={checkMemberSelected(member.id || '')}
                  onChange={(checked) => handleMemberToggle(member.id || '', checked)}
                  disabled={member.pending_invitation || pendingChanges.has(member.id || '')}
                  isDarkMode={isDarkMode}
                />
                {pendingChanges.has(member.id || '') && (
                  <div className={`absolute inset-0 flex items-center justify-center ${
                    isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'
                  }`}>
                    <div className={`w-3 h-3 border border-t-transparent rounded-full animate-spin ${
                      isDarkMode ? 'border-blue-400' : 'border-blue-600'
                    }`} />
                  </div>
                )}
              </div>
              
              <Avatar
                src={member.avatar_url}
                name={member.name || ''}
                size={24}
                isDarkMode={isDarkMode}
              />
              
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {member.name}
                </div>
                <div className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {member.email}
                  {member.pending_invitation && (
                    <span className="text-red-400 ml-1">(Pending)</span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center">
            <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              No members found
            </div>
          </div>
        )}
      </div>

      {/* Footer - Invite button */}
      <div className={`p-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
        <Button
          icon={<UserAddOutlined />}
          type="text"
          onClick={handleInviteProjectMemberDrawer}
          className={`
            w-full text-left justify-start
            ${isDarkMode 
              ? 'text-blue-400 hover:bg-gray-700' 
              : 'text-blue-600 hover:bg-blue-50'
            }
          `}
          style={{ fontSize: '12px' }}
        >
          Invite team member
        </Button>
      </div>
    </div>
  );
};

export default AssigneeDropdownContent; 