import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import { UserAddOutlined } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { useAuthService } from '@/hooks/useAuth';
import { Avatar, Button, Checkbox } from '@/components';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setIsFromAssigner,
  toggleProjectMemberDrawer,
} from '@/features/projects/singleProject/members/projectMembersSlice';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { useTranslation } from 'react-i18next';

interface PhaseAssigneeSelectorProps {
  phase: ITaskPhase;
  projectId: string;
  isDarkMode?: boolean;
  isOpen: boolean;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLDivElement | null>;
}

const PhaseAssigneeSelector: React.FC<PhaseAssigneeSelectorProps> = ({
  phase,
  projectId,
  isDarkMode = false,
  isOpen,
  onClose,
  triggerRef,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [openUpward, setOpenUpward] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(phase.default_assignee_id || null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const members = useSelector((state: RootState) => state.teamMembersReducer.teamMembers);
  const dispatch = useAppDispatch();
  const { isAdmin } = useAuthStatus();
  const isProjectManager = useIsProjectManager();
  const { t } = useTranslation('phases-drawer');

  const filteredMembers = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  const updateDropdownPosition = useCallback(() => {
    const buttonElement = triggerRef?.current;
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      const dropdownHeight = dropdownRef.current?.offsetHeight || 300;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const shouldOpenUpward = spaceBelow < dropdownHeight && spaceAbove >= dropdownHeight;
      setOpenUpward(shouldOpenUpward);

      if (shouldOpenUpward) {
        setDropdownPosition({
          top: Math.max(0, rect.top + window.scrollY - dropdownHeight - 4),
          left: rect.left + window.scrollX,
        });
      } else {
        setDropdownPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX,
        });
      }
    }
  }, [triggerRef]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Use RAF to ensure DOM is ready before positioning
      requestAnimationFrame(() => {
        updateDropdownPosition();
        // Focus search input
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      });

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, updateDropdownPosition, onClose]);

  const handleMemberToggle = async (memberId: string) => {
    if (!memberId || !projectId) return;

    try {
      let assigneeId: string | null = memberId;

      // If the same member is selected, deselect them
      if (selectedAssigneeId === memberId) {
        assigneeId = null;
      }

      setSelectedAssigneeId(assigneeId);

      // Call API to update phase default assignee
      await phasesApiService.updateDefaultAssignee(phase.id, projectId, assigneeId);

      // Refresh phase data from backend
      dispatch(fetchPhasesByProjectId(projectId));

      // Close dropdown after a short delay to allow state update
      setTimeout(() => {
        onClose();
      }, 300);
    } catch (error) {
      console.error('Error updating phase assignee:', error);
      // Reset state on error
      setSelectedAssigneeId(phase.default_assignee_id || null);
    }
  };

  const handleInviteProjectMemberDrawer = () => {
    onClose();
    dispatch(setIsFromAssigner(true));
    dispatch(toggleProjectMemberDrawer());
  };

  // Initialize/update team members when dropdown opens or phase/members change
  useEffect(() => {
    if (isOpen && members?.data && members.data.length > 0) {
      const membersData = members.data.map(member => ({
        ...member,
        selected: member.id === phase.default_assignee_id,
      }));
      const sortedMembers = sortTeamMembers(membersData);
      setTeamMembers({ data: sortedMembers });
      setSelectedAssigneeId(phase.default_assignee_id || null);
    }
  }, [isOpen, members, phase.default_assignee_id]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      onClick={e => e.stopPropagation()}
      className={`
        fixed z-[9999999] w-72 rounded-md shadow-lg border
        ${isDarkMode ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}
      `}
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
      }}
    >
      {/* Search Header */}
      <div className={`p-3 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchMembers', { defaultValue: 'Search members...' })}
          className={`
            w-full px-3 py-2 text-xs rounded border
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
                flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors
                ${
                  member.pending_invitation
                    ? 'opacity-50 cursor-not-allowed'
                    : isDarkMode
                      ? 'hover:bg-gray-700/50'
                      : 'hover:bg-gray-50'
              }
            `}
              onClick={() => {
                if (!member.pending_invitation) {
                  handleMemberToggle(member.id || '');
                }
              }}
            >
              <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                <Checkbox
                  checked={selectedAssigneeId === member.id}
                  onChange={() => handleMemberToggle(member.id || '')}
                  disabled={member.pending_invitation}
                  isDarkMode={isDarkMode}
                />
              </div>

              <Avatar
                src={member.avatar_url}
                name={member.name || ''}
                size={28}
                isDarkMode={isDarkMode}
              />

              <div className="flex-1 min-w-0">
                <div
                  className={`text-xs font-medium truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
                >
                  {member.name}
                </div>
                <div
                  className={`text-xs truncate ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}
                >
                  {member.email}
                  {member.pending_invitation && (
                    <span className="text-red-400 ml-1">
                      {t('pendingMemberLabel', { defaultValue: '(Pending)' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div
            className={`p-4 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}
          >
            <div className="text-xs">{t('noMembersFound', { defaultValue: 'No members found' })}</div>
          </div>
        )}
      </div>

      {/* Footer - Invite Member */}
      {(isAdmin || isProjectManager) && (
        <div className={`p-3 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
          <button
            className={`
              w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded font-medium
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
            {t('inviteMember', { defaultValue: 'Invite member' })}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default PhaseAssigneeSelector;
