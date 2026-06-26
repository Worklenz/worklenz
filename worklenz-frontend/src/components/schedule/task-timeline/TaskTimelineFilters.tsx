import React from 'react';
import { Select, DatePicker, Button, Space, Flex } from '@/shared/antd-imports';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface Project {
  id: string;
  name: string;
}

interface Member {
  id: string;
  name: string;
}

interface Status {
  id: string;
  name: string;
  color_code: string;
}

interface Priority {
  id: string;
  name: string;
  color_code: string;
}

interface TaskTimelineFiltersProps {
  projects: Project[];
  members: Member[];
  statuses?: Status[];
  priorities?: Priority[];
  selectedProjectId: string | null;
  selectedMemberId: string | null;
  selectedStatusId: string | null;
  selectedPriorityId: string | null;
  dateRange: [Dayjs | null, Dayjs | null];
  onProjectChange: (projectId: string | null) => void;
  onMemberChange: (memberId: string | null) => void;
  onStatusChange: (statusId: string | null) => void;
  onPriorityChange: (priorityId: string | null) => void;
  onDateRangeChange: (dates: [Dayjs | null, Dayjs | null]) => void;
  onClearFilters: () => void;
  isLoading?: boolean;
}

const TaskTimelineFilters: React.FC<TaskTimelineFiltersProps> = ({
  projects,
  members,
  statuses = [],
  priorities = [],
  selectedProjectId,
  selectedMemberId,
  selectedStatusId,
  selectedPriorityId,
  dateRange,
  onProjectChange,
  onMemberChange,
  onStatusChange,
  onPriorityChange,
  onDateRangeChange,
  onClearFilters,
  isLoading = false,
}) => {
  const { t } = useTranslation('schedule');
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const hasActiveFilters =
    selectedProjectId ||
    selectedMemberId ||
    selectedStatusId ||
    selectedPriorityId ||
    dateRange[0] ||
    dateRange[1];

  return (
    <Flex
      gap={12}
      align="center"
      wrap="wrap"
      style={{
        padding: '12px 16px',
        backgroundColor: themeWiseColor('#fafafa', '#1f1f1f', themeMode),
        borderRadius: '8px',
        marginBottom: '16px',
      }}
    >
      <FilterOutlined style={{ color: themeWiseColor('#666', '#999', themeMode) }} />

      {/* Project Filter */}
      <Select
        placeholder={t('filterByProject', { defaultValue: 'Project' })}
        value={selectedProjectId}
        onChange={onProjectChange}
        allowClear
        style={{ minWidth: 160 }}
        loading={isLoading}
        showSearch
        optionFilterProp="children"
      >
        {projects.map(project => (
          <Option key={project.id} value={project.id}>
            {project.name}
          </Option>
        ))}
      </Select>

      {/* Member Filter */}
      <Select
        placeholder={t('filterByMember', { defaultValue: 'Team Member' })}
        value={selectedMemberId}
        onChange={onMemberChange}
        allowClear
        style={{ minWidth: 160 }}
        loading={isLoading}
        showSearch
        optionFilterProp="children"
      >
        {members.map(member => (
          <Option key={member.id} value={member.id}>
            {member.name}
          </Option>
        ))}
      </Select>

      {/* Status Filter */}
      {statuses.length > 0 && (
        <Select
          placeholder={t('filterByStatus', { defaultValue: 'Status' })}
          value={selectedStatusId}
          onChange={onStatusChange}
          allowClear
          style={{ minWidth: 140 }}
          loading={isLoading}
        >
          {statuses.map(status => (
            <Option key={status.id} value={status.id}>
              <Flex align="center" gap={8}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: status.color_code,
                  }}
                />
                {status.name}
              </Flex>
            </Option>
          ))}
        </Select>
      )}

      {/* Priority Filter */}
      {priorities.length > 0 && (
        <Select
          placeholder={t('filterByPriority', { defaultValue: 'Priority' })}
          value={selectedPriorityId}
          onChange={onPriorityChange}
          allowClear
          style={{ minWidth: 140 }}
          loading={isLoading}
        >
          {priorities.map(priority => (
            <Option key={priority.id} value={priority.id}>
              <Flex align="center" gap={8}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: priority.color_code,
                  }}
                />
                {priority.name}
              </Flex>
            </Option>
          ))}
        </Select>
      )}

      {/* Date Range Filter */}
      <RangePicker
        value={dateRange}
        onChange={dates => onDateRangeChange(dates as [Dayjs | null, Dayjs | null])}
        placeholder={[
          t('startDate', { defaultValue: 'Start Date' }),
          t('endDate', { defaultValue: 'End Date' }),
        ]}
        style={{ minWidth: 240 }}
      />

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          type="text"
          icon={<ClearOutlined />}
          onClick={onClearFilters}
          style={{ color: themeWiseColor('#666', '#999', themeMode) }}
        >
          {t('clearFilters', { defaultValue: 'Clear' })}
        </Button>
      )}
    </Flex>
  );
};

export default TaskTimelineFilters;
