import React from 'react';
import { Flex, Segmented, Select, Input, DatePicker } from '@/shared/antd-imports';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

export type DateFilter = 'today' | 'yesterday' | 'last_week' | 'overdue' | 'no_logged_time' | 'custom';

interface Project {
  id: string;
  name: string;
}

interface TimeEntriesFiltersProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  dateRange: [string, string] | null;
  onDateRangeChange: (range: [string, string] | null) => void;
  projectId: string | undefined;
  onProjectChange: (id: string | undefined) => void;
  projects: Project[];
  onSearch: (q: string) => void;
}

export const TimeEntriesFilters: React.FC<TimeEntriesFiltersProps> = ({
  dateFilter,
  onDateFilterChange,
  dateRange,
  onDateRangeChange,
  projectId,
  onProjectChange,
  projects,
  onSearch,
}) => {
  const { t } = useTranslation('time-entries');
  const [searchValue, setSearchValue] = React.useState('');
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => onSearch(value), 300);
  };

  React.useEffect(() => () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  const handleRangeChange = (_: [Dayjs | null, Dayjs | null] | null, dateStrings: [string, string]) => {
    if (dateStrings[0] && dateStrings[1]) {
      onDateRangeChange([dateStrings[0], dateStrings[1]]);
    } else {
      onDateRangeChange(null);
    }
  };

  const dateOptions = [
    { label: t('filterDueToday', { defaultValue: 'Due Today' }), value: 'today' },
    { label: t('filterYesterday', { defaultValue: 'Yesterday' }), value: 'yesterday' },
    { label: t('filterLastWeek', { defaultValue: 'Last Week' }), value: 'last_week' },
    { label: t('filterOverdue', { defaultValue: 'Overdue' }), value: 'overdue' },
    { label: t('filterNoLoggedTime', { defaultValue: 'No Logged Time' }), value: 'no_logged_time' },
    { label: t('filterCustomRange', { defaultValue: 'Custom Range' }), value: 'custom' },
  ];

  return (
    <Flex gap={12} wrap="wrap" align="center" style={{ marginBottom: 16 }}>
      <Segmented
        value={dateFilter}
        options={dateOptions}
        onChange={v => onDateFilterChange(v as DateFilter)}
      />
      {dateFilter === 'custom' && (
        <DatePicker.RangePicker
          value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
          onChange={handleRangeChange}
          format="YYYY-MM-DD"
          allowClear
        />
      )}
      <Select
        allowClear
        showSearch
        placeholder={t('filterProject', { defaultValue: 'All Projects' })}
        value={projectId}
        onChange={onProjectChange}
        filterOption={(input, opt) =>
          (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
        }
        options={projects.map(p => ({ value: p.id, label: p.name }))}
        style={{ minWidth: 180 }}
      />
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('searchPlaceholder', { defaultValue: 'Search task name or ID...' })}
        value={searchValue}
        onChange={e => handleSearchChange(e.target.value)}
        allowClear
        style={{ width: 240 }}
      />
    </Flex>
  );
};
