import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { PlusOutlined, UserAddOutlined, theme } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { Avatar, Button, Checkbox } from '@/components';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { IProjectMemberViewModel } from '@/types/projectMember.types';
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
  /** When provided, renders this element as the dropdown trigger instead of the default plus button */
  triggerElement?: React.ReactNode;
  disabled?: boolean;
  /** Overrides the "active project" redux value used for the assign/unassign socket
   * payload's project_id — required on pages where the task list spans multiple
   * projects at once (e.g. Home > My Tasks), since there's no single active project
   * there and falling back to whatever project the user last opened would silently
   * assign against the wrong project. */
  projectIdOverride?: string;
  /** Included in the assign/unassign socket payload so the backend's team-members
   * lookup in its ack response is scoped correctly. Optional — existing callers run
   * inside a single-project view where this has never been needed. */
  teamId?: string;
  /** Hides the "Invite member" footer action — that flow opens a project-scoped
   * invite drawer via the same "active project" redux state this component now lets
   * you override, so it isn't reliable on cross-project pages. */
  hideInviteFooter?: boolean;
  /** Called with the socket ack payload after a successful assign/unassign, in
   * addition to the existing updateEnhancedKanbanTaskAssignees dispatch — for
   * callers whose task list isn't backed by the enhanced-kanban slice (e.g. an RTK
   * Query list) to refresh themselves. */
  onAssigneesChanged?: (data: unknown) => void;
}

const PROJECT_MEMBERS_PAGE_SIZE = 200;
// Hard ceiling on pages fetched per open, purely as a safety net against an
// unexpected server response (e.g. `total` never shrinking) looping forever —
// no real project is expected to come anywhere near this many members.
const MAX_PROJECT_MEMBERS_PAGES = 25;

// The project-scoped members endpoint is paginated (see toPaginationOptions
// in worklenz-controller-base.ts), so a single page can silently truncate the
// list for projects with more members than one page holds. Walk every page
// up front instead of assuming everything fits in the first one.
async function fetchAllProjectMembers(projectId: string): Promise<IProjectMemberViewModel[]> {
  const members: IProjectMemberViewModel[] = [];
  let index = 1;
  let total = Infinity;

  while (members.length < total && index <= MAX_PROJECT_MEMBERS_PAGES) {
    const res = await projectsApiService.getMembers(
      projectId,
      index,
      PROJECT_MEMBERS_PAGE_SIZE,
      null,
      null,
      null
    );
    const page = res.body?.data || [];
    members.push(...page);
    total = res.body?.total ?? members.length;

    if (page.length < PROJECT_MEMBERS_PAGE_SIZE) break; // last page
    index += 1;
  }

  return members;
}

/**
 * AssigneeSelector Component
 * Displays a dropdown for selecting task assignees with automatic position adjustment
 * to prevent overflow at the bottom of the viewport.
 */
const AssigneeSelector: React.FC<AssigneeSelectorProps> = ({
  task,
  groupId = null,
  isDarkMode = false,
  kanbanMode = false,
  triggerElement,
  disabled,
  projectIdOverride,
  teamId,
  hideInviteFooter = false,
  onAssigneesChanged,
}) => {
  const { token } = theme.useToken();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [openUpward, setOpenUpward] = useState(false);
  const [optimisticAssignees, setOptimisticAssignees] = useState<string[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Guards against a slower, now-stale fetch (e.g. quickly closing this
  // dropdown and opening a different row's) overwriting the members list
  // with the wrong project's response after the fact.
  const membersRequestId = useRef(0);

  const { projectId: activeProjectId } = useSelector((state: RootState) => state.projectReducer);
  const projectId = projectIdOverride ?? activeProjectId;
  const members = useSelector((state: RootState) => state.teamMembersReducer.teamMembers);
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();
  const dispatch = useAppDispatch();
  const { isAdmin } = useAuthStatus();
  const isProjectManager = useIsProjectManager();

  // A persistent listener scoped to this task, matched by data.id, instead of
  // a fresh socket.once() per click (see handleMemberToggle below) — with
  // .once(), any two AssigneeSelector instances that both had a click in
  // flight at the same time would BOTH fire on whichever ack arrived first,
  // since Socket.IO invokes every listener registered for an event name.
  // That misapplied one task's update to another and left the second task's
  // real ack with no listener left to receive it.
  useEffect(() => {
    if (!socket || !task?.id) return;
    const handleAssigneesUpdate = (data: { id?: string } & Record<string, unknown>) => {
      if (data?.id !== task.id) return;
      dispatch(updateEnhancedKanbanTaskAssignees(data));
      onAssigneesChanged?.(data);
    };
    socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handleAssigneesUpdate);
    return () => {
      socket.off(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handleAssigneesUpdate);
    };
  }, [socket, task?.id, dispatch, onAssigneesChanged]);

  const filteredMembers = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  /**
   * Calculate dropdown position and determine if it should open upward
   * Uses dynamic height measurement when available, with fallback to estimated height
   */
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      // Use actual dropdown height if available, otherwise estimate based on structure:
      // - Header (search): ~40px
      // - Members list: max-h-48 = 192px
      // - Footer (conditional): ~40px
      // - Total: ~280px (using 300px for safety margin)
      const dropdownHeight = dropdownRef.current?.offsetHeight || 300;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Check if we're in the bottom portion of the viewport
      // Open upward only if there's insufficient space below AND sufficient space above
      const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight;
      setOpenUpward(shouldOpenUpward);

      if (shouldOpenUpward) {
        // Open upward: position bottom of dropdown at top of button
        setDropdownPosition({
          top: Math.max(0, rect.top + window.scrollY - dropdownHeight),
          left: rect.left + window.scrollX,
        });
      } else {
        // Open downward: position top of dropdown at bottom of button
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 2,
          left: rect.left + window.scrollX,
        });
      }
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
    if (disabled) return;
    if (!isOpen) {
      const assignees = task?.assignees?.map(assignee => assignee.team_member_id);

      if (projectIdOverride) {
        // Cross-project caller (e.g. Home > My Tasks, where each row can
        // belong to a different project) — scope the picker to this task's
        // actual project members instead of the whole team roster. Showing
        // the full team here would let a misclick assign someone with zero
        // relationship to the project, and the backend's create_task_assignee
        // silently grants them standing project membership as a side effect,
        // not just a task assignment.
        const requestId = ++membersRequestId.current;
        setTeamMembers({ data: [] });
        setIsLoadingMembers(true);
        // Walks every page of the project's member list (see
        // fetchAllProjectMembers above) instead of assuming a single page
        // covers the whole project — a project with more members than one
        // page holds would otherwise silently hide the rest from this picker.
        fetchAllProjectMembers(projectIdOverride)
          .then(allMembers => {
            if (membersRequestId.current !== requestId) return; // stale response
            const membersData = allMembers.map(pm => ({
              id: pm.team_member_id,
              name: pm.name,
              email: pm.email,
              avatar_url: pm.avatar_url,
              pending_invitation: pm.pending_invitation,
              selected: assignees?.includes(pm.team_member_id || ''),
            }));
            setTeamMembers({ data: sortTeamMembers(membersData) });
          })
          .finally(() => {
            if (membersRequestId.current === requestId) setIsLoadingMembers(false);
          });
      } else {
        const membersData = (members?.data || []).map(member => ({
          ...member,
          selected: assignees?.includes(member.id),
        }));
        setTeamMembers({ data: sortTeamMembers(membersData) });
      }

      setIsOpen(true);

      // Update position after state update and DOM render
      setTimeout(() => {
        updateDropdownPosition();
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
      team_id: teamId,
    };

    // Emit socket event — the persistent, task-scoped listener registered
    // above (not a per-click .once()) picks up the ack and updates Redux.
    socket?.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), JSON.stringify(body));

    // Remove from pending changes after a short delay (optimistic)
    setTimeout(() => {
      setPendingChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(memberId);
        return newSet;
      });
    }, 500);
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
    setIsOpen(false);
    dispatch(setIsFromAssigner(true));
    dispatch(toggleProjectMemberDrawer());
  };

  return (
    <>
      {triggerElement ? (
        // Custom trigger: clone the element and inject onClick so it works even
        // when the child calls stopPropagation (e.g. AvatarGroup)
        <span ref={buttonRef} style={{ display: 'inline-flex', cursor: 'pointer' }}>
          {React.cloneElement(triggerElement as React.ReactElement, {
            onClick: handleDropdownToggle,
          })}
        </span>
      ) : (
        <button
          ref={buttonRef}
          onClick={handleDropdownToggle}
          className={`
            w-5 h-5 rounded-full border border-dashed flex items-center justify-center
            transition-colors duration-200
            ${
              isDarkMode
                ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800 text-gray-400'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-600'
            }
          `}
        >
          <PlusOutlined className="text-xs" />
        </button>
      )}

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={e => e.stopPropagation()}
            data-open-upward={openUpward}
            className="fixed z-[99999] w-72 rounded-md shadow-lg border"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              // Uses the app's actual theme surface/border colors instead of
              // Tailwind's default `gray` palette, which is a cool/blue-tinted
              // gray that visibly clashed with the rest of the (antd-token-driven)
              // UI, especially in dark mode.
              background: token.colorBgElevated,
              borderColor: token.colorBorderSecondary,
            }}
          >
            {/* Header */}
            <div className="p-2 border-b" style={{ borderColor: token.colorBorderSecondary }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search members..."
                className="w-full px-2 py-1 text-xs rounded border focus:outline-none focus:ring-1 focus:ring-blue-500"
                style={{
                  background: token.colorBgContainer,
                  borderColor: token.colorBorderSecondary,
                  color: token.colorText,
                }}
              />
            </div>

            {/* Members List */}
            <div className="max-h-48 overflow-y-auto">
              {filteredMembers && filteredMembers.length > 0 ? (
                filteredMembers.map(member => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-2 p-2 transition-colors ${
                      member.pending_invitation ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!member.pending_invitation) {
                        const isSelected = checkMemberSelected(member.id || '');
                        handleMemberToggle(member.id || '', !isSelected);
                      }
                    }}
                    onMouseEnter={e => {
                      if (!member.pending_invitation) {
                        (e.currentTarget as HTMLDivElement).style.background = token.colorBgTextHover;
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }}
                    style={{
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
                  <div className="text-xs">{isLoadingMembers ? 'Loading members…' : 'No members found'}</div>
                </div>
              )}
            </div>

            {/* Footer */}
            {(isAdmin || isProjectManager) && !hideInviteFooter && (
              <div className="p-2 border-t" style={{ borderColor: token.colorBorderSecondary }}>
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
