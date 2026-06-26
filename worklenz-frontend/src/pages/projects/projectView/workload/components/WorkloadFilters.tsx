import { useState, useCallback } from 'react';
import {
  Flex,
  DatePicker,
  Select,
  Button,
  Switch,
  Popover,
  theme,
  Dropdown,
  Card,
  List,
  Typography,
  Divider,
  Checkbox,
  InputNumber,
} from '@/shared/antd-imports';
import { FilterOutlined, FilterFilled, ReloadOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setDateRange,
  setFilters,
  clearFilters,
  setTimeScale,
  toggleWeekends,
  setWorkingHoursPerDay,
  toggleWorkingDay,
  setWorkingDays,
} from '@/features/project-workload/projectWorkloadSlice';
import projectWorkloadApi from '@/api/project-workload/project-workload.api.service';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface WorkloadFiltersProps {
  onRefresh: () => void;
  isLoading?: boolean;
  isFetching?: boolean;
}

const WorkloadFilters = ({
  onRefresh,
  isLoading = false,
  isFetching = false,
}: WorkloadFiltersProps) => {
  const { t } = useTranslation('workload');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const {
    dateRange,
    filters,
    timeScale,
    capacityUnit,
    showWeekends,
    workingHoursPerDay,
    workingDays,
  } = useAppSelector(state => state.projectWorkload);

  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [selectedTimeFrame, setSelectedTimeFrame] = useState<string>('thisWeek');
  const [customRange, setCustomRange] = useState<[string, string] | null>(null);

  // Enhanced refresh handler with error handling
  const handleRefresh = useCallback(() => {
    try {
      onRefresh();
    } catch (error) {
      console.error('Error in refresh handler:', error);
    }
  }, [onRefresh, dateRange, filters, timeScale, capacityUnit]);

  // Show loading state when fetching
  const isRefreshing = isLoading || isFetching;

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setSelectedTimeFrame('');
      setCustomRange([dates[0].$d.toString(), dates[1].$d.toString()]);
    } else {
      setCustomRange(null);
    }
  };

  const applyCustomDateFilter = () => {
    if (customRange) {
      setSelectedTimeFrame('custom');
      setIsDateDropdownOpen(false);

      // Invalidate cache before setting new date range to ensure fresh data
      dispatch(projectWorkloadApi.util.invalidateTags(['ProjectWorkload']));

      dispatch(
        setDateRange({
          startDate: dayjs(customRange[0]).format('YYYY-MM-DD'),
          endDate: dayjs(customRange[1]).format('YYYY-MM-DD'),
        })
      );
    }
  };

  const getDisplayLabel = () => {
    const f = 'MMM DD, YYYY';
    if (customRange && customRange.length === 2) {
      return `${dayjs(customRange[0]).format(f)} - ${dayjs(customRange[1]).format(f)}`;
    }
    return t(`filters.${selectedTimeFrame}`);
  };

  const dateRangeItems = [
    {
      key: 'today',
      label: 'today',
      dates: dayjs().format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'yesterday',
      label: 'yesterday',
      dates:
        dayjs().subtract(1, 'day').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
    },
    {
      key: 'thisWeek',
      label: 'thisWeek',
      dates:
        dayjs().startOf('week').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().endOf('week').format('YYYY-MM-DD'),
    },
    {
      key: 'lastWeek',
      label: 'lastWeek',
      dates:
        dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD'),
    },
    {
      key: 'last7Days',
      label: 'last7Days',
      dates:
        dayjs().subtract(7, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'thisMonth',
      label: 'thisMonth',
      dates:
        dayjs().startOf('month').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().endOf('month').format('YYYY-MM-DD'),
    },
    {
      key: 'lastMonth',
      label: 'lastMonth',
      dates:
        dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
    },
    {
      key: 'last30Days',
      label: 'last30Days',
      dates:
        dayjs().subtract(30, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'last90Days',
      label: 'last90Days',
      dates:
        dayjs().subtract(90, 'days').format('YYYY-MM-DD') + ' - ' + dayjs().format('YYYY-MM-DD'),
    },
    {
      key: 'thisQuarter',
      label: 'thisQuarter',
      dates:
        dayjs().startOf('month').format('YYYY-MM-DD') +
        ' - ' +
        dayjs().endOf('month').format('YYYY-MM-DD'),
    },
  ];

  const handleDurationSelect = (item: any) => {
    setSelectedTimeFrame(item.label);
    setCustomRange(null);
    const [startDate, endDate] = item.dates.split(' - ');

    // Invalidate cache before setting new date range to ensure fresh data
    dispatch(projectWorkloadApi.util.invalidateTags(['ProjectWorkload']));

    dispatch(
      setDateRange({
        startDate,
        endDate,
      })
    );
    setIsDateDropdownOpen(false);
  };

  // Default values from the initial state
  const defaultWorkingDays = {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  };
  const defaultTimeScale = 'week';
  const defaultShowWeekends = false;
  const defaultWorkingHoursPerDay = 8;
  const defaultDateRange = {
    startDate: dayjs().startOf('week').format('YYYY-MM-DD'),
    endDate: dayjs().endOf('week').format('YYYY-MM-DD'),
  };

  // Check if values have changed from defaults
  const workingDaysChanged =
    workingDays.monday !== defaultWorkingDays.monday ||
    workingDays.tuesday !== defaultWorkingDays.tuesday ||
    workingDays.wednesday !== defaultWorkingDays.wednesday ||
    workingDays.thursday !== defaultWorkingDays.thursday ||
    workingDays.friday !== defaultWorkingDays.friday ||
    workingDays.saturday !== defaultWorkingDays.saturday ||
    workingDays.sunday !== defaultWorkingDays.sunday;
  const timeScaleChanged = timeScale !== defaultTimeScale;
  const showWeekendsChanged = showWeekends !== defaultShowWeekends;
  const workingHoursChanged = workingHoursPerDay !== defaultWorkingHoursPerDay;
  const dateRangeChanged =
    dateRange.startDate !== defaultDateRange.startDate ||
    dateRange.endDate !== defaultDateRange.endDate;

  const activeFiltersCount =
    (filters.showOverallocated ? 1 : 0) +
    (filters.showUnderutilized ? 1 : 0) +
    (filters.memberIds?.length || 0) +
    (filters.teamIds?.length || 0) +
    (filters.taskStatuses?.length || 0) +
    (filters.taskPriorities?.length || 0) +
    (workingDaysChanged ? 1 : 0) +
    (timeScaleChanged ? 1 : 0) +
    (showWeekendsChanged ? 1 : 0) +
    (workingHoursChanged ? 1 : 0) +
    (dateRangeChanged ? 1 : 0);

  const filterContent = (
    <Flex vertical gap={16} style={{ width: 300 }}>
      <div>
        <label style={{ display: 'block', marginBottom: 8 }}>{t('filters.timeScale')}</label>
        <Select
          value={timeScale}
          onChange={value => dispatch(setTimeScale(value))}
          style={{ width: '100%' }}
          options={[
            { label: t('filters.daily'), value: 'day' },
            { label: t('filters.weekly'), value: 'week' },
            { label: t('filters.monthly'), value: 'month' },
          ]}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 8 }}>
          {t('filters.workingHoursPerDay')}
        </label>
        <InputNumber
          value={workingHoursPerDay}
          onChange={value => dispatch(setWorkingHoursPerDay(value || 8))}
          style={{ width: '100%' }}
          min={1}
          max={24}
          step={0.5}
          addonAfter={t('table.hours')}
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: 8 }}>{t('filters.workingDays')}</label>
        <Flex vertical gap={8}>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.monday}
              onChange={() => dispatch(toggleWorkingDay('monday'))}
            >
              {t('filters.monday')}
            </Checkbox>
          </Flex>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.tuesday}
              onChange={() => dispatch(toggleWorkingDay('tuesday'))}
            >
              {t('filters.tuesday')}
            </Checkbox>
          </Flex>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.wednesday}
              onChange={() => dispatch(toggleWorkingDay('wednesday'))}
            >
              {t('filters.wednesday')}
            </Checkbox>
          </Flex>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.thursday}
              onChange={() => dispatch(toggleWorkingDay('thursday'))}
            >
              {t('filters.thursday')}
            </Checkbox>
          </Flex>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.friday}
              onChange={() => dispatch(toggleWorkingDay('friday'))}
            >
              {t('filters.friday')}
            </Checkbox>
          </Flex>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.saturday}
              onChange={() => dispatch(toggleWorkingDay('saturday'))}
            >
              {t('filters.saturday')}
            </Checkbox>
          </Flex>
          <Flex justify="space-between" align="center">
            <Checkbox
              checked={workingDays.sunday}
              onChange={() => dispatch(toggleWorkingDay('sunday'))}
            >
              {t('filters.sunday')}
            </Checkbox>
          </Flex>
        </Flex>
      </div>

      <Divider style={{ marginBlock: 12 }} />

      <Flex justify="space-between" align="center">
        <span>{t('filters.showWeekends')}</span>
        <Switch checked={showWeekends} onChange={() => dispatch(toggleWeekends())} />
      </Flex>

      <Flex justify="space-between" align="center">
        <span>{t('filters.showOverallocated')}</span>
        <Switch
          checked={filters.showOverallocated}
          onChange={checked => dispatch(setFilters({ showOverallocated: checked }))}
        />
      </Flex>

      <Flex justify="space-between" align="center">
        <span>{t('filters.showUnderutilized')}</span>
        <Switch
          checked={filters.showUnderutilized}
          onChange={checked => dispatch(setFilters({ showUnderutilized: checked }))}
        />
      </Flex>

      <Button
        type="text"
        danger
        onClick={() => {
          dispatch(clearFilters());
          // Reset all values to defaults
          dispatch(setWorkingDays(defaultWorkingDays));
          dispatch(setTimeScale(defaultTimeScale));
          dispatch(setWorkingHoursPerDay(defaultWorkingHoursPerDay));
          // Reset showWeekends to false only if it's currently true
          if (showWeekends) {
            dispatch(toggleWeekends());
          }
          dispatch(setDateRange(defaultDateRange));
          // Reset local state
          setSelectedTimeFrame('thisWeek');
          setCustomRange(null);
        }}
        disabled={activeFiltersCount === 0}
      >
        {t('filters.clearAll')}
      </Button>
    </Flex>
  );

  const timeWiseDropdownContent = (
    <Card
      styles={{
        body: {
          padding: 0,
          minWidth: 320,
          maxHeight: 330,
          overflowY: 'auto',
        },
      }}
    >
      <List style={{ padding: 0 }}>
        {dateRangeItems.map(item => (
          <List.Item
            key={item.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              padding: '8px 12px',
              backgroundColor:
                selectedTimeFrame === item.label ? token.colorPrimaryBg : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => handleDurationSelect(item)}
          >
            <Typography.Text
              style={{
                color: selectedTimeFrame === item.label ? token.colorPrimary : 'inherit',
              }}
            >
              {t(`filters.${item.label}`)}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {item.dates
                ? dayjs(item.dates.split(' - ')[0]).format('MMM DD, YYYY') +
                  ' - ' +
                  dayjs(item.dates.split(' - ')[1]).format('MMM DD, YYYY')
                : ''}
            </Typography.Text>
          </List.Item>
        ))}
      </List>

      <Divider style={{ marginBlock: 12 }} />

      <Flex vertical gap={8} style={{ padding: 12 }}>
        <Typography.Text>{t('filters.custom')}</Typography.Text>
        <DatePicker.RangePicker
          format={'MMM DD, YYYY'}
          onChange={handleDateRangeChange}
          value={customRange ? [dayjs(customRange[0]), dayjs(customRange[1])] : null}
        />
        <Button
          type="primary"
          size="small"
          style={{ width: 'fit-content', alignSelf: 'flex-end' }}
          onClick={applyCustomDateFilter}
          disabled={!customRange}
        >
          {t('common.save')}
        </Button>
      </Flex>
    </Card>
  );

  return (
    <Flex align="center" gap={12} wrap="wrap">
      <Dropdown
        trigger={['click']}
        dropdownRender={() => timeWiseDropdownContent}
        onOpenChange={open => setIsDateDropdownOpen(open)}
        open={isDateDropdownOpen}
      >
        <Button icon={<DownOutlined />} iconPosition="end">
          {getDisplayLabel()}
        </Button>
      </Dropdown>

      <Popover
        content={filterContent}
        title={t('filters.title')}
        trigger="click"
        open={filterPopoverOpen}
        onOpenChange={setFilterPopoverOpen}
        placement="bottomRight"
      >
        <Button icon={activeFiltersCount > 0 ? <FilterFilled /> : <FilterOutlined />}>
          {t('filters.filters')}
        </Button>
      </Popover>

      <Button
        icon={<ReloadOutlined spin={isRefreshing} />}
        onClick={handleRefresh}
        title={t('filters.refresh')}
        loading={isRefreshing}
        disabled={isRefreshing}
      />
    </Flex>
  );
};

export default WorkloadFilters;
