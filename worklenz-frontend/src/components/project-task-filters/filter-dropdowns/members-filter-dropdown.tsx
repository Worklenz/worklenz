import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretDownFilled } from '@/shared/antd-imports';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  List,
  Space,
  Typography,
  InputRef
} from '@/shared/antd-imports';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';

import { colors } from '@/styles/colors';
import SingleAvatar from '@components/common/single-avatar/single-avatar';
import { fetchTaskGroups, setMembers } from '@/features/tasks/tasks.slice';
import { fetchBoardTaskGroups, setBoardMembers } from '@/features/board/board-slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';

interface Member {
  id: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  selected: boolean;
}

const MembersFilterDropdown = () => {
  const membersInputRef = useRef<InputRef>(null);
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useTranslation('task-list-filters');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { taskAssignees } = useAppSelector(state => state.taskReducer);
  const { taskAssignees: boardTaskAssignees } = useAppSelector(state => state.boardReducer);
  const { projectId } = useAppSelector(state => state.projectReducer);

  useEffect(() => {
    if (projectId) {
      // Reset task assignees selections
      const resetTaskMembers = taskAssignees.map(member => ({
        ...member,
        selected: false,
      }));
      dispatch(setMembers(resetTaskMembers));

      // Reset board assignees selections
      const resetBoardMembers = boardTaskAssignees.map(member => ({
        ...member,
        selected: false,
      }));
      dispatch(setBoardMembers(resetBoardMembers));
    }
  }, [projectId, dispatch]);

  const selectedCount = useMemo(() => {
    return projectView === 'list'
      ? taskAssignees.filter(member => member.selected).length
      : boardTaskAssignees.filter(member => member.selected).length;
  }, [taskAssignees, boardTaskAssignees, projectView]);

  const filteredMembersData = useMemo(() => {
    const members = projectView === 'list' ? taskAssignees : boardTaskAssignees;
    return members.filter(member => member.name?.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [taskAssignees, boardTaskAssignees, searchQuery, projectView]);

  const handleSelectedFiltersCount = useCallback(
    async (memberId: string | undefined, checked: boolean) => {
      if (!memberId || !projectId) return;

      const updateMembers = async (members: Member[], setAction: any, fetchAction: any) => {
        const updatedMembers = members.map(member =>
          member.id === memberId ? { ...member, selected: checked } : member
        );
        await dispatch(setAction(updatedMembers));
        dispatch(fetchAction(projectId));
      };
      if (projectView === 'list') {
        await updateMembers(taskAssignees as Member[], setMembers, fetchTaskGroups);
      } else {
        await updateMembers(boardTaskAssignees as Member[], setBoardMembers, fetchBoardTaskGroups);
      }
    },
    [projectId, projectView, taskAssignees, boardTaskAssignees, dispatch]
  );

  const renderMemberItem = (member: Member) => (
    <List.Item
      className={`custom-list-item ${themeMode === 'dark' ? 'dark' : ''}`}
      key={member.id}
      style={{ display: 'flex', gap: 8, padding: '4px 8px', border: 'none' }}
    >
      <Checkbox
        id={member.id}
        checked={member.selected}
        onChange={e => handleSelectedFiltersCount(member.id, e.target.checked)}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SingleAvatar avatarUrl={member.avatar_url} name={member.name} email={member.email} />
          <Flex vertical>
            {member.name}
            <Typography.Text style={{ fontSize: 12, color: colors.lightGray }}>
              {member.email}
            </Typography.Text>
          </Flex>
        </div>
      </Checkbox>
    </List.Item>
  );

  const membersDropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8 } }}>
      <Flex vertical gap={8}>
        <Input
          ref={membersInputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('searchInputPlaceholder')}
        />
        <List style={{ padding: 0, maxHeight: 250, overflow: 'auto' }}>
          {filteredMembersData.length ? (
            filteredMembersData.map((member, index) => renderMemberItem(member as Member))
          ) : (
            <Empty />
          )}
        </List>
      </Flex>
    </Card>
  );

  const handleMembersDropdownOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setTimeout(() => membersInputRef.current?.focus(), 0);
        // Only sync the members if board members are empty
        if (
          projectView === 'kanban' &&
          boardTaskAssignees.length === 0 &&
          taskAssignees.length > 0
        ) {
          dispatch(setBoardMembers(taskAssignees));
        }
      }
    },
    [dispatch, taskAssignees, boardTaskAssignees, projectView]
  );

  const buttonStyle = {
    backgroundColor:
      selectedCount > 0 ? (themeMode === 'dark' ? '#003a5c' : colors.paleBlue) : colors.transparent,
    color: selectedCount > 0 ? (themeMode === 'dark' ? 'white' : colors.darkGray) : 'inherit',
  };

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      trigger={['click']}
      dropdownRender={() => membersDropdownContent}
      onOpenChange={handleMembersDropdownOpen}
    >
      <Button icon={<CaretDownFilled />} iconPosition="end" style={buttonStyle}>
        <Space>
          {t('membersText')}
          {selectedCount > 0 && <Badge size="small" count={selectedCount} color={colors.skyBlue} />}
        </Space>
      </Button>
    </Dropdown>
  );
};

export default MembersFilterDropdown;
