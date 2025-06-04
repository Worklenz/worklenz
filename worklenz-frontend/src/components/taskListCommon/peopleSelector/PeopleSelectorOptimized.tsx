import React, { useState, useRef, useMemo, useCallback } from 'react';
import { Card, Flex, Input, List, Checkbox, Typography, Divider, Button, Dropdown, Avatar, Tooltip, Empty } from 'antd';
import { InputRef } from 'antd/es/input';
import { UsergroupAddOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleProjectMemberDrawer } from '@/features/projects/singleProject/members/projectMembersSlice';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { colors } from '@/styles/colors';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { selectTeamMembersData } from '@/features/team-members/team-members.selectors';

interface PeopleSelectorOptimizedProps {
  selectedMemberIds: string[];
  task: IProjectTask;
  columnKey: string;
  updateValue: (taskId: string, columnKey: string, value: string) => void;
}

// Memoized member item component
const MemberItem = React.memo(({ 
  member, 
  isSelected, 
  onSelect, 
  themeMode 
}: { 
  member: any; 
  isSelected: boolean; 
  onSelect: (memberId: string) => void; 
  themeMode: string;
}) => {
  const handleClick = useCallback(() => {
    if (member.id) onSelect(member.id);
  }, [member.id, onSelect]);

  const handleCheckboxChange = useCallback(() => {
    if (member.id) onSelect(member.id);
  }, [member.id, onSelect]);

  const itemStyle = useMemo(() => ({
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-start',
    padding: '4px 8px',
    border: 'none',
    cursor: 'pointer',
  }), []);

  const emailStyle = useMemo(() => ({
    fontSize: 12,
    color: colors.lightGray,
  }), []);

  return (
    <List.Item
      className={`${themeMode === 'dark' ? 'custom-list-item dark' : 'custom-list-item'}`}
      style={itemStyle}
      onClick={handleClick}
    >
      <Checkbox 
        checked={isSelected} 
        onClick={e => e.stopPropagation()}
        onChange={handleCheckboxChange}
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
        <Typography.Text style={emailStyle}>
          {member.email}
        </Typography.Text>
      </Flex>
    </List.Item>
  );
});

// Memoized selected member avatar
const SelectedMemberAvatar = React.memo(({ member }: { member: any }) => {
  const avatarStyle = useMemo(() => ({ fontSize: '14px' }), []);
  
  return (
    <Tooltip key={member.id} title={member.name}>
      <Avatar src={member.avatar_url} style={avatarStyle}>
        {!member.avatar_url && member.name ? member.name.charAt(0).toUpperCase() : null}
      </Avatar>
    </Tooltip>
  );
});

const PeopleSelectorOptimized = React.memo<PeopleSelectorOptimizedProps>(({ 
  selectedMemberIds, 
  task, 
  columnKey, 
  updateValue 
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const membersInputRef = useRef<InputRef>(null);
  
  const membersData = useAppSelector(selectTeamMembersData);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();

  // Memoize filtered members data
  const filteredMembersData = useMemo(() => {
    if (!membersData) return [];
    return membersData.filter(member =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [membersData, searchQuery]);

  // Memoize selected members
  const selectedMembers = useMemo(() => {
    if (!membersData || !selectedMemberIds.length) return [];
    return membersData.filter(member => selectedMemberIds.includes(member.id || ''));
  }, [membersData, selectedMemberIds]);

  // Memoize handlers
  const handleInviteProjectMemberDrawer = useCallback(() => {
    dispatch(toggleProjectMemberDrawer());
  }, [dispatch]);

  const handleMembersDropdownOpen = useCallback((open: boolean) => {
    setIsDropdownOpen(open);
    if (open) {
      setTimeout(() => {
        membersInputRef.current?.focus();
      }, 0);
    }
  }, []);

  const handleMemberSelection = useCallback((memberId: string) => {
    const newSelectedIds = selectedMemberIds.includes(memberId)
      ? selectedMemberIds.filter((id: string) => id !== memberId)
      : [...selectedMemberIds, memberId];
    
    if (task.id) {
      updateValue(task.id, columnKey, JSON.stringify(newSelectedIds));
    }
  }, [selectedMemberIds, task.id, columnKey, updateValue]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.currentTarget.value);
  }, []);

  // Memoize styles
  const listStyle = useMemo(() => ({ 
    padding: 0, 
    height: 250, 
    overflow: 'auto' as const 
  }), []);

  const buttonStyle = useMemo(() => ({
    color: colors.skyBlue,
    border: 'none',
    backgroundColor: colors.transparent,
    width: '100%',
  }), []);

  const dividerStyle = useMemo(() => ({ marginBlock: 0 }), []);

  const cardBodyStyle = useMemo(() => ({ padding: 8 }), []);

  const plusIconStyle = useMemo(() => ({
    fontSize: 12,
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }), []);

  // Memoize dropdown content
  const membersDropdownContent = useMemo(() => (
    <Card className="custom-card" styles={{ body: cardBodyStyle }}>
      <Flex vertical>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('searchInputPlaceholder')}
        />

        <List style={listStyle}>
          {filteredMembersData.length ? (
            filteredMembersData.map(member => (
              <MemberItem
                key={member.id || ''}
                member={member}
                isSelected={member.id ? selectedMemberIds.includes(member.id) : false}
                onSelect={handleMemberSelection}
                themeMode={themeMode}
              />
            ))
          ) : (
            <Empty />
          )}
        </List>

        <Divider style={dividerStyle} />

        <Button
          icon={<UsergroupAddOutlined />}
          type="text"
          style={buttonStyle}
          onClick={handleInviteProjectMemberDrawer}
        >
          {t('assigneeSelectorInviteButton')}
        </Button>
      </Flex>
    </Card>
  ), [
    cardBodyStyle,
    searchQuery,
    handleSearchChange,
    t,
    listStyle,
    filteredMembersData,
    selectedMemberIds,
    handleMemberSelection,
    themeMode,
    dividerStyle,
    buttonStyle,
    handleInviteProjectMemberDrawer
  ]);

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
    >
      <Flex align="center" gap={4}>
        {selectedMembers.length > 0 ? (
          <Avatar.Group max={{count: 3}} size="small">
            {selectedMembers.map(member => (
              <SelectedMemberAvatar key={member.id} member={member} />
            ))}
          </Avatar.Group>
        ) : null}
        <Button
          type="dashed"
          shape="circle"
          size="small"
          icon={<PlusOutlined style={plusIconStyle} />}
        />
      </Flex>
    </Dropdown>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.columnKey === nextProps.columnKey &&
    JSON.stringify(prevProps.selectedMemberIds) === JSON.stringify(nextProps.selectedMemberIds)
  );
});

PeopleSelectorOptimized.displayName = 'PeopleSelectorOptimized';

export default PeopleSelectorOptimized; 