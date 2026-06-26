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

  const handleToggle = (memberId: string) => {
    dispatch(toggleAssignee(memberId));
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
          placeholder={t('searchPlaceholder', {
            defaultValue: 'Search by task name, key, or description',
          })}
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
        />
        <Flex justify="space-between" align="center">
          <Checkbox
            checked={selectedAssignees.includes('unassigned')}
            onChange={() => handleToggle('unassigned')}
          >
            {t('unassigned', { defaultValue: 'Unassigned' })}
          </Checkbox>
          <Button type="link" size="small" onClick={handleClearAll}>
            {t('clearAll', { defaultValue: 'Clear All' })}
          </Button>
        </Flex>
        {loading ? (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        ) : (
          <Flex vertical gap={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
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
      dropdownRender={() => dropdownContent}
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
