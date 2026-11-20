import { memo, useEffect, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Flex,
  Input,
  Typography,
  Avatar,
  Spin,
} from '@/shared/antd-imports';
import { CaretDownFilled, SearchOutlined, UserOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getTeamMembers } from '@/features/team-members/team-members.slice';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import {
  setSelectedAssignees,
  toggleAssignee,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksAssigneeFilter = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { selectedAssignees } = useAppSelector(state => state.allTasksReportsReducer);
  const { teamMembers, loading } = useAppSelector(state => state.teamMembersReducer);
  const [searchQuery, setSearchQuery] = useState('');

  const membersList: ITeamMemberViewModel[] = teamMembers?.data || [];

  useEffect(() => {
    if (!membersList.length) {
      dispatch(
        getTeamMembers({ index: 0, size: 100, field: null, order: null, search: null, all: true })
      );
    }
  }, [dispatch, membersList.length]);

  const filteredMembers = membersList.filter((m: ITeamMemberViewModel) =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleMemberIds = filteredMembers
    .map((m: ITeamMemberViewModel) => m.id)
    .filter((id): id is string => Boolean(id));

  const allVisibleMembersSelected =
    visibleMemberIds.length > 0 && visibleMemberIds.every(id => selectedAssignees.includes(id));

  const handleToggle = (memberId: string) => {
    dispatch(toggleAssignee(memberId));
    dispatch(fetchAllTasks());
  };

  const handleSelectAllVisible = () => {
    const next = [...new Set([...selectedAssignees, ...visibleMemberIds])];
    dispatch(setSelectedAssignees(next));
    dispatch(fetchAllTasks());
  };

  const handleClearAll = () => {
    dispatch(setSelectedAssignees([]));
    dispatch(fetchAllTasks());
  };

  const dropdownContent = (
    <Card className="custom-card" styles={{ body: { padding: 8, width: 280 } }}>
      <Flex vertical gap={8}>
        <Input
          placeholder={t('searchMembersPlaceholder', { defaultValue: 'Search members...' })}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
        />
        <Flex justify="space-between" align="center">
          <Button
            type="link"
            size="small"
            onClick={handleSelectAllVisible}
            disabled={visibleMemberIds.length === 0 || allVisibleMembersSelected}
            style={{ paddingInline: 0, height: 'auto', fontSize: 12 }}
          >
            {t('selectAll', { defaultValue: 'Select all' })}
          </Button>
          <Button
            type="link"
            size="small"
            onClick={handleClearAll}
            disabled={selectedAssignees.length === 0}
            style={{ paddingInline: 0, height: 'auto', fontSize: 12 }}
          >
            {t('clearAll', { defaultValue: 'Clear all' })}
          </Button>
        </Flex>
        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            <Checkbox
              checked={selectedAssignees.includes('unassigned')}
              onChange={() => handleToggle('unassigned')}
            >
              {t('unassigned', { defaultValue: 'Unassigned' })}
            </Checkbox>
            {filteredMembers.map((member: ITeamMemberViewModel) => (
              <Checkbox
                key={member.id}
                checked={selectedAssignees.includes(member.id || '')}
                onChange={() => handleToggle(member.id || '')}
              >
                <Flex align="center" gap={8}>
                  <Avatar
                    size="small"
                    src={member.avatar_url}
                    icon={!member.avatar_url && <UserOutlined />}
                    style={{ backgroundColor: member.color_code }}
                  />
                  {member.name}
                </Flex>
              </Checkbox>
            ))}
          </Flex>
        )}
      </Flex>
    </Card>
  );

  return (
    <Dropdown
      overlayClassName="custom-dropdown"
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomLeft"
    >
      <Button>
        <Flex align="center" gap={4}>
          {t('assigneeFilter', { defaultValue: 'Assignee' })}
          {selectedAssignees.length > 0 && (
            <Typography.Text type="secondary">({selectedAssignees.length})</Typography.Text>
          )}
          <CaretDownFilled />
        </Flex>
      </Button>
    </Dropdown>
  );
};

export default memo(AllTasksAssigneeFilter);
