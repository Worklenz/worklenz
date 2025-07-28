import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PlusOutlined, UserAddOutlined } from '@/shared/antd-imports';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { Avatar, Checkbox } from '@/components';

interface PeopleDropdownProps {
  selectedMemberIds: string[];
  onMemberToggle: (memberId: string, checked: boolean) => void;
  onInviteClick?: () => void;
  isDarkMode?: boolean;
  className?: string;
  buttonClassName?: string;
  isLoading?: boolean;
  loadMembers?: () => void;
  pendingChanges?: Set<string>;
}

const PeopleDropdown: React.FC<PeopleDropdownProps> = ({
  selectedMemberIds,
  onMemberToggle,
  onInviteClick,
  isDarkMode = false,
  className = '',
  buttonClassName = '',
  isLoading = false,
  loadMembers,
  pendingChanges = new Set(),
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamMembers, setTeamMembers] = useState<ITeamMembersViewModel>({ data: [], total: 0 });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [hasLoadedMembers, setHasLoadedMembers] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const dispatch = useAppDispatch();
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);

  // Load members on demand when dropdown opens
  useEffect(() => {
    if (!hasLoadedMembers && loadMembers && isOpen) {
      loadMembers();
      setHasLoadedMembers(true);
    }
  }, [hasLoadedMembers, loadMembers, isOpen]);

  const filteredMembers = useMemo(() => {
    return teamMembers?.data?.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [teamMembers, searchQuery]);

  // Update dropdown position
  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 280; // More accurate height: header(40) + max-height(192) + footer(40) + padding

      // Check if dropdown would go below viewport
      const spaceBelow = viewportHeight - rect.bottom;
      const shouldShowAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setDropdownPosition({
        top: shouldShowAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
        left: rect.left,
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

    const handleScroll = (event: Event) => {
      if (isOpen) {
        // Only close dropdown if scrolling happens outside the dropdown
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
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
      const membersData = (members?.data || []).map(member => ({
        ...member,
        selected: selectedMemberIds.includes(member.id || ''),
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
    if (!memberId) return;
    onMemberToggle(memberId, checked);

    // Update local team members state for dropdown UI
    setTeamMembers(prev => ({
      ...prev,
      data: (prev.data || []).map(member =>
        member.id === memberId ? { ...member, selected: checked } : member
      ),
    }));
  };

  const checkMemberSelected = (memberId: string) => {
    if (!memberId) return false;
    return selectedMemberIds.includes(memberId);
  };

  const handleInviteProjectMemberDrawer = () => {
    setIsOpen(false); // Close the dropdown first
    if (onInviteClick) {
      onInviteClick();
    } else {
      dispatch(toggleProjectMemberDrawer()); // Then open the invite drawer
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleDropdownToggle}
        className={`
          w-5 h-5 rounded-full border border-dashed flex items-center justify-center
          transition-colors duration-200
          ${buttonClassName}
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
            fixed w-72 rounded-md shadow-lg border people-dropdown-portal ${className}
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
                  <div className="text-xs">
                    {isLoading ? 'Loading members...' : 'No members found'}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`p-2 border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}`}>
              <button
                className={`
                w-full flex items-center justify-center gap-1 px-2 py-1 text-xs rounded
                transition-colors
                ${isDarkMode ? 'text-blue-400 hover:bg-gray-700' : 'text-blue-600 hover:bg-blue-50'}
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

export default PeopleDropdown;
