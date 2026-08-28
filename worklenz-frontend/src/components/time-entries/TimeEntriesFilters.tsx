import React from 'react';
import { Flex, Select, Input, DatePicker, ConfigProvider } from '@/shared/antd-imports';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import PillToggle from '@/pages/home/PillToggle';

export type DateFilter = 'today' | 'yesterday' | 'last_week' | 'no_logged_time' | 'custom';

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

  const [dateError, setDateError] = React.useState<string | null>(null);

  const handleRangeChange = (dates: [Dayjs | null, Dayjs | null] | null, dateStrings: [string, string]) => {
    if (dates && dates[0] && dates[1]) {
      if (dates[1].isBefore(dates[0], 'day')) {
        setDateError('End date must not be before start date.');
        onDateRangeChange(null);
        return;
      }
      setDateError(null);
      onDateRangeChange([dateStrings[0], dateStrings[1]]);
    } else {
      setDateError(null);
      onDateRangeChange(null);
    }
  };

  // Date filters operate on when time was logged, not the task due date.
  const dateOptions: { label: string; value: DateFilter }[] = [
    { label: t('filterToday', { defaultValue: 'Logged for Today' }), value: 'today' },
    { label: t('filterYesterday', { defaultValue: 'Yesterday' }), value: 'yesterday' },
    { label: t('filterLastWeek', { defaultValue: 'Last Week' }), value: 'last_week' },
    { label: t('filterNoLoggedTime', { defaultValue: 'No Logged Time' }), value: 'no_logged_time' },
    { label: t('filterCustomRange', { defaultValue: 'Custom Range' }), value: 'custom' },
  ];

  return (
    <Flex gap={12} wrap="wrap" align="center">
      <PillToggle<DateFilter>
        value={dateFilter}
        options={dateOptions}
        onChange={onDateFilterChange}
      />
      {/* Matches Projects > Overview's own button row (project-list.tsx) — an
          explicit controlHeight/fontSize/borderRadius via ConfigProvider so
          Select and DatePicker line up with the PillToggle beside them
          (antd's `size="small"` preset renders shorter than the pill). */}
      <ConfigProvider
        theme={{
          components: {
            Select: { controlHeight: 30, fontSize: 12, borderRadius: 7 },
            DatePicker: { controlHeight: 30, fontSize: 12, borderRadius: 7 },
          },
        }}
      >
        {dateFilter === 'custom' && (
          <Flex vertical gap={4}>
            <DatePicker.RangePicker
              value={dateRange ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : null}
              onChange={handleRangeChange}
              format="YYYY-MM-DD"
              allowClear
              order={false}
            />
            {dateError && (
              <span style={{ color: '#ff4d4f', fontSize: 12 }}>{dateError}</span>
            )}
          </Flex>
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
          style={{ width: 180, flexShrink: 0 }}
        />
      </ConfigProvider>
      <Input
        prefix={<SearchOutlined />}
        placeholder={t('searchPlaceholder', { defaultValue: 'Search task name or ID...' })}
        value={searchValue}
        onChange={e => handleSearchChange(e.target.value)}
        allowClear
        style={{ width: 240, flexShrink: 0, height: 30, fontSize: 12, borderRadius: 7 }}
      />
    </Flex>
  );
};
