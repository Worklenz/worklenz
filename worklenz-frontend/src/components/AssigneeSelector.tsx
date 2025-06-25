import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { PlusOutlined, UserAddOutlined } from '@ant-design/icons';
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

interface AssigneeSelectorProps {
  task: IProjectTask;
  groupId?: string | null;
  isDarkMode?: boolean;
}

const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({ 
  task, 
  groupId = null, 
  isDarkMode = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { projectId } = useSelector((state: RootState) => state.projectReducer);
  const members = useSelector((state: RootState) => state.teamMembersReducer.teamMembers);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const dispatch = useAppDispatch();

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
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) {
        // Check if the button is still visible in the viewport
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const isVisible = rect.top >= 0 && rect.left >= 0 && 
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

    const body = {
      team_member_id: memberId,
      project_id: projectId,
      task_id: task.id,
      reporter_id: currentSession.id,
      mode: checked ? 0 : 1,
      parent_task: task.parent_task_id,
    };

    socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));
  };

  const checkMemberSelected = (memberId: string) => {
    if (!memberId) return false;
    const assignees = task?.assignees?.map(assignee => assignee.team_member_id);
    return assignees?.includes(memberId) || false;
  };

  const handleInviteProjectMemberDrawer = () => {
    setIsOpen(false); // Close the assignee dropdown first
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
          ${isOpen 
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

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`
            fixed z-[9999] w-72 rounded-md shadow-lg border
            ${isDarkMode 
              ? 'bg-gray-800 border-gray-600' 
              : 'bg-white border-gray-200'
            }
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
          <div className="max-h-48 overflow-y-auto">
            {filteredMembers && filteredMembers.length > 0 ? (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className={`
                    flex items-center gap-2 p-2 cursor-pointer transition-colors
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
                  <Checkbox
                    checked={checkMemberSelected(member.id || '')}
                    onChange={(checked) => handleMemberToggle(member.id || '', checked)}
                    disabled={member.pending_invitation}
                    isDarkMode={isDarkMode}
                  />
                  
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
              <div className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <div className="text-xs">No members found</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
            <button
              className={`
                w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded
                transition-colors
                ${isDarkMode
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
        </div>,
        document.body
      )}
    </>
  );
};

export default AssigneeSelector; 