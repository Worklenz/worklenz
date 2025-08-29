import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { PlusOutlined, UserAddOutlined } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { Avatar, Button, Checkbox } from '@/components';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setIsFromAssigner,
  toggleProjectMemberDrawer,
} from '@/features/projects/singleProject/members/projectMembersSlice';
import { updateEnhancedKanbanTaskAssignees } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAuthStatus } from '@/hooks/useAuthStatus';

interface AssigneeSelectorProps {
  task: IProjectTask;
  groupId?: string | null;
  isDarkMode?: boolean;
  kanbanMode?: boolean;
}

const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
  task,
  groupId = null,
  isDarkMode = false,
  kanbanMode = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [optimisticAssignees, setOptimisticAssignees] = useState<string[]>([]); // For optimistic updates
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set()); // Track pending member changes
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { projectId } = useSelector((state: RootState) => state.projectReducer);
  const members = useSelector((state: RootState) => state.teamMembersReducer.teamMembers);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const { isAdmin } = useAuthStatus();
  const isProjectManager = useIsProjectManager();

  const filteredMembers = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 2,
        left: rect.left + window.scrollX,
      });
    }
  }, []);

  // Close dropdown when clicking outside and handle scroll
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        // Check if the button is still visible in the viewport
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const isVisible =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth;

          if (isVisible) {
            updateDropdownPosition();
          } else {
            // Hide dropdown if button is not visible
            setIsOpen(false);
          }
        }
      }
    };

    const handleResize = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    } else {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, updateDropdownPosition]);

  const handleDropdownToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isOpen) {
      updateDropdownPosition();

      // Prepare team members data when opening
      const assignees = task?.assignees?.map(assignee => assignee.team_member_id);
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: assignees?.includes(member.id),
      }));
      const sortedMembers = sortTeamMembers(membersData);
      setTeamMembers({ data: sortedMembers });

      setIsOpen(true);
      // Focus search input after opening
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    } else {
      setIsOpen(false);
    }
  };

  const handleMemberToggle = (memberId: string, checked: boolean) => {
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
        member.id === memberId ? { ...member, selected: checked } : member
      ),
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
    socket?.once(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), (data: any) => {
      dispatch(updateEnhancedKanbanTaskAssignees(data));
    });

    // Remove from pending changes after a short delay (optimistic)
    setTimeout(() => {
      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }, 500); // Remove pending state after 500ms
  };

  const checkMemberSelected = (memberId: string) => {
    if (!memberId) return false;
    // Use optimistic assignees if available, otherwise fall back to task assignees
    const assignees =
      optimisticAssignees.length > 0
        ? optimisticAssignees
        : task?.assignees?.map(assignee => assignee.team_member_id) || [];
    return assignees.includes(memberId);
  };

  const handleInviteProjectMemberDrawer = () => {
    setIsOpen(false); // Close the assignee dropdown first
    dispatch(setIsFromAssigner(true));
    dispatch(toggleProjectMemberDrawer()); // Then open the invite drawer
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleDropdownToggle}
        className={`
          w-5 h-5 rounded-full border border-dashed flex items-center justify-center
          transition-colors duration-200
          ${
            isOpen
              ? isDarkMode
                ? 'border-blue-500 bg-blue-900/20 text-blue-400'
                : 'border-blue-500 bg-blue-50 text-blue-600'
              : isDarkMode
                ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-gray-400'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-600'
          }
        `}
      >
        <PlusOutlined className="text-xs" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={e => e.stopPropagation()}
            className={`
            fixed z-[99999] w-72 rounded-md shadow-lg border
            ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}
          `}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
          >
            {/* Header */}
            <div className={`p-2 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className={`
                w-full px-2 py-1 text-xs rounded border
                ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
                }
                focus:outline-none focus:ring-1 focus:ring-blue-500
              `}
              />
            </div>

            {/* Members List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map(member => (
                  <div
                    key={member.id}
                    className={`
                    flex items-center gap-2 p-2 cursor-pointer transition-colors
                    ${
                      member.pending_invitation
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
                    style={{
                      // Add visual feedback for immediate response
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    <div className="relative">
                      <span onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={checkMemberSelected(member.id || '')}
                          onChange={checked => handleMemberToggle(member.id || '', checked)}
                          disabled={
                            member.pending_invitation || pendingChanges.has(member.id || '')
                          }
                          isDarkMode={isDarkMode}
                        />
                      </span>
                      {pendingChanges.has(member.id || '') && (
                        <div
                          className={`absolute inset-0 flex items-center justify-center ${
                            isDarkMode ? 'bg-gray-800/50' : 'bg-white/50'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 border border-t-transparent rounded-full animate-spin ${
                              isDarkMode ? 'border-blue-400' : 'border-blue-600'
                            }`}
                          />
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
                      <div
                        className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
                      >
                        {member.name}
                      </div>
                      <div
                        className={`text-xs truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                      >
                        {member.email}
                        {member.pending_invitation && (
                          <span className="text-red-400 ml-1">(Pending)</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  <div className="text-xs">No members found</div>
                </div>
              )}
            </div>

            {/* Footer */}

            {(isAdmin || isProjectManager) && (
              <div className={`p-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
                <button
                  className={`
                  w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded
                  transition-colors
                  ${
                    isDarkMode
                      ? 'text-blue-400 hover:bg-gray-700'
                      : 'text-blue-600 hover:bg-blue-50'
                  }
                `}
                  onClick={handleInviteProjectMemberDrawer}
                >
                  <UserAddOutlined />
                  Invite member
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </>
  );
};

export default AssigneeSelector;
